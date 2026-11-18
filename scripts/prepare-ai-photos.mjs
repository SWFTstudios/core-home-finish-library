#!/usr/bin/env node
/**
 * Post-process staged AI product photos into transparent PNGs for public/assets/renders.
 *
 * Reads data/ai-photos-raw/<material>/<slug>.png (or .webp), trims near-white background,
 * resizes, writes public/assets/renders/<material>/<slug>.png, and updates data/ai-photos.json.
 *
 * Usage: node scripts/prepare-ai-photos.mjs [--only material/slug]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "ai-photos-raw");
const OUT = path.join(ROOT, "public", "assets", "renders");
const MANIFEST = path.join(ROOT, "data", "ai-photos.json");
const MAX = 900;
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
  : { comment: "AI product photos pending GD/PD review", photos: {} };

async function processFile(material, slug, file) {
  const key = `${material}/${slug}`;
  if (only && only !== key) return null;
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // Near-white / near-gray studio backdrop → transparent
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 235 && max - min < 18) data[i * 4 + 3] = 0;
  }
  const outDir = path.join(OUT, material);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${slug}.png`);
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 8 })
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(outFile);

  const prev = manifest.photos[key] ?? {};
  manifest.photos[key] = {
    ...prev,
    material,
    slug,
    output: `/assets/renders/${material}/${slug}.png`,
    preparedAt: new Date().toISOString(),
    reviewStatus: prev.reviewStatus ?? "pending",
  };
  console.log(`Prepared ${key}`);
  return key;
}

const jobs = [];
for (const material of fs.readdirSync(RAW)) {
  const dir = path.join(RAW, material);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!/\.(png|webp|jpe?g)$/i.test(name)) continue;
    const slug = name.replace(/\.(png|webp|jpe?g)$/i, "");
    jobs.push(processFile(material, slug, path.join(dir, name)));
  }
}
await Promise.all(jobs);
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
const json = JSON.stringify(manifest, null, 2) + "\n";
fs.writeFileSync(MANIFEST, json);
fs.mkdirSync(path.join(ROOT, "public", "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "public", "data", "ai-photos.json"), json);
console.log(`Manifest: ${Object.keys(manifest.photos).length} photos`);
