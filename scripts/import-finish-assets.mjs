#!/usr/bin/env node
/**
 * Copy PNG assets + emit seed-finish-assets.sql from inventory + mapping draft.
 *
 * Usage:
 *   node scripts/import-finish-assets.mjs
 *   node scripts/import-finish-assets.mjs --replace-links
 *   node scripts/import-finish-assets.mjs --suggest-draft
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  DRAFT_PATH,
  INVENTORY_PATH,
  SEED_ASSETS_PATH,
  loadMap,
  sqlString,
  variantId,
  fileId,
  publicPathForAsset,
  destPathFromPublic,
  parseFinishSlugsFromSeed,
  parseGraphicsFromSeed,
  resolveGraphicId,
  finishIdForSlug,
} from "./lib/finish-assets-shared.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    replaceLinks: args.includes("--replace-links"),
    suggestDraft: args.includes("--suggest-draft"),
  };
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyAsset(src, dest) {
  ensureDir(dest);
  fs.copyFileSync(src, dest);
}

function buildSuggestedLinks(inventory, map) {
  const links = [];
  const seen = new Set();

  for (const entry of inventory.entries) {
    if (entry.assetKind !== "base_finish") continue;
    const finishSlugs = map.variantToFinishSlugRules?.[entry.variantSlug] ?? [];
    for (const finishSlug of finishSlugs) {
      const key = `${finishSlug}:${entry.materialSlug}:base`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        finishSlug,
        materialSlug: entry.materialSlug,
        variantSlug: entry.variantSlug,
        graphicTemplateKey: null,
        priority: 0,
      });
    }
  }

  for (const entry of inventory.entries) {
    if (entry.assetKind !== "graphic_combo" || !entry.graphicTemplateKey) continue;
    const baseStem = entry.stem
      .replace(/^Laser-Etch-/i, "")
      .replace(/^SilkScreen-/i, "")
      .replace(/^Water-Decal-/i, "")
      .replace(/^Raised-Water-Decal-/i, "")
      .replace(/^Gloss-3Dprint-raise-/i, "")
      .replace(/^Gloss-3Dprint-/i, "")
      .replace(/^Gloss-3DPrint-raise-/i, "")
      .replace(/^Gloss-3DPrint-/i, "")
      .replace(/^Matte-3Dprint-raise-/i, "")
      .replace(/^Matte-3Dprint-/i, "")
      .replace(/^Matte-3DPrint-raise-/i, "")
      .replace(/^Matte-3DPrint-/i, "")
      .replace(/^FoilDecal-Raise-Gold-Emboss-/i, "")
      .replace(/^FoilDecal_Gold_Emboss-/i, "")
      .replace(/^FoilDecal-Raise-Silver-Emboss-/i, "")
      .replace(/^FoilDecal-Silver-Emboss-/i, "");

    const baseVariantSlug = entry.variantSlug.includes("-")
      ? entry.variantSlug.replace(/^[a-z]+-/, "").replace(/^[a-z]+-/, "")
      : entry.variantSlug;

    const mapRules = map.variantToFinishSlugRules ?? {};
    let finishSlugs = [];
    for (const [variantSlug, slugs] of Object.entries(mapRules)) {
      if (
        entry.stem.toLowerCase().includes(variantSlug.replace(/-/g, "")) ||
        entry.stem.toLowerCase().includes(variantSlug.replace(/-/g, "-")) ||
        stemMatches(entry.stem, variantSlug)
      ) {
        finishSlugs = slugs;
        break;
      }
    }

    if (!finishSlugs.length) {
      const normalizedStem = baseStem.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      for (const [variantSlug, slugs] of Object.entries(mapRules)) {
        if (normalizedStem.includes(variantSlug)) {
          finishSlugs = slugs;
          break;
        }
      }
    }

    for (const finishSlug of finishSlugs) {
      const key = `${finishSlug}:${entry.variantSlug}:${entry.graphicTemplateKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        finishSlug,
        materialSlug: entry.materialSlug,
        variantSlug: entry.variantSlug,
        graphicTemplateKey: entry.graphicTemplateKey,
        priority: 1,
      });
    }
  }

  return { version: 1, links };
}

function stemMatches(stem, variantSlug) {
  const norm = stem.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return norm.includes(variantSlug);
}

function loadDraft() {
  if (!fs.existsSync(DRAFT_PATH)) {
    return { version: 1, links: [] };
  }
  return JSON.parse(fs.readFileSync(DRAFT_PATH, "utf8"));
}

function run() {
  const { replaceLinks, suggestDraft } = parseArgs();
  const map = loadMap();

  if (!fs.existsSync(INVENTORY_PATH)) {
    console.error("Run npm run assets:inventory first.");
    process.exit(1);
  }

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
  const sourceRoot = inventory.sourceRoot;

  if (suggestDraft) {
    const draft = buildSuggestedLinks(inventory, map);
    fs.writeFileSync(DRAFT_PATH, `${JSON.stringify(draft, null, 2)}\n`);
    console.log(`Wrote ${draft.links.length} suggested links → ${DRAFT_PATH}`);
    return;
  }

  const draft = loadDraft();
  const finishes = parseFinishSlugsFromSeed();
  const graphics = parseGraphicsFromSeed();

  const variantBySlug = new Map();
  for (const entry of inventory.entries) {
    const id = variantId(entry.materialSlug, entry.variantSlug, entry.assetKind);
    const publicPath = publicPathForAsset({
      materialSlug: entry.materialSlug,
      assetKind: entry.assetKind,
      variantSlug: entry.variantSlug,
      graphicSubfolder: entry.graphicSubfolder,
    });

    copyAsset(
      path.join(sourceRoot, entry.relativePath),
      destPathFromPublic(publicPath),
    );

    variantBySlug.set(`${entry.materialSlug}:${entry.assetKind}:${entry.variantSlug}`, {
      entry,
      id,
      publicPath,
    });
  }

  const lines = [
    "-- Generated by scripts/import-finish-assets.mjs — do not edit by hand",
    `-- Assets: ${inventory.totalFiles} files, ${variantBySlug.size} variants`,
    "",
  ];

  if (replaceLinks) {
    lines.push(
      "DELETE FROM finish_asset_links WHERE finish_id IN (SELECT id FROM finishes WHERE template_id = 'finish_library_ak');",
      "",
    );
  }

  for (const { entry, id, publicPath } of variantBySlug.values()) {
    lines.push(
      `INSERT OR REPLACE INTO finish_asset_variants (id, material_slug, variant_slug, label, category_folder, asset_kind, source_filename) VALUES (${sqlString(id)}, ${sqlString(entry.materialSlug)}, ${sqlString(entry.variantSlug)}, ${sqlString(entry.label)}, ${sqlString(entry.categoryFolder)}, ${sqlString(entry.assetKind)}, ${sqlString(entry.filename)});`,
    );
    const fid = fileId(id, "swatch", 1);
    lines.push(
      `INSERT OR REPLACE INTO finish_asset_files (id, variant_id, role, public_path, sha256, width, height, version, is_active) VALUES (${sqlString(fid)}, ${sqlString(id)}, 'swatch', ${sqlString(publicPath)}, ${sqlString(entry.sha256)}, ${entry.width ?? "NULL"}, ${entry.height ?? "NULL"}, 1, 1);`,
    );
  }
  lines.push("");

  const unresolved = [];
  let linkCount = 0;

  for (const link of draft.links ?? []) {
    const variantKey = `${link.materialSlug}:${link.graphicTemplateKey ? "graphic_combo" : "base_finish"}:${link.variantSlug}`;
    let variant = variantBySlug.get(variantKey);

    if (!variant) {
      for (const [key, val] of variantBySlug.entries()) {
        if (key.endsWith(`:${link.variantSlug}`) && key.startsWith(`${link.materialSlug}:`)) {
          variant = val;
          break;
        }
      }
    }

    if (!variant) {
      unresolved.push({ ...link, reason: "variant_not_in_inventory" });
      continue;
    }

    const finishId = finishIdForSlug(finishes, link.materialSlug, link.finishSlug);
    if (!finishId) {
      unresolved.push({ ...link, reason: "finish_slug_not_in_seed" });
      continue;
    }

    const graphicId = resolveGraphicId(
      graphics,
      link.materialSlug,
      link.graphicTemplateKey ?? null,
    );
    if (link.graphicTemplateKey && !graphicId) {
      unresolved.push({ ...link, reason: "graphic_template_not_in_seed" });
      continue;
    }

    lines.push(
      `INSERT OR REPLACE INTO finish_asset_links (finish_id, variant_id, graphic_id, priority) VALUES (${sqlString(finishId)}, ${sqlString(variant.id)}, ${sqlString(graphicId)}, ${link.priority ?? 0});`,
    );
    linkCount += 1;
  }

  fs.writeFileSync(SEED_ASSETS_PATH, `${lines.join("\n")}\n`);

  const unresolvedPath = path.join(path.dirname(DRAFT_PATH), "asset-mapping-unresolved.json");
  if (unresolved.length) {
    fs.writeFileSync(
      unresolvedPath,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), unresolved }, null, 2)}\n`,
    );
    console.warn(`Unresolved links: ${unresolved.length} → ${unresolvedPath}`);
  } else if (fs.existsSync(unresolvedPath)) {
    fs.unlinkSync(unresolvedPath);
  }

  for (const mat of ["ceramic", "glass", "plastic"]) {
    const keep = path.join(path.dirname(destPathFromPublic(`/assets/finishes/${mat}/base/.gitkeep`)), ".gitkeep");
    ensureDir(keep);
    if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");
  }

  console.log(`Copied ${inventory.totalFiles} PNGs → public/assets/finishes/`);
  console.log(`Wrote ${variantBySlug.size} variants, ${linkCount} links → ${SEED_ASSETS_PATH}`);
  patchCatalogJson(variantBySlug, draft, finishes);
}

function findVariantPublicPath(variantBySlug, link) {
  const assetKind = link.graphicTemplateKey ? "graphic_combo" : "base_finish";
  const variantKey = `${link.materialSlug}:${assetKind}:${link.variantSlug}`;
  let variant = variantBySlug.get(variantKey);
  if (!variant) {
    for (const [key, val] of variantBySlug.entries()) {
      if (key.endsWith(`:${link.variantSlug}`) && key.startsWith(`${link.materialSlug}:`)) {
        variant = val;
        break;
      }
    }
  }
  return variant?.publicPath ?? null;
}

function patchCatalogJson(variantBySlug, draft, finishes) {
  const catalogPath = path.join(ROOT, "public", "api", "catalog.json");
  const catalogPlain = path.join(ROOT, "public", "api", "catalog");
  if (!fs.existsSync(catalogPath)) return;

  const graphics = parseGraphicsFromSeed();
  const imageByFinishId = new Map();
  const combosByFinishId = new Map();

  for (const link of draft.links ?? []) {
    const finishId = finishIdForSlug(finishes, link.materialSlug, link.finishSlug);
    if (!finishId) continue;

    const publicPath = findVariantPublicPath(variantBySlug, link);
    if (!publicPath) continue;

    if (link.graphicTemplateKey) {
      const graphicId = resolveGraphicId(graphics, link.materialSlug, link.graphicTemplateKey);
      const combos = combosByFinishId.get(finishId) ?? {};
      if (graphicId) combos[graphicId] = publicPath;
      combos[link.graphicTemplateKey] = publicPath;
      combosByFinishId.set(finishId, combos);
    } else if ((link.priority ?? 0) === 0) {
      imageByFinishId.set(finishId, publicPath);
    }
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  catalog.finishes = (catalog.finishes ?? []).map((f) => {
    const imageUrl = imageByFinishId.get(f.id);
    const comboImageUrls = combosByFinishId.get(f.id);
    const next = { ...f };
    if (imageUrl) next.imageUrl = imageUrl;
    if (comboImageUrls && Object.keys(comboImageUrls).length) {
      next.comboImageUrls = comboImageUrls;
    }
    return next;
  });
  const json = `${JSON.stringify(catalog, null, 2)}\n`;
  fs.writeFileSync(catalogPath, json);
  fs.writeFileSync(catalogPlain, json);
  console.log(
    `Patched catalog export with ${imageByFinishId.size} imageUrl, ${combosByFinishId.size} comboImageUrls`,
  );
}

run();
