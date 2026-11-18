#!/usr/bin/env node
/**
 * Import factory Finish Library sheets → seed.sql + public/api/catalog.json
 *
 * Sources are listed in data/factory-library-template.json (`sources`). Each source
 * is either an .xlsx workbook or a text export of one (".xlsx.txt": "## Sheet: <name>"
 * sections with tab-separated rows). Source files are not committed (see .gitignore).
 *
 * Usage:
 *   node scripts/import-finish-library.mjs
 *   node scripts/import-finish-library.mjs --source ceramic=path/to/Ceramic.xlsx
 *   node scripts/import-finish-library.mjs --include-usd-prices   # see note below
 *
 * USD unit prices from the factory are read but NOT written to the generated files
 * unless --include-usd-prices is passed: public/api/catalog is served publicly and
 * this repository is public. Cost bands (A–E) and $ bands are always written.
 *
 * If a source file is missing and the source has `carryOverIfMissing` (or the
 * --carry-over-missing flag is passed), that material's finishes are carried over
 * from the current catalog export.
 *
 * `factoryUpdates` in the template holds factory answers that came by email, not in
 * a sheet (e.g. a price quoted in a reply). They are applied on top of every import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderUrlFor, renderSqlLines } from "./lib/finish-renders.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_PATH = path.join(ROOT, "data", "factory-library-template.json");
const SEED_OUT = path.join(ROOT, "seed.sql");
const CATALOG_JSON = path.join(ROOT, "public", "api", "catalog.json");
const CATALOG_PLAIN = path.join(ROOT, "public", "api", "catalog");

/** Client names that must never appear in generated (public) output. */
const BLOCKED_TERMS = [/starbucks/i];

const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf8"));

function parseArgs() {
  const args = process.argv.slice(2);
  const overrides = {};
  let includeUsdPrices = false;
  let carryOverMissing = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      const [slug, file] = args[++i].split("=");
      overrides[slug] = path.resolve(file);
    } else if (args[i] === "--include-usd-prices") {
      includeUsdPrices = true;
    } else if (args[i] === "--carry-over-missing") {
      carryOverMissing = true;
    }
  }
  return { overrides, includeUsdPrices, carryOverMissing };
}

const normalizeHeader = (cell) =>
  String(cell ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cellText = (cell) => {
  if (cell === null || cell === undefined) return null;
  const s = String(cell).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

/** Placeholder values that mean "no data yet". */
function isPlaceholder(value) {
  const s = cellText(value);
  if (!s) return true;
  return /^(tbc\b.*|not offered|n\/a|#value!)$/i.test(s);
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 35% 55%)`;
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function boolVal(cell) {
  if (cell === true || cell === 1 || cell === "1") return true;
  const s = String(cell ?? "").trim().toLowerCase();
  return ["true", "yes", "y", "✓", "✔"].includes(s);
}

/* ---------- Reading workbooks ---------- */

/** Parse a ".xlsx.txt" text export into { sheetName: rows[][] }. */
function readTextExport(file) {
  const sheets = {};
  let current = null;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^## Sheet: (.+)$/);
    if (m) {
      current = m[1].trim();
      sheets[current] = [];
      continue;
    }
    if (current) sheets[current].push(line.split("\t"));
  }
  return sheets;
}

async function readWorkbook(file) {
  if (file.endsWith(".txt")) return readTextExport(file);
  const { default: XLSX } = await import("xlsx");
  const wb = XLSX.readFile(file);
  const sheets = {};
  for (const name of wb.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  }
  return sheets;
}

/* ---------- Column matching ---------- */

function findColumn(headerRow, def) {
  const headers = headerRow.map(normalizeHeader);
  const lower = headers.map((h) => h.toLowerCase());
  for (const h of def.headers ?? []) {
    const i = lower.indexOf(normalizeHeader(h).toLowerCase());
    if (i >= 0) return i;
  }
  for (const p of def.prefixes ?? []) {
    const pre = normalizeHeader(p).toLowerCase();
    const i = lower.findIndex((h) => h.startsWith(pre));
    if (i >= 0) return i;
  }
  return -1;
}

function isHeaderRow(row) {
  return row.some((c) => normalizeHeader(c).toLowerCase() === "finish name");
}

/** Factory sometimes packs a warning into the name, e.g. "Glitter (Not recommend — …)". */
function splitName(raw) {
  const m = raw.match(/^(.*?)\s*\((not recommend[^)]*)\)\s*$/i);
  if (!m) return { name: raw, warning: null };
  return { name: m[1].trim(), warning: m[2].trim().replace(/^not recommend\b/i, "Not recommended") };
}

const BAND_TIER = { A: 1, B: 2, C: 3, D: 4, E: 5 };

function importSheet(rows, source, sourceFile) {
  const materialSlug = source.materialSlug;
  const gfxDefs = template.graphicApplicationTypes[materialSlug] ?? [];
  const prefix = materialSlug.replace(/_/g, "-");
  const graphicApplicationTypes = gfxDefs.map((g, i) => ({
    id: `gfx-${prefix}-${String(i + 1).padStart(3, "0")}`,
    templateKey: g.templateKey,
    label: g.label,
    uiLabel: g.uiLabel,
    materialSlug,
    sortOrder: g.sortOrder,
  }));

  const finishes = [];
  const usedSlugs = new Map();
  const unmapped = new Set();
  let cols = null;
  let gfxCols = null;
  let availability = "offered";
  let inTable = false;

  for (const row of rows) {
    if (isHeaderRow(row)) {
      cols = {};
      for (const [key, def] of Object.entries(template.columns)) {
        cols[key] = findColumn(row, def);
        if (def.required && cols[key] < 0) {
          throw new Error(`Missing "${key}" column on sheet "${source.sheetName}" in ${sourceFile}`);
        }
      }
      gfxCols = gfxDefs.map((g) => findColumn(row, g));
      gfxDefs.forEach((g, i) => {
        if (gfxCols[i] < 0) unmapped.add(`graphic column "${g.label}" not found`);
      });
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    const rawName = cellText(row[cols.finishName]);
    if (!rawName) {
      // End of a table. A "currently not available" marker starts a second table.
      const marker = row.map(cellText).filter(Boolean).join(" ");
      if (/not available/i.test(marker)) availability = "not_offered";
      inTable = false;
      continue;
    }

    const { name, warning } = splitName(rawName);
    let baseSlug = slugify(name);
    const count = usedSlugs.get(baseSlug) ?? 0;
    usedSlugs.set(baseSlug, count + 1);
    if (count) baseSlug = `${baseSlug}-${count + 1}`;
    const slug = materialSlug === "stainless_steel" ? baseSlug : `${materialSlug}-${baseSlug}`;

    const get = (key) => (cols[key] >= 0 ? row[cols[key]] : null);
    const text = (key) => (isPlaceholder(get(key)) ? null : cellText(get(key)));

    const scoreRaw = cellText(get("durabilityScore"));
    const score = scoreRaw && /^\d+(\.\d+)?$/.test(scoreRaw) ? Number(scoreRaw) : null;
    if (scoreRaw && score === null) unmapped.add(`${name}: durability "${scoreRaw}" is not a number`);

    const stepsRaw = cellText(get("processSteps"));
    const steps = stepsRaw && /^\d+$/.test(stepsRaw) ? Number(stepsRaw) : null;

    const dollarBand = text("price");
    const costBandRaw = text("costBand");
    const costBand = costBandRaw && BAND_TIER[costBandRaw.toUpperCase()] ? costBandRaw.toUpperCase() : null;
    const priceUsdRaw = cellText(get("priceUsd"));
    const priceUsd = priceUsdRaw && !Number.isNaN(Number(priceUsdRaw)) ? Math.round(Number(priceUsdRaw) * 10000) / 10000 : null;

    let priceBand = null;
    let costTier = null;
    if (dollarBand && /^\$+$/.test(dollarBand)) {
      priceBand = dollarBand;
      costTier = Math.min(5, dollarBand.length);
    } else if (costBand) {
      priceBand = `Band ${costBand}`;
      costTier = BAND_TIER[costBand];
    }

    const rowAvailability =
      availability === "not_offered" || /^not offered$/i.test(cellText(get("priceUsd")) ?? "")
        ? "not_offered"
        : "offered";

    const notes = [warning ? `${warning}.` : null, text("notes")].filter(Boolean).join(" ") || null;

    const graphics = {};
    gfxDefs.forEach((g, i) => {
      graphics[g.templateKey] = gfxCols[i] >= 0 ? boolVal(row[gfxCols[i]]) : false;
    });

    finishes.push({
      id: `fin-${slug}`,
      slug,
      materialSlug,
      name,
      durabilityScore: score,
      durabilityNotes: text("durabilityNotes"),
      priceBand,
      costTier,
      finishProcess: text("finishProcess"),
      processSteps: steps,
      processStepsRaw: stepsRaw && steps === null && !isPlaceholder(stepsRaw) ? `Number of steps: ${stepsRaw.toLowerCase()}.` : null,
      notes,
      hexColor: hashColor(`${materialSlug}-${name}`),
      graphics,
      sourceFile: path.basename(sourceFile),
      details: {
        availability: rowAvailability,
        reviewStatus: source.reviewStatus ?? null,
        costBand,
        priceUsd,
        graphicAdhesion: text("graphicAdhesion"),
        microwaveSafe: text("microwaveSafe"),
        dishwasherSafe: text("dishwasherSafe"),
        colourLimitation: text("colourLimitation"),
        printingLimitations: text("printingLimitations"),
        matteGlossyOk: text("matteGlossyOk"),
      },
    });
  }

  if (!cols) throw new Error(`No "Finish Name" header row on sheet "${source.sheetName}" in ${sourceFile}`);

  const graphicIdByKey = Object.fromEntries(graphicApplicationTypes.map((g) => [g.templateKey, g.id]));
  return { materialSlug, graphicApplicationTypes, graphicIdByKey, finishes, unmapped: [...unmapped] };
}

/** Rebuild one material from the current catalog export (used when its source is missing). */
function carryOver(source) {
  const current = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf8"));
  const graphicApplicationTypes = current.graphicApplicationTypes.filter(
    (g) => g.materialSlug === source.materialSlug,
  );
  const graphicIdByKey = Object.fromEntries(graphicApplicationTypes.map((g) => [g.templateKey, g.id]));
  const finishes = current.finishes
    .filter((f) => f.materialSlug === source.materialSlug)
    .map((f) => ({
      ...f,
      descriptionOverride: f.description ?? null,
      sourceFile: path.basename(source.file),
      graphics: Object.fromEntries(
        graphicApplicationTypes.map((g) => [g.templateKey, (f.compatibleGraphics ?? []).includes(g.id)]),
      ),
      details: {
        availability: f.availability ?? "offered",
        reviewStatus: f.reviewStatus ?? source.reviewStatus ?? null,
        costBand: f.costBand ?? null,
        priceUsd: null,
        graphicAdhesion: f.graphicAdhesion ?? null,
        microwaveSafe: f.microwaveSafe ?? null,
        dishwasherSafe: f.dishwasherSafe ?? null,
        colourLimitation: f.colourLimitation ?? null,
        printingLimitations: f.printingLimitations ?? null,
        matteGlossyOk: f.matteGlossyOk ?? null,
      },
    }));
  return { materialSlug: source.materialSlug, graphicApplicationTypes, graphicIdByKey, finishes, unmapped: [] };
}

/* ---------- Email-only factory updates ---------- */

function applyCostBand(f, band) {
  f.details.costBand = band;
  // A $-band from the sheet (stainless steel) wins; otherwise show the A–E band.
  if (!(f.priceBand && /^\$+$/.test(f.priceBand))) {
    f.priceBand = `Band ${band}`;
    f.costTier = BAND_TIER[band];
  }
}

function applyFactoryUpdates(imports) {
  const updates = template.factoryUpdates ?? {};
  const bySlug = new Map(imports.map((i) => [i.materialSlug, i]));
  const applied = [];

  for (const u of updates.finishes ?? []) {
    const imp = bySlug.get(u.materialSlug);
    const f = imp?.finishes.find((x) => x.name.toLowerCase() === u.finishName.toLowerCase());
    if (!f) throw new Error(`factoryUpdates: finish "${u.finishName}" (${u.materialSlug}) not found; was it renamed in the sheet?`);
    const { costBand, ...rest } = u.set;
    if (costBand) {
      if (!BAND_TIER[costBand]) throw new Error(`factoryUpdates: bad cost band "${costBand}" for ${u.finishName}`);
      applyCostBand(f, costBand);
    }
    Object.assign(f.details, rest, { factoryUpdate: u.source ?? null });
    applied.push(`${u.materialSlug}/${f.name} (${u.source ?? "no source"})`);
  }

  for (const u of updates.graphics ?? []) {
    const imp = bySlug.get(u.materialSlug);
    for (const key of u.templateKeys) {
      const g = imp?.graphicApplicationTypes.find((x) => x.templateKey === key);
      if (!g) throw new Error(`factoryUpdates: graphic "${key}" (${u.materialSlug}) not found`);
      Object.assign(g, u.set, { factoryUpdate: u.source ?? null });
      applied.push(`${u.materialSlug}/${g.label} (${u.source ?? "no source"})`);
    }
  }
  return applied;
}

function joinSentences(parts) {
  const list = parts.filter(Boolean).map((p) => String(p).trim()).filter(Boolean);
  if (list.length < 2) return list[0] ?? null;
  return list.map((p) => (/[.!?)]$/.test(p) ? p : `${p}.`)).join(" ");
}

const describe = (f) =>
  f.descriptionOverride !== undefined
    ? f.descriptionOverride
    : joinSentences([f.durabilityNotes, f.notes, f.processStepsRaw]);

function publicDetails(f, includeUsdPrices) {
  const d = { ...f.details };
  if (!includeUsdPrices) delete d.priceUsd;
  return d;
}

/* ---------- Main ---------- */

async function run() {
  const { overrides, includeUsdPrices, carryOverMissing } = parseArgs();
  const imports = [];

  for (const source of template.sources) {
    const file = overrides[source.materialSlug] ?? path.join(ROOT, source.file);
    if (fs.existsSync(file)) {
      const sheets = await readWorkbook(file);
      const rows = sheets[source.sheetName];
      if (!rows) throw new Error(`Sheet "${source.sheetName}" not found in ${file}`);
      imports.push(importSheet(rows, source, file));
      console.log(`Imported ${source.materialSlug} from ${path.relative(ROOT, file)}`);
    } else if (source.carryOverIfMissing || carryOverMissing) {
      imports.push(carryOver(source));
      console.warn(`${source.materialSlug}: source not found, carried over from current catalog`);
    } else {
      throw new Error(`${source.materialSlug}: source not found: ${file}`);
    }
  }

  const appliedUpdates = applyFactoryUpdates(imports);
  const allFinishes = imports.flatMap((i) => i.finishes);
  for (const f of allFinishes) f.imageUrl = renderUrlFor(ROOT, f.materialSlug, f.slug);
  const allGraphics = imports.flatMap((i) => i.graphicApplicationTypes);
  const compatByFinish = new Map();

  const lines = [
    "-- Generated by scripts/import-finish-library.mjs — do not edit by hand",
    `-- Finishes: ${allFinishes.length} (${imports.map((i) => `${i.materialSlug}:${i.finishes.length}`).join(", ")})`,
    "",
    "INSERT OR IGNORE INTO profiles (id, email, full_name, team) VALUES",
    "  ('dev-pd-001', 'pd@corehome.internal', 'PD Demo User', 'PD'),",
    "  ('dev-id-001', 'id@corehome.internal', 'ID Demo User', 'ID');",
    "",
    "DELETE FROM finish_graphic_compat;",
    "DELETE FROM finishes WHERE template_id = 'finish_library_ak';",
    "DELETE FROM graphic_application_types;",
    "",
  ];

  for (const m of template.materialTypes) {
    lines.push(
      `INSERT OR REPLACE INTO material_types (id, slug, label, enabled, sort_order) VALUES (${sqlString(`mat-${m.slug}`)}, ${sqlString(m.slug)}, ${sqlString(m.label)}, ${m.enabled ? 1 : 0}, ${m.sortOrder});`,
    );
  }
  lines.push("");

  for (const g of allGraphics) {
    lines.push(
      `INSERT OR REPLACE INTO graphic_application_types (id, template_key, label, ui_label, material_slug, sort_order) VALUES (${sqlString(g.id)}, ${sqlString(g.templateKey)}, ${sqlString(g.label)}, ${sqlString(g.uiLabel)}, ${sqlString(g.materialSlug)}, ${g.sortOrder});`,
    );
  }
  lines.push("");

  for (const imp of imports) {
    for (const f of imp.finishes) {
      lines.push(
        `INSERT OR REPLACE INTO finishes (id, slug, material_slug, name, category, description, hex_color, durability_score, durability_notes, price_band, cost_tier, finish_process, process_steps, extensions, source_file, template_id) VALUES (${sqlString(f.id)}, ${sqlString(f.slug)}, ${sqlString(f.materialSlug)}, ${sqlString(f.name)}, ${sqlString(f.finishProcess || "finish")}, ${sqlString(describe(f))}, ${sqlString(f.hexColor)}, ${f.durabilityScore ?? "NULL"}, ${sqlString(f.durabilityNotes)}, ${sqlString(f.priceBand)}, ${f.costTier ?? "NULL"}, ${sqlString(f.finishProcess)}, ${f.processSteps ?? "NULL"}, ${sqlString(JSON.stringify(publicDetails(f, includeUsdPrices)))}, ${sqlString(f.sourceFile)}, 'finish_library_ak');`,
      );
      for (const g of imp.graphicApplicationTypes) {
        const compat = f.graphics[g.templateKey] ? 1 : 0;
        lines.push(
          `INSERT OR REPLACE INTO finish_graphic_compat (finish_id, graphic_id, compatible) VALUES (${sqlString(f.id)}, ${sqlString(g.id)}, ${compat});`,
        );
        if (compat) {
          const list = compatByFinish.get(f.id) ?? [];
          list.push(g.id);
          compatByFinish.set(f.id, list);
        }
      }
    }
  }

  const payload = {
    templateId: template.templateId,
    material: "stainless_steel",
    materials: template.materialTypes.map((m) => ({
      id: `mat-${m.slug}`,
      slug: m.slug,
      label: m.label,
      enabled: m.enabled ? 1 : 0,
      sortOrder: m.sortOrder,
      ...(template.factoryUpdates?.materials?.[m.slug]?.quoteBasis
        ? { quoteBasis: template.factoryUpdates.materials[m.slug].quoteBasis }
        : {}),
    })),
    graphicApplicationTypes: allGraphics,
    finishes: allFinishes.map((f) => ({
      id: f.id,
      slug: f.slug,
      materialSlug: f.materialSlug,
      name: f.name,
      category: f.finishProcess || "finish",
      durabilityScore: f.durabilityScore,
      durabilityNotes: f.durabilityNotes,
      priceBand: f.priceBand,
      costTier: f.costTier,
      finishProcess: f.finishProcess,
      processSteps: f.processSteps,
      description: describe(f),
      hexColor: f.hexColor,
      ...(f.imageUrl ? { imageUrl: f.imageUrl } : {}),
      ...publicDetails(f, includeUsdPrices),
      compatibleGraphics: compatByFinish.get(f.id) ?? [],
    })),
  };

  lines.push("", ...renderSqlLines(allFinishes));
  const seedText = lines.join("\n") + "\n";
  const catalogText = JSON.stringify(payload, null, 2) + "\n";
  for (const re of BLOCKED_TERMS) {
    if (re.test(seedText) || re.test(catalogText)) {
      throw new Error(`Generated output contains a blocked client term (${re}); fix the source mapping before committing.`);
    }
  }

  fs.writeFileSync(SEED_OUT, seedText);
  fs.writeFileSync(CATALOG_JSON, catalogText);
  fs.writeFileSync(CATALOG_PLAIN, catalogText);

  console.log(`Wrote ${allFinishes.length} finishes → ${path.relative(ROOT, SEED_OUT)}, ${path.relative(ROOT, CATALOG_JSON)}`);
  console.log(`USD unit prices: ${includeUsdPrices ? "included" : "omitted (pass --include-usd-prices to include)"}`);
  console.log(`Email-only factory updates applied: ${appliedUpdates.length}`);
  for (const a of appliedUpdates) console.log(`  ${a}`);
  for (const imp of imports) {
    const off = imp.finishes.filter((f) => f.details.availability === "not_offered").length;
    console.log(
      `  ${imp.materialSlug}: ${imp.finishes.length} finishes (${off} not offered), ${imp.graphicApplicationTypes.length} graphic types`,
    );
    for (const u of imp.unmapped) console.log(`    note: ${u}`);
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
