#!/usr/bin/env node
/**
 * Scan FinishLibraryMaterialAssets → data/asset-inventory.json
 *
 * Usage:
 *   node scripts/inventory-finish-assets.mjs
 *   node scripts/inventory-finish-assets.mjs --source ~/Downloads/FinishLibraryMaterialAssets
 */
import fs from "node:fs";
import path from "node:path";
import {
  MAP_PATH,
  INVENTORY_PATH,
  loadMap,
  expandHome,
  stemFromFilename,
  variantSlugFromStem,
  humanLabelFromStem,
  sha256File,
  readPngDimensions,
} from "./lib/finish-assets-shared.mjs";

function parseArgs(map) {
  const args = process.argv.slice(2);
  let source = expandHome(map.defaultSourceRoot);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = expandHome(path.resolve(args[++i]));
    }
  }
  return { source };
}

function walkPngs(root, map) {
  const materialsRoot = path.join(root, "Materials");
  if (!fs.existsSync(materialsRoot)) {
    throw new Error(`Materials folder not found: ${materialsRoot}`);
  }

  const entries = [];
  const slugCounts = new Map();

  for (const materialFolder of fs.readdirSync(materialsRoot)) {
    const materialPath = path.join(materialsRoot, materialFolder);
    if (!fs.statSync(materialPath).isDirectory()) continue;

    const materialSlug = map.materialFolders[materialFolder];
    if (!materialSlug) continue;

    for (const kindFolder of fs.readdirSync(materialPath)) {
      const kindPath = path.join(materialPath, kindFolder);
      if (!fs.statSync(kindPath).isDirectory()) continue;

      const assetKind = map.assetKindFolders[kindFolder];
      if (!assetKind) continue;

      const stack = [{ dir: kindPath, graphicSubfolder: null, categoryFolder: null }];
      while (stack.length) {
        const { dir, graphicSubfolder, categoryFolder } = stack.pop();
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            if (assetKind === "graphic_combo" && !graphicSubfolder) {
              stack.push({
                dir: full,
                graphicSubfolder: name,
                categoryFolder: name,
              });
            } else {
              stack.push({
                dir: full,
                graphicSubfolder,
                categoryFolder: categoryFolder ?? name,
              });
            }
            continue;
          }
          if (!name.toLowerCase().endsWith(".png")) continue;

          const stem = stemFromFilename(name, map.suffix);
          const variantSlug = variantSlugFromStem(stem, map);
          const slugKey = `${materialSlug}:${assetKind}:${variantSlug}`;
          slugCounts.set(slugKey, (slugCounts.get(slugKey) ?? 0) + 1);

          const dims = readPngDimensions(full);
          entries.push({
            materialSlug,
            assetKind,
            categoryFolder: categoryFolder ?? path.basename(path.dirname(full)),
            graphicSubfolder: graphicSubfolder ?? null,
            graphicTemplateKey:
              graphicSubfolder && map.graphicSubfolderToTemplateKey[graphicSubfolder]
                ? map.graphicSubfolderToTemplateKey[graphicSubfolder]
                : null,
            filename: name,
            stem,
            variantSlug,
            label: humanLabelFromStem(stem),
            relativePath: path.relative(root, full),
            sha256: sha256File(full),
            width: dims?.width ?? null,
            height: dims?.height ?? null,
          });
        }
      }
    }
  }

  const duplicateSlugs = [...slugCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: root,
    totalFiles: entries.length,
    duplicateSlugs,
    entries,
  };
}

function run() {
  const map = loadMap();
  const { source } = parseArgs(map);

  if (!fs.existsSync(source)) {
    console.error(`Source not found: ${source}`);
    console.error("Pass --source path/to/FinishLibraryMaterialAssets");
    process.exit(1);
  }

  const inventory = walkPngs(source, map);
  fs.writeFileSync(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`Wrote ${inventory.totalFiles} assets → ${INVENTORY_PATH}`);
  if (inventory.duplicateSlugs.length) {
    console.warn(`Duplicate variant slugs: ${inventory.duplicateSlugs.join(", ")}`);
  }
}

run();
