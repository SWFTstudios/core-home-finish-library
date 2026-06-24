#!/usr/bin/env node
/**
 * Validate finish asset inventory, files on disk, and mapping draft.
 *
 * Usage:
 *   node scripts/validate-finish-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  INVENTORY_PATH,
  DRAFT_PATH,
  SEED_ASSETS_PATH,
  parseFinishSlugsFromSeed,
  parseGraphicsFromSeed,
  destPathFromPublic,
  finishIdForSlug,
  resolveGraphicId,
  variantId,
} from "./lib/finish-assets-shared.mjs";

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function validateInventory() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    fail("Missing data/asset-inventory.json — run npm run assets:inventory");
    return null;
  }
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
  if (!inventory.entries?.length) {
    fail("Inventory has zero PNG entries");
  }
  if (inventory.duplicateSlugs?.length) {
    for (const slug of inventory.duplicateSlugs) {
      fail(`Duplicate variant slug in inventory: ${slug}`);
    }
  }
  return inventory;
}

function validateFilesOnDisk(inventory) {
  if (!inventory) return;

  let missingSource = 0;
  const sourceRoot = inventory.sourceRoot;
  for (const entry of inventory.entries) {
    const src = entry.relativePath
      ? path.join(sourceRoot, entry.relativePath)
      : entry.absolutePath;
    if (!src || !fs.existsSync(src)) {
      missingSource += 1;
    }
  }
  if (missingSource > 0) {
    warn(
      `${missingSource} source PNG paths missing (expected off-repo) — validating committed public assets only`,
    );
  }

  if (!fs.existsSync(SEED_ASSETS_PATH)) {
    warn("Missing seed-finish-assets.sql — run npm run assets:import");
    return;
  }

  const sql = fs.readFileSync(SEED_ASSETS_PATH, "utf8");
  const pathRe = /'(\/assets\/finishes\/[^']+\.png)'/g;
  let m;
  const paths = new Set();
  while ((m = pathRe.exec(sql))) {
    paths.add(m[1]);
  }
  for (const publicPath of paths) {
    const disk = destPathFromPublic(publicPath);
    if (!fs.existsSync(disk)) {
      fail(`Public asset path missing on disk: ${publicPath}`);
    }
  }
}

function validateDraft(inventory) {
  if (!fs.existsSync(DRAFT_PATH)) {
    warn("Missing data/asset-mapping-draft.json — links not validated");
    return;
  }
  const draft = JSON.parse(fs.readFileSync(DRAFT_PATH, "utf8"));
  const finishes = parseFinishSlugsFromSeed();
  const graphics = parseGraphicsFromSeed();
  const variantKeys = new Set(
    (inventory?.entries ?? []).map(
      (e) => `${e.materialSlug}:${e.assetKind}:${e.variantSlug}`,
    ),
  );

  const defaultKeys = new Map();

  for (const link of draft.links ?? []) {
    if (!link.finishSlug || !link.materialSlug || !link.variantSlug) {
      fail("Draft link missing finishSlug, materialSlug, or variantSlug");
      continue;
    }

    if (!finishIdForSlug(finishes, link.materialSlug, link.finishSlug)) {
      fail(`Draft link references unknown finish slug: ${link.finishSlug}`);
    }

    const assetKind = link.graphicTemplateKey ? "graphic_combo" : "base_finish";
    const vkey = `${link.materialSlug}:${assetKind}:${link.variantSlug}`;
    let found = variantKeys.has(vkey);
    if (!found) {
      for (const key of variantKeys) {
        if (key.endsWith(`:${link.variantSlug}`) && key.startsWith(`${link.materialSlug}:`)) {
          found = true;
          break;
        }
      }
    }
    if (!found && inventory) {
      fail(`Draft link references unknown variant slug: ${link.variantSlug}`);
    }

    if (link.graphicTemplateKey) {
      const gid = resolveGraphicId(graphics, link.materialSlug, link.graphicTemplateKey);
      if (!gid) {
        fail(
          `Draft link references unknown graphic template: ${link.graphicTemplateKey}`,
        );
      }
    }

    if ((link.priority ?? 0) === 0 && !link.graphicTemplateKey) {
      const dk = `${link.materialSlug}:${link.finishSlug}`;
      if (defaultKeys.has(dk)) {
        fail(`Duplicate default base link for finish: ${link.finishSlug}`);
      }
      defaultKeys.set(dk, link.variantSlug);
    }
  }
}

function validateSeedSql() {
  if (!fs.existsSync(SEED_ASSETS_PATH)) return;
  const sql = fs.readFileSync(SEED_ASSETS_PATH, "utf8");
  if (sql.includes("DELETE FROM finishes")) {
    fail("seed-finish-assets.sql must not delete finishes");
  }
  if (sql.includes("DELETE FROM finish_asset_variants")) {
    warn("seed-finish-assets.sql deletes variants — prefer INSERT OR REPLACE only");
  }
}

function run() {
  const inventory = validateInventory();
  validateFilesOnDisk(inventory);
  validateDraft(inventory);
  validateSeedSql();

  if (warnings.length) {
    console.warn("Warnings:");
    for (const w of warnings) console.warn(`  - ${w}`);
  }

  if (errors.length) {
    console.error("Validation failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("Finish assets validation passed.");
  if (inventory) {
    console.log(`  ${inventory.totalFiles} inventoried PNGs`);
  }
}

run();
