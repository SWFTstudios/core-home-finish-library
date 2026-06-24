#!/usr/bin/env node
/**
 * One-way export: D1 tables → Airtable mirror (read-only; never writes to D1).
 *
 * Requires env:
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *
 * Offline fallback writes data/airtable-mirror-export.json when credentials missing.
 *
 * Usage:
 *   node scripts/export-d1-to-airtable.mjs
 *   node scripts/export-d1-to-airtable.mjs --local
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "data", "airtable-base-schema.json");
const OFFLINE_EXPORT = path.join(ROOT, "data", "airtable-mirror-export.json");

const TABLES = [
  { d1: "material_types", airtable: "Materials", fields: ["id", "slug", "label", "enabled", "sort_order"] },
  {
    d1: "finishes",
    airtable: "Finishes",
    fields: [
      "id",
      "slug",
      "material_slug",
      "name",
      "category",
      "hex_color",
      "image_url",
      "finish_process",
      "price_band",
    ],
  },
  {
    d1: "graphic_application_types",
    airtable: "Graphic Types",
    fields: ["id", "template_key", "label", "ui_label", "material_slug", "sort_order"],
  },
  {
    d1: "finish_graphic_compat",
    airtable: "Compat",
    fields: ["finish_id", "graphic_id", "compatible"],
  },
  {
    d1: "finish_asset_variants",
    airtable: "Asset Variants",
    fields: ["id", "material_slug", "variant_slug", "label", "category_folder", "asset_kind", "source_filename"],
  },
  {
    d1: "finish_asset_files",
    airtable: "Asset Files",
    fields: ["id", "variant_id", "role", "public_path", "sha256", "width", "height", "version", "is_active"],
  },
  {
    d1: "finish_asset_links",
    airtable: "Asset Links",
    fields: ["finish_id", "variant_id", "graphic_id", "priority"],
  },
];

function parseArgs() {
  return { local: process.argv.includes("--local") };
}

function queryD1(sql, local) {
  const flag = local ? "--local" : "--remote";
  const out = execSync(
    `npx wrangler d1 execute render-portal-db ${flag} --command ${JSON.stringify(sql)} --json`,
    { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const parsed = JSON.parse(out);
  const result = parsed?.[0]?.results;
  if (!result) return [];
  return result;
}

async function airtableFetch(apiKey, baseId, table, method, body) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${method} ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function listAllRecords(apiKey, baseId, table) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Airtable list ${table}: ${res.status}`);
    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return records;
}

function rowToFields(row, fieldNames) {
  const fields = {};
  for (const name of fieldNames) {
    if (row[name] !== undefined && row[name] !== null) {
      fields[name] = row[name];
    }
  }
  return fields;
}

async function upsertTable(apiKey, baseId, tableName, fieldNames, rows) {
  const existing = await listAllRecords(apiKey, baseId, tableName);
  const byId = new Map(
    existing
      .filter((r) => r.fields?.id)
      .map((r) => [String(r.fields.id), r.id]),
  );

  const toCreate = [];
  const toUpdate = [];

  for (const row of rows) {
    const fields = rowToFields(row, fieldNames);
    if (!fields.id) continue;
    const recId = byId.get(String(fields.id));
    if (recId) {
      toUpdate.push({ id: recId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  for (let i = 0; i < toCreate.length; i += 10) {
    await airtableFetch(apiKey, baseId, tableName, "POST", {
      records: toCreate.slice(i, i + 10),
    });
  }
  for (let i = 0; i < toUpdate.length; i += 10) {
    await airtableFetch(apiKey, baseId, tableName, "PATCH", {
      records: toUpdate.slice(i, i + 10),
    });
  }

  return { created: toCreate.length, updated: toUpdate.length };
}

async function run() {
  const { local } = parseArgs();
  const exportPayload = { exportedAt: new Date().toISOString(), tables: {} };

  for (const table of TABLES) {
    const sql = `SELECT ${table.fields.join(", ")} FROM ${table.d1}`;
    try {
      exportPayload.tables[table.d1] = queryD1(sql, local);
    } catch (err) {
      exportPayload.tables[table.d1] = [];
      console.warn(`D1 query skipped for ${table.d1}: ${err.message}`);
    }
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    fs.writeFileSync(OFFLINE_EXPORT, `${JSON.stringify(exportPayload, null, 2)}\n`);
    console.log(`No Airtable credentials — wrote offline export → ${OFFLINE_EXPORT}`);
    console.log("Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID to sync live.");
    console.log(`Base schema reference: ${SCHEMA_PATH}`);
    return;
  }

  for (const table of TABLES) {
    const rows = exportPayload.tables[table.d1] ?? [];
    const stats = await upsertTable(apiKey, baseId, table.airtable, table.fields, rows);
    console.log(`${table.airtable}: ${stats.created} created, ${stats.updated} updated`);
  }

  console.log("Airtable mirror sync complete (one-way D1 → Airtable).");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
