#!/usr/bin/env node
/**
 * Import factory Finish Library xlsx → seed.sql + public/api/catalog.json
 *
 * Usage:
 *   node scripts/import-finish-library.mjs
 *   node scripts/import-finish-library.mjs --input-ss path/to/ss.xlsx --input-cgp path/to/cgp.xlsx
 *   node scripts/import-finish-library.mjs --input-verify path/to/verify.xlsx
 *   node scripts/import-finish-library.mjs --from-catalog
 *
 * Euro unit_price_adder is written to seed.sql only — never to catalog.json / public API export.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_PATH = path.join(ROOT, "data", "factory-library-template.json");
const SEED_OUT = path.join(ROOT, "seed.sql");
const CATALOG_JSON = path.join(ROOT, "public", "api", "catalog.json");
const CATALOG_PLAIN = path.join(ROOT, "public", "api", "catalog");

const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf8"));

function parseArgs() {
  const args = process.argv.slice(2);
  let inputSs = path.join(ROOT, template.defaultInputSs);
  let inputCgp = path.join(ROOT, template.defaultInputCgp);
  let inputVerify = template.defaultInputVerify
    ? path.join(ROOT, template.defaultInputVerify)
    : null;
  let fromCatalog = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input-ss" && args[i + 1]) inputSs = path.resolve(args[++i]);
    else if (args[i] === "--input-cgp" && args[i + 1]) inputCgp = path.resolve(args[++i]);
    else if (args[i] === "--input-verify" && args[i + 1])
      inputVerify = path.resolve(args[++i]);
    else if (args[i] === "--input" && args[i + 1]) inputCgp = path.resolve(args[++i]);
    else if (args[i] === "--from-catalog") fromCatalog = true;
  }
  return { inputSs, inputCgp, inputVerify, fromCatalog };
}

function normalizeHeader(cell) {
  return String(cell ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderMap(row) {
  const map = {};
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) map[key] = index;
  });
  return map;
}

function findColumnIndex(headerMap, columnDef) {
  for (const h of columnDef.headers) {
    const normalized = h.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
    if (headerMap[normalized] !== undefined) return headerMap[normalized];
    if (headerMap[h] !== undefined) return headerMap[h];
  }
  return -1;
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function priceToCostTier(price) {
  if (!price) return null;
  const s = String(price).trim();
  return Math.min(5, Math.max(1, s.length));
}

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 35% 55%)`;
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNum(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "NULL";
}

function boolVal(cell) {
  if (cell === true || cell === 1 || cell === "1") return true;
  const s = String(cell ?? "").trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "y" || s === "✓" || s === "✔") return true;
  return false;
}

function normalizeVerifiedStatus(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  const s = String(cell).trim().toLowerCase();
  if (!s) return null;
  if (s === "yes" || s === "y" || s === "true" || s === "verified") return "yes";
  if (s === "no" || s === "n" || s === "false") return "no";
  if (s.includes("review") || s.includes("need")) return "needs_review";
  return null;
}

function parseEuro(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  const s = String(cell).replace(/[€,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCostIndex(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  const n = Number(cell);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeBand(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  const s = String(cell).trim().toUpperCase();
  return /^[A-H]$/.test(s) ? s : null;
}

/** Map a euro adder to a band letter using sorted fromEur thresholds. */
function euroToBand(euro, bands) {
  if (euro === null || euro === undefined || !bands?.length) return null;
  const sorted = [...bands].sort((a, b) => a.fromEur - b.fromEur);
  let match = sorted[0]?.band ?? null;
  for (const b of sorted) {
    if (euro >= b.fromEur) match = b.band;
  }
  return match;
}

function loadCostBandsFromTemplate() {
  const byMaterial = {};
  const refs = {};
  const cfg = template.costBands || {};
  for (const [slug, materialCfg] of Object.entries(cfg)) {
    if (slug.startsWith("_")) continue;
    byMaterial[slug] = (materialCfg.bands || []).map((b) => ({
      materialSlug: slug,
      band: b.band,
      fromEur: b.fromEur,
      toEur: b.toEur ?? null,
      sortOrder: b.sortOrder ?? 0,
    }));
    refs[slug] = {
      referencePiece: materialCfg.referencePiece ?? null,
      referenceMoq: materialCfg.referenceMoq ?? null,
    };
  }
  return { byMaterial, refs };
}

function importSheet(wb, sheetConfig, sourceFile) {
  const sheet = wb.Sheets[sheetConfig.sheetName];
  if (!sheet) {
    console.error(`Sheet "${sheetConfig.sheetName}" not found in ${sourceFile}`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerMap = buildHeaderMap(rows[template.headerRow - 1]);

  const colIndexes = {};
  for (const [key, def] of Object.entries(sheetConfig.columns)) {
    const idx = findColumnIndex(headerMap, def);
    if (def.required && idx < 0) {
      console.error(
        `Missing required column "${key}" on sheet "${sheetConfig.sheetName}" in ${sourceFile}`,
      );
      process.exit(1);
    }
    colIndexes[key] = idx;
  }

  const graphicKeys = sheetConfig.graphicApplicationTypes.map((g) => g.templateKey);
  const graphicIdByKey = {};
  sheetConfig.graphicApplicationTypes.forEach((g, i) => {
    const prefix = sheetConfig.materialSlug.replace(/_/g, "-");
    graphicIdByKey[g.templateKey] = `gfx-${prefix}-${String(i + 1).padStart(3, "0")}`;
  });

  const finishes = [];
  const usedSlugs = new Map();

  for (let r = template.dataStartRow - 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const name = row[colIndexes.finishName];
    if (!name || !String(name).trim()) continue;

    let baseSlug = slugify(name);
    const count = usedSlugs.get(baseSlug) ?? 0;
    if (count) baseSlug = `${baseSlug}-${count + 1}`;
    usedSlugs.set(baseSlug, count + 1);

    const materialSlug = sheetConfig.materialSlug;
    const slug =
      materialSlug === "stainless_steel" ? baseSlug : `${materialSlug}-${baseSlug}`;

    const graphics = {};
    for (const gk of graphicKeys) {
      const idx = colIndexes[gk];
      graphics[gk] = idx >= 0 ? boolVal(row[idx]) : false;
    }

    finishes.push({
      id: `fin-${slug}`,
      slug,
      materialSlug,
      name: String(name).replace(/\r?\n/g, " ").trim(),
      durabilityScore: row[colIndexes.durabilityScore] ?? null,
      durabilityNotes: row[colIndexes.durabilityNotes] ?? null,
      priceBand: row[colIndexes.price] ?? null,
      costTier: priceToCostTier(row[colIndexes.price]),
      unitPriceAdder: null,
      costBand: null,
      costIndex: null,
      verifiedStatus: null,
      factoryComments: null,
      finishProcess: row[colIndexes.finishProcess] ?? null,
      processSteps: (() => {
        const v = row[colIndexes.processSteps];
        if (v === null || v === undefined || v === "") return null;
        if (typeof v === "number" && !Number.isNaN(v)) return v;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })(),
      processStepsRaw:
        row[colIndexes.processSteps] != null &&
        typeof row[colIndexes.processSteps] !== "number"
          ? String(row[colIndexes.processSteps])
          : null,
      notes: row[colIndexes.notes] ?? null,
      hexColor: hashColor(`${materialSlug}-${name}`),
      graphics,
      sourceFile: path.basename(sourceFile),
    });
  }

  return {
    materialSlug: sheetConfig.materialSlug,
    graphicApplicationTypes: sheetConfig.graphicApplicationTypes.map((g) => ({
      ...g,
      id: graphicIdByKey[g.templateKey],
      materialSlug: sheetConfig.materialSlug,
    })),
    graphicIdByKey,
    finishes,
  };
}

function importFromCatalog() {
  if (!fs.existsSync(CATALOG_JSON)) {
    console.error(`Catalog not found: ${CATALOG_JSON}`);
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf8"));
  const byMaterial = new Map();

  for (const g of catalog.graphicApplicationTypes || []) {
    const slug = g.materialSlug || g.material_slug;
    if (!byMaterial.has(slug)) {
      byMaterial.set(slug, {
        materialSlug: slug,
        graphicApplicationTypes: [],
        graphicIdByKey: {},
        finishes: [],
      });
    }
    const imp = byMaterial.get(slug);
    const entry = {
      id: g.id,
      templateKey: g.templateKey || g.template_key,
      label: g.label,
      uiLabel: g.uiLabel || g.ui_label,
      materialSlug: slug,
      sortOrder: g.sortOrder ?? g.sort_order ?? 0,
    };
    imp.graphicApplicationTypes.push(entry);
    imp.graphicIdByKey[entry.templateKey] = entry.id;
  }

  for (const f of catalog.finishes || []) {
    const slug = f.materialSlug || f.material_slug;
    if (!byMaterial.has(slug)) {
      byMaterial.set(slug, {
        materialSlug: slug,
        graphicApplicationTypes: [],
        graphicIdByKey: {},
        finishes: [],
      });
    }
    const imp = byMaterial.get(slug);
    const compatIds = new Set(f.compatibleGraphics || []);
    const graphics = {};
    for (const g of imp.graphicApplicationTypes) {
      graphics[g.templateKey] = compatIds.has(g.id);
    }
    imp.finishes.push({
      id: f.id,
      slug: f.slug,
      materialSlug: slug,
      name: f.name,
      durabilityScore: f.durabilityScore ?? f.durability_score ?? null,
      durabilityNotes: f.durabilityNotes ?? f.durability_notes ?? null,
      priceBand: f.priceBand ?? f.price_band ?? null,
      costTier: f.costTier ?? f.cost_tier ?? null,
      unitPriceAdder: null,
      costBand: f.costBand ?? f.cost_band ?? null,
      costIndex: null,
      verifiedStatus: f.verifiedStatus ?? f.verified_status ?? null,
      factoryComments: f.factoryComments ?? f.factory_comments ?? null,
      finishProcess: f.finishProcess ?? f.finish_process ?? f.category ?? null,
      processSteps: f.processSteps ?? f.process_steps ?? null,
      processStepsRaw: null,
      notes: null,
      hexColor: f.hexColor ?? f.hex_color ?? hashColor(`${slug}-${f.name}`),
      graphics,
      sourceFile: "catalog.json",
      description: f.description ?? null,
    });
  }

  return [...byMaterial.values()];
}

function parseVerificationSheet(wb, sourceFile, costBandsState) {
  const cfg = template.verificationSheet;
  if (!cfg) return { byName: new Map(), matched: 0 };

  const sheet = wb.Sheets[cfg.sheetName];
  if (!sheet) {
    console.warn(`Verification sheet "${cfg.sheetName}" not found in ${sourceFile}`);
    return { byName: new Map(), matched: 0 };
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const materialSlug = cfg.materialSlug || "ceramic";

  const pieceCell = cfg.referencePieceCell;
  const moqCell = cfg.referenceMoqCell;
  if (pieceCell) {
    const v = rows[pieceCell.row - 1]?.[pieceCell.col - 1];
    if (v != null && String(v).trim()) {
      costBandsState.refs[materialSlug] = {
        ...(costBandsState.refs[materialSlug] || {}),
        referencePiece: String(v).trim(),
      };
    }
  }
  if (moqCell) {
    const v = rows[moqCell.row - 1]?.[moqCell.col - 1];
    const n = Number(v);
    if (Number.isFinite(n)) {
      costBandsState.refs[materialSlug] = {
        ...(costBandsState.refs[materialSlug] || {}),
        referenceMoq: n,
      };
    }
  }

  // Optional threshold mini-table (Band / From €/pc) — overrides template bands for this material
  const thr = cfg.thresholdTable;
  if (thr) {
    const headerRow = rows[cfg.headerRow - 1] || [];
    let bandCol = -1;
    let fromCol = -1;
    headerRow.forEach((cell, i) => {
      const h = normalizeHeader(cell);
      if (h === normalizeHeader(thr.bandHeader)) bandCol = i;
      if (h === normalizeHeader(thr.fromHeader)) fromCol = i;
    });
    // Prefer the right-hand Band/From pair when Finish Name also has a "Band" column
    if (bandCol >= 0 && fromCol >= 0 && fromCol > bandCol) {
      const froms = [];
      for (let r = cfg.dataStartRow - 1; r < rows.length; r++) {
        const band = normalizeBand(rows[r]?.[bandCol]);
        const fromEur = parseEuro(rows[r]?.[fromCol]);
        if (!band || fromEur === null) continue;
        froms.push({ band, fromEur });
      }
      if (froms.length) {
        froms.sort((a, b) => a.fromEur - b.fromEur);
        costBandsState.byMaterial[materialSlug] = froms.map((b, i) => {
          const next = froms[i + 1];
          return {
            materialSlug,
            band: b.band,
            fromEur: b.fromEur,
            toEur: next ? Number((next.fromEur - 0.01).toFixed(2)) : null,
            sortOrder: i + 1,
          };
        });
        console.log(
          `Loaded ${froms.length} cost-band thresholds for ${materialSlug} from verification sheet`,
        );
      }
    }
  }

  const headerRow = rows[cfg.headerRow - 1] || [];
  // Collect all indices per header — "Band" appears twice (finish band + threshold table)
  const headerIndices = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;
    if (!headerIndices[key]) headerIndices[key] = [];
    headerIndices[key].push(index);
  });
  const headerMap = {};
  for (const [key, idxs] of Object.entries(headerIndices)) {
    headerMap[key] = idxs[0];
  }

  const colIndexes = {};
  for (const [key, def] of Object.entries(cfg.columns)) {
    colIndexes[key] = findColumnIndex(headerMap, def);
  }
  // Finish Band sits next to Cost Index; threshold Band sits next to From (€/pc)
  const bandIdxs = headerIndices["Band"] || [];
  const fromIdxs = headerIndices[normalizeHeader(cfg.thresholdTable?.fromHeader || "From (€/pc)")] || [];
  if (bandIdxs.length) {
    const thresholdBand = fromIdxs.length
      ? bandIdxs.find((i) => fromIdxs.some((f) => Math.abs(f - i) === 1))
      : null;
    const finishBand =
      bandIdxs.find((i) => i !== thresholdBand) ??
      (colIndexes.costIndex >= 0
        ? bandIdxs.find((i) => i === colIndexes.costIndex + 1)
        : null) ??
      bandIdxs[0];
    colIndexes.costBand = finishBand;
  }

  const bands = costBandsState.byMaterial[materialSlug] || [];
  const byName = new Map();

  for (let r = cfg.dataStartRow - 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const nameIdx = colIndexes.finishName;
    if (nameIdx < 0) break;
    const name = row[nameIdx];
    if (!name || !String(name).trim()) {
      // Stop at instruction blocks / blank section
      if (String(row[0] ?? "").toUpperCase().includes("FACTORY")) break;
      continue;
    }
    const finishName = String(name).replace(/\r?\n/g, " ").trim();
    if (finishName.toUpperCase().startsWith("FACTORY")) break;

    const unitPriceAdder =
      colIndexes.unitPriceAdder >= 0 ? parseEuro(row[colIndexes.unitPriceAdder]) : null;
    let costBand =
      colIndexes.costBand >= 0 ? normalizeBand(row[colIndexes.costBand]) : null;
    if (!costBand) costBand = euroToBand(unitPriceAdder, bands);
    const costIndex =
      colIndexes.costIndex >= 0 ? parseCostIndex(row[colIndexes.costIndex]) : null;
    const verifiedStatus =
      colIndexes.verifiedStatus >= 0
        ? normalizeVerifiedStatus(row[colIndexes.verifiedStatus])
        : null;
    const factoryComments =
      colIndexes.factoryComments >= 0 && row[colIndexes.factoryComments] != null
        ? String(row[colIndexes.factoryComments]).trim() || null
        : null;

    byName.set(finishName.toLowerCase(), {
      materialSlug,
      unitPriceAdder,
      costBand,
      costIndex,
      verifiedStatus,
      factoryComments,
    });
  }

  return { byName, matched: byName.size, materialSlug };
}

function applyVerification(imports, verification) {
  if (!verification?.byName?.size) return 0;
  let applied = 0;
  for (const imp of imports) {
    for (const f of imp.finishes) {
      if (
        verification.materialSlug &&
        f.materialSlug !== verification.materialSlug
      ) {
        continue;
      }
      const row = verification.byName.get(f.name.toLowerCase());
      if (!row) continue;
      f.unitPriceAdder = row.unitPriceAdder;
      f.costBand = row.costBand;
      f.costIndex = row.costIndex;
      f.verifiedStatus = row.verifiedStatus;
      f.factoryComments = row.factoryComments;
      applied += 1;
    }
  }
  return applied;
}

function materialMeta(slug, refs) {
  const base = template.materialTypes.find((m) => m.slug === slug) || {
    slug,
    label: slug,
    enabled: true,
    sortOrder: 99,
  };
  const ref = refs[slug] || {};
  return {
    ...base,
    referencePiece:
      ref.referencePiece ?? base.referencePiece ?? null,
    referenceMoq: ref.referenceMoq ?? base.referenceMoq ?? null,
  };
}

function writeCatalogExport(materials, allGraphics, allFinishes, compatRows, costBandsByMaterial) {
  const compatByFinish = new Map();
  for (const { finishId, graphicId } of compatRows) {
    const list = compatByFinish.get(finishId) ?? [];
    list.push(graphicId);
    compatByFinish.set(finishId, list);
  }

  const costBands = {};
  for (const [slug, bands] of Object.entries(costBandsByMaterial)) {
    costBands[slug] = bands.map((b) => ({
      band: b.band,
      fromEur: b.fromEur,
      toEur: b.toEur,
      sortOrder: b.sortOrder,
    }));
  }

  const payload = {
    templateId: template.templateId,
    material: "stainless_steel",
    materials: materials.map((m) => ({
      id: `mat-${m.slug}`,
      slug: m.slug,
      label: m.label,
      enabled: m.enabled ? 1 : 0,
      sortOrder: m.sortOrder,
      referencePiece: m.referencePiece ?? null,
      referenceMoq: m.referenceMoq ?? null,
    })),
    graphicApplicationTypes: allGraphics.map((g) => ({
      id: g.id,
      templateKey: g.templateKey,
      label: g.label,
      uiLabel: g.uiLabel,
      materialSlug: g.materialSlug,
      sortOrder: g.sortOrder,
    })),
    costBands,
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
      costBand: f.costBand ?? null,
      verifiedStatus: f.verifiedStatus ?? null,
      factoryComments: f.factoryComments ?? null,
      finishProcess: f.finishProcess,
      processSteps: f.processSteps,
      description:
        f.description ||
        [f.durabilityNotes, f.notes, f.processStepsRaw].filter(Boolean).join(" ").trim() ||
        null,
      hexColor: f.hexColor,
      compatibleGraphics: compatByFinish.get(f.id) ?? [],
      // unit_price_adder and cost_index intentionally omitted (private)
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(CATALOG_JSON, json + "\n");
  fs.writeFileSync(CATALOG_PLAIN, json + "\n");
}

function writeSeed(imports, materials, costBandsByMaterial) {
  const allFinishes = imports.flatMap((i) => i.finishes);
  const allGraphics = imports.flatMap((i) => i.graphicApplicationTypes);
  const compatRows = [];

  const lines = [
    "-- Generated by scripts/import-finish-library.mjs — do not edit by hand",
    `-- Finishes: ${allFinishes.length} (${imports.map((i) => `${i.materialSlug}:${i.finishes.length}`).join(", ")})`,
    "-- Note: unit_price_adder / cost_index are private (seed/D1 only; not exported to catalog)",
    "",
    "INSERT OR IGNORE INTO profiles (id, email, full_name, team) VALUES",
    "  ('dev-pd-001', 'pd@corehome.internal', 'PD Demo User', 'PD'),",
    "  ('dev-id-001', 'id@corehome.internal', 'ID Demo User', 'ID');",
    "",
    "DELETE FROM finish_graphic_compat;",
    "DELETE FROM finishes WHERE template_id = 'finish_library_ak';",
    "DELETE FROM graphic_application_types;",
    "DELETE FROM cost_bands;",
    "",
  ];

  for (const m of materials) {
    const id = `mat-${m.slug}`;
    lines.push(
      `INSERT OR REPLACE INTO material_types (id, slug, label, enabled, sort_order, reference_piece, reference_moq) VALUES (${sqlString(id)}, ${sqlString(m.slug)}, ${sqlString(m.label)}, ${m.enabled ? 1 : 0}, ${m.sortOrder}, ${sqlString(m.referencePiece)}, ${sqlNum(m.referenceMoq)});`,
    );
  }
  lines.push("");

  for (const [slug, bands] of Object.entries(costBandsByMaterial)) {
    for (const b of bands) {
      lines.push(
        `INSERT OR REPLACE INTO cost_bands (material_slug, band, from_eur, to_eur, sort_order) VALUES (${sqlString(slug)}, ${sqlString(b.band)}, ${sqlNum(b.fromEur)}, ${sqlNum(b.toEur)}, ${b.sortOrder ?? 0});`,
      );
    }
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
      const desc =
        f.description ||
        [f.durabilityNotes, f.notes, f.processStepsRaw]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        null;
      lines.push(
        `INSERT OR REPLACE INTO finishes (id, slug, material_slug, name, category, description, hex_color, durability_score, durability_notes, price_band, cost_tier, unit_price_adder, cost_band, cost_index, verified_status, factory_comments, finish_process, process_steps, source_file, template_id) VALUES (${sqlString(f.id)}, ${sqlString(f.slug)}, ${sqlString(f.materialSlug)}, ${sqlString(f.name)}, ${sqlString(f.finishProcess || "finish")}, ${sqlString(desc)}, ${sqlString(f.hexColor)}, ${sqlNum(f.durabilityScore)}, ${sqlString(f.durabilityNotes)}, ${sqlString(f.priceBand)}, ${sqlNum(f.costTier)}, ${sqlNum(f.unitPriceAdder)}, ${sqlString(f.costBand)}, ${sqlNum(f.costIndex)}, ${sqlString(f.verifiedStatus)}, ${sqlString(f.factoryComments)}, ${sqlString(f.finishProcess)}, ${sqlNum(f.processSteps)}, ${sqlString(f.sourceFile)}, 'finish_library_ak');`,
      );
      for (const g of imp.graphicApplicationTypes) {
        const compat = f.graphics[g.templateKey] ? 1 : 0;
        lines.push(
          `INSERT OR REPLACE INTO finish_graphic_compat (finish_id, graphic_id, compatible) VALUES (${sqlString(f.id)}, ${sqlString(imp.graphicIdByKey[g.templateKey])}, ${compat});`,
        );
        if (compat) {
          compatRows.push({
            finishId: f.id,
            graphicId: imp.graphicIdByKey[g.templateKey],
          });
        }
      }
    }
  }

  fs.writeFileSync(SEED_OUT, lines.join("\n") + "\n");
  return { allFinishes, allGraphics, compatRows };
}

function applyVerificationDefaultsJson(imports, costBandsState) {
  const rel = template.defaultVerificationJson;
  if (!rel) return 0;
  const pathJson = path.join(ROOT, rel);
  if (!fs.existsSync(pathJson)) return 0;
  const data = JSON.parse(fs.readFileSync(pathJson, "utf8"));
  const materialSlug = data.materialSlug || "ceramic";
  if (data.referencePiece || data.referenceMoq) {
    costBandsState.refs[materialSlug] = {
      ...(costBandsState.refs[materialSlug] || {}),
      referencePiece: data.referencePiece ?? null,
      referenceMoq: data.referenceMoq ?? null,
    };
  }
  if (Array.isArray(data.bands) && data.bands.length) {
    costBandsState.byMaterial[materialSlug] = data.bands.map((b) => ({
      materialSlug,
      band: b.band,
      fromEur: b.fromEur,
      toEur: b.toEur ?? null,
      sortOrder: b.sortOrder ?? 0,
    }));
  }
  const byName = new Map();
  for (const row of data.finishes || []) {
    byName.set(String(row.name).toLowerCase(), {
      materialSlug,
      unitPriceAdder: row.unitPriceAdder ?? null,
      costBand: row.costBand ?? null,
      costIndex: row.costIndex ?? null,
      verifiedStatus: row.verifiedStatus ?? null,
      factoryComments: row.factoryComments ?? null,
    });
  }
  const applied = applyVerification(imports, { byName, materialSlug });
  console.log(`Applied verification defaults from ${rel} (${applied} finishes)`);
  return applied;
}

function run() {
  const { inputSs, inputCgp, inputVerify, fromCatalog } = parseArgs();
  const costBandsState = loadCostBandsFromTemplate();

  let imports = [];

  if (fromCatalog || (!fs.existsSync(inputSs) && !fs.existsSync(inputCgp))) {
    if (!fromCatalog) {
      console.warn("Factory workbooks not found — falling back to --from-catalog");
    }
    imports = importFromCatalog();
    console.log(`Loaded ${imports.reduce((n, i) => n + i.finishes.length, 0)} finishes from catalog`);
  } else {
    if (fs.existsSync(inputSs)) {
      const wb = XLSX.readFile(inputSs);
      imports.push(importSheet(wb, template.stainlessSteelSheet, inputSs));
      console.log(`Imported SS from ${inputSs}`);
    } else {
      console.warn(`SS workbook not found (skipped): ${inputSs}`);
    }

    if (fs.existsSync(inputCgp)) {
      const wb = XLSX.readFile(inputCgp);
      for (const sheetConfig of template.materialSheets) {
        imports.push(importSheet(wb, sheetConfig, inputCgp));
      }
      console.log(`Imported Ceramic/Glass/Plastic from ${inputCgp}`);
    } else {
      console.warn(`CGP workbook not found (skipped): ${inputCgp}`);
    }
  }

  if (!imports.length) {
    console.error("No finishes to import. Provide workbooks or use --from-catalog.");
    process.exit(1);
  }

  let verificationApplied = 0;
  if (inputVerify && fs.existsSync(inputVerify)) {
    const wb = XLSX.readFile(inputVerify);
    const verification = parseVerificationSheet(wb, inputVerify, costBandsState);
    verificationApplied = applyVerification(imports, verification);
    console.log(
      `Applied factory verification to ${verificationApplied}/${verification.matched} rows from ${inputVerify}`,
    );
  } else {
    if (inputVerify) {
      console.warn(`Verification workbook not found (skipped): ${inputVerify}`);
    }
    verificationApplied = applyVerificationDefaultsJson(imports, costBandsState);
  }

  const materials = template.materialTypes.map((m) =>
    materialMeta(m.slug, costBandsState.refs),
  );

  const { allFinishes, allGraphics, compatRows } = writeSeed(
    imports,
    materials,
    costBandsState.byMaterial,
  );
  writeCatalogExport(
    materials,
    allGraphics,
    allFinishes,
    compatRows,
    costBandsState.byMaterial,
  );

  const withBand = allFinishes.filter((f) => f.costBand).length;
  const withEuro = allFinishes.filter((f) => f.unitPriceAdder != null).length;

  console.log(`Wrote ${allFinishes.length} finishes → ${SEED_OUT}`);
  console.log(
    `Wrote catalog export → ${CATALOG_JSON} (${withBand} with costBand; euro private: ${withEuro} in seed only; verification rows applied: ${verificationApplied})`,
  );
  for (const imp of imports) {
    console.log(
      `  ${imp.materialSlug}: ${imp.finishes.length} finishes, ${imp.graphicApplicationTypes.length} graphic types`,
    );
  }
}

run();
