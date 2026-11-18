#!/usr/bin/env node
/**
 * Attach finish renders to the generated catalog without re-reading factory sheets.
 *
 * Reads public/api/catalog.json, sets imageUrl on every finish that has a file in
 * public/assets/renders/<material>/<slug>.png, and rewrites the render block at the end of
 * seed.sql. The full importer (npm run import:finishes) produces the same result.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderUrlFor, renderSqlLines } from "./lib/finish-renders.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_JSON = path.join(ROOT, "public", "api", "catalog.json");
const CATALOG_PLAIN = path.join(ROOT, "public", "api", "catalog");
const SEED_OUT = path.join(ROOT, "seed.sql");
const MARKER = "-- Finish renders (public/assets/renders)";

const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf8"));
catalog.finishes = catalog.finishes.map((f) => {
  const { imageUrl: _old, ...rest } = f;
  const imageUrl = renderUrlFor(ROOT, f.materialSlug, f.slug);
  if (!imageUrl) return rest;
  const out = {};
  for (const [k, v] of Object.entries(rest)) {
    out[k] = v;
    if (k === "hexColor") out.imageUrl = imageUrl;
  }
  if (!("imageUrl" in out)) out.imageUrl = imageUrl;
  return out;
});
const catalogText = JSON.stringify(catalog, null, 2) + "\n";
fs.writeFileSync(CATALOG_JSON, catalogText);
fs.writeFileSync(CATALOG_PLAIN, catalogText);

let seed = fs.readFileSync(SEED_OUT, "utf8");
const at = seed.indexOf(MARKER);
if (at !== -1) seed = seed.slice(0, at);
seed = seed.replace(/\n*$/, "\n\n") + renderSqlLines(catalog.finishes).join("\n");
fs.writeFileSync(SEED_OUT, seed.replace(/\n*$/, "\n"));

const n = catalog.finishes.filter((f) => f.imageUrl).length;
console.log(`Attached renders to ${n} of ${catalog.finishes.length} finishes`);
