#!/usr/bin/env node
/**
 * Import factory Finish Library xlsx → seed.sql + public/api/catalog.json
 *
 * Usage:
 *   node scripts/import-finish-library.mjs
 *   node scripts/import-finish-library.mjs --input-ss path/to/ss.xlsx --input-cgp path/to/cgp.xlsx
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
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input-ss" && args[i + 1]) inputSs = path.resolve(args[++i]);
    else if (args[i] === "--input-cgp" && args[i + 1]) inputCgp = path.resolve(args[++i]);
    else if (args[i] === "--input" && args[i + 1]) inputCgp = path.resolve(args[++i]);
  }
  return { inputSs, inputCgp };
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

function boolVal(cell) {
  if (cell === true || cell === 1 || cell === "1") return true;
  const s = String(cell ?? "").trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "y" || s === "✓" || s === "✔") return true;
  return false;
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

function writeCatalogExport(materials, allGraphics, allFinishes, compatRows) {
  const compatByFinish = new Map();
  for (const { finishId, graphicId } of compatRows) {
    const list = compatByFinish.get(finishId) ?? [];
    list.push(graphicId);
    compatByFinish.set(finishId, list);
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
    })),
    graphicApplicationTypes: allGraphics.map((g) => ({
      id: g.id,
      templateKey: g.templateKey,
      label: g.label,
      uiLabel: g.uiLabel,
      materialSlug: g.materialSlug,
      sortOrder: g.sortOrder,
    })),
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
      description:
        [f.durabilityNotes, f.notes, f.processStepsRaw].filter(Boolean).join(" ").trim() ||
        null,
      hexColor: f.hexColor,
      compatibleGraphics: compatByFinish.get(f.id) ?? [],
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(CATALOG_JSON, json + "\n");
  fs.writeFileSync(CATALOG_PLAIN, json + "\n");
}

function run() {
  const { inputSs, inputCgp } = parseArgs();

  const imports = [];

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

  if (!imports.length) {
    console.error("No input workbooks found. Provide --input-ss and/or --input-cgp.");
    process.exit(1);
  }

  const allFinishes = imports.flatMap((i) => i.finishes);
  const allGraphics = imports.flatMap((i) => i.graphicApplicationTypes);
  const compatRows = [];

  const lines = [
    "-- Generated by scripts/import-finish-library.mjs — do not edit by hand",
    `-- Finishes: ${allFinishes.length} (${imports.map((i) => `${i.materialSlug}:${i.finishes.length}`).join(", ")})`,
    "",
    "INSERT OR IGNORE INTO profiles (id, email, full_name, team) VALUES",
    "  ('dev-pd-001', 'pd@corehome.internal', 'PD Demo User', 'PD'),",
    "  ('dev-id-001', 'id@corehome.internal', 'ID Demo User', 'ID');",
    "",
    "DELETE FROM finish_asset_links WHERE finish_id IN (SELECT id FROM finishes WHERE template_id = 'finish_library_ak');",
    "DELETE FROM finish_graphic_compat;",
    "DELETE FROM finishes WHERE template_id = 'finish_library_ak';",
    "DELETE FROM graphic_application_types;",
    "",
  ];

  for (const m of template.materialTypes) {
    const id = `mat-${m.slug}`;
    lines.push(
      `INSERT OR REPLACE INTO material_types (id, slug, label, enabled, sort_order) VALUES (${sqlString(id)}, ${sqlString(m.slug)}, ${sqlString(m.label)}, ${m.enabled ? 1 : 0}, ${m.sortOrder});`,
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
      const desc =
        [f.durabilityNotes, f.notes, f.processStepsRaw]
          .filter(Boolean)
          .join(" ")
          .trim() || null;
      lines.push(
        `INSERT OR REPLACE INTO finishes (id, slug, material_slug, name, category, description, hex_color, durability_score, durability_notes, price_band, cost_tier, finish_process, process_steps, source_file, template_id) VALUES (${sqlString(f.id)}, ${sqlString(f.slug)}, ${sqlString(f.materialSlug)}, ${sqlString(f.name)}, ${sqlString(f.finishProcess || "finish")}, ${sqlString(desc)}, ${sqlString(f.hexColor)}, ${f.durabilityScore ?? "NULL"}, ${sqlString(f.durabilityNotes)}, ${sqlString(f.priceBand)}, ${f.costTier ?? "NULL"}, ${sqlString(f.finishProcess)}, ${f.processSteps ?? "NULL"}, ${sqlString(f.sourceFile)}, 'finish_library_ak');`,
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
  writeCatalogExport(template.materialTypes, allGraphics, allFinishes, compatRows);

  console.log(`Wrote ${allFinishes.length} finishes → ${SEED_OUT}`);
  console.log(`Wrote catalog export → ${CATALOG_JSON}`);
  for (const imp of imports) {
    console.log(`  ${imp.materialSlug}: ${imp.finishes.length} finishes, ${imp.graphicApplicationTypes.length} graphic types`);
  }
}

run();
