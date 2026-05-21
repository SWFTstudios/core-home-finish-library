#!/usr/bin/env node
/**
 * Import factory Finish Library xlsx → seed.sql
 * Usage: node scripts/import-finish-library.mjs [--input path/to/file.xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(
  ROOT,
  "docs",
  "Finish_Library_2025_AK_10.22 1.xlsx",
);
const TEMPLATE_PATH = path.join(ROOT, "data", "factory-library-template.json");
const SEED_OUT = path.join(ROOT, "seed.sql");

const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf8"));

function parseArgs() {
  const args = process.argv.slice(2);
  let input = DEFAULT_INPUT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      input = path.resolve(args[++i]);
    }
  }
  return input;
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
    .slice(0, 80);
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
  return cell === true || cell === "TRUE" || cell === 1 || cell === "1";
}

function run() {
  const inputPath = parseArgs();
  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(inputPath);
  const sheet = wb.Sheets[template.sheetName];
  if (!sheet) {
    console.error(`Sheet "${template.sheetName}" not found`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRow = rows[template.headerRow - 1];
  const headerMap = buildHeaderMap(headerRow);

  const colIndexes = {};
  for (const [key, def] of Object.entries(template.columns)) {
    const idx = findColumnIndex(headerMap, def);
    if (def.required && idx < 0) {
      console.error(`Missing required column for ${key}`);
      process.exit(1);
    }
    colIndexes[key] = idx;
  }

  const graphicKeys = template.graphicApplicationTypes.map((g) => g.templateKey);
  const graphicIdByKey = {};
  template.graphicApplicationTypes.forEach((g, i) => {
    graphicIdByKey[g.templateKey] = `gfx-${String(i + 1).padStart(3, "0")}`;
  });

  const finishes = [];
  const usedSlugs = new Map();
  for (let r = template.dataStartRow - 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const name = row[colIndexes["finishName"]];
    if (!name || !String(name).trim()) continue;

    let slug = slugify(name);
    const base = slug;
    const count = usedSlugs.get(base) ?? 0;
    if (count) slug = `${base}-${count + 1}`;
    usedSlugs.set(base, count + 1);
    const graphics = {};
    for (const gk of graphicKeys) {
      const idx = colIndexes[gk];
      graphics[gk] = idx >= 0 ? boolVal(row[idx]) : false;
    }

    finishes.push({
      id: `fin-${slug}`,
      slug,
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
      hexColor: hashColor(name),
      graphics,
    });
  }

  const sourceFile = path.basename(inputPath);
  const lines = [
    "-- Generated by scripts/import-finish-library.mjs — do not edit by hand",
    `-- Source: ${sourceFile}`,
    `-- Rows: ${finishes.length}`,
    "",
    "INSERT OR IGNORE INTO profiles (id, email, full_name, team) VALUES",
    "  ('dev-pd-001', 'pd@corehome.internal', 'PD Demo User', 'PD'),",
    "  ('dev-id-001', 'id@corehome.internal', 'ID Demo User', 'ID');",
    "",
    "DELETE FROM finish_graphic_compat;",
    "DELETE FROM finishes WHERE template_id = 'finish_library_ak';",
    "",
  ];

  for (const m of template.materialTypes) {
    const id = `mat-${m.slug}`;
    lines.push(
      `INSERT OR REPLACE INTO material_types (id, slug, label, enabled, sort_order) VALUES (${sqlString(id)}, ${sqlString(m.slug)}, ${sqlString(m.label)}, ${m.enabled ? 1 : 0}, ${m.sortOrder});`,
    );
  }
  lines.push("");

  for (const g of template.graphicApplicationTypes) {
    const id = graphicIdByKey[g.templateKey];
    lines.push(
      `INSERT OR REPLACE INTO graphic_application_types (id, template_key, label, ui_label, sort_order) VALUES (${sqlString(id)}, ${sqlString(g.templateKey)}, ${sqlString(g.label)}, ${sqlString(g.uiLabel)}, ${g.sortOrder});`,
    );
  }
  lines.push("");

  for (const f of finishes) {
    const desc =
      [f.durabilityNotes, f.notes, f.processStepsRaw]
        .filter(Boolean)
        .join(" ")
        .trim() || null;
    lines.push(
      `INSERT OR REPLACE INTO finishes (id, slug, name, category, description, hex_color, durability_score, durability_notes, price_band, cost_tier, finish_process, process_steps, source_file, template_id) VALUES (${sqlString(f.id)}, ${sqlString(f.slug)}, ${sqlString(f.name)}, ${sqlString(f.finishProcess || "finish")}, ${sqlString(desc)}, ${sqlString(f.hexColor)}, ${f.durabilityScore ?? "NULL"}, ${sqlString(f.durabilityNotes)}, ${sqlString(f.priceBand)}, ${f.costTier ?? "NULL"}, ${sqlString(f.finishProcess)}, ${f.processSteps ?? "NULL"}, ${sqlString(sourceFile)}, 'finish_library_ak');`,
    );
    for (const g of template.graphicApplicationTypes) {
      const compat = f.graphics[g.templateKey] ? 1 : 0;
      lines.push(
        `INSERT OR REPLACE INTO finish_graphic_compat (finish_id, graphic_id, compatible) VALUES (${sqlString(f.id)}, ${sqlString(graphicIdByKey[g.templateKey])}, ${compat});`,
      );
    }
  }

  fs.writeFileSync(SEED_OUT, lines.join("\n") + "\n");
  console.log(`Wrote ${finishes.length} finishes → ${SEED_OUT}`);
}

run();
