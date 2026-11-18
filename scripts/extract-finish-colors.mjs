#!/usr/bin/env node
/**
 * Sample real colours from each finish image for the 3D preview.
 *
 * Reads public/api/catalog.json. For every finish with an image (factory photo in R2, or the
 * transparent AI render in public/assets/renders) it masks out the background and specular
 * highlights, then records:
 *   - primary / secondary: the two dominant colours (k-means)
 *   - top / middle / bottom, left / right: band averages, used for ombré and two-tone finishes
 *   - crop: the largest centred region that is all product, used as a photo texture
 * Writes public/data/finish-render.json. Hand corrections go in
 * public/data/finish-render-overrides.json, which the preview merges at runtime.
 *
 * Factory photos are cached under node_modules/.cache/finish-photos (never committed).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = path.join(ROOT, "public", "api", "catalog.json");
const OUT = path.join(ROOT, "public", "data", "finish-render.json");
const CACHE = path.join(ROOT, "node_modules", ".cache", "finish-photos");
const SIZE = 96;

const hex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = ([r, g, b]) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function imageBuffer(finish) {
  if (finish.imageUrl.startsWith("/")) {
    return fs.readFileSync(path.join(ROOT, "public", finish.imageUrl));
  }
  const file = path.join(CACHE, finish.materialSlug, `${finish.slug}.webp`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = await fetch(finish.imageUrl);
  if (!res.ok) throw new Error(`${res.status} ${finish.imageUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return buf;
}

/** Background colour if the image border is mostly one light, low-saturation colour. */
function borderBackground(px, w, h) {
  const border = [];
  for (let x = 0; x < w; x++) border.push(px[x], px[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) border.push(px[y * w], px[y * w + w - 1]);
  const light = border.filter((p) => p.a > 200 && lum(p.c) > 0.72 && sat(p.c) < 0.15);
  if (light.length < border.length * 0.45) return null;
  const avg = [0, 1, 2].map((i) => light.reduce((s, p) => s + p.c[i], 0) / light.length);
  return avg;
}

/**
 * Photos are lit, so a plain average lands in the shading. Albedo sits nearer the lit side:
 * average the 50th–85th luminance percentile (above shadow, below highlight).
 */
function litAverage(colors) {
  if (!colors.length) return null;
  const sorted = [...colors].sort((a, b) => lum(a) - lum(b));
  const band = sorted.slice(Math.floor(sorted.length * 0.5), Math.max(Math.ceil(sorted.length * 0.85), 1));
  return [0, 1, 2].map((ch) => band.reduce((s, c) => s + c[ch], 0) / band.length);
}

/** Different paint, not the same paint in shadow: hue moves, or brightness changes a lot. */
function distinct(a, b) {
  const sa = a[0] + a[1] + a[2] || 1;
  const sb = b[0] + b[1] + b[2] || 1;
  const hueShift = Math.hypot(a[0] / sa - b[0] / sb, a[1] / sa - b[1] / sb, a[2] / sa - b[2] / sb);
  const la = Math.max(lum(a), 0.02);
  const lb = Math.max(lum(b), 0.02);
  return hueShift > 0.07 || Math.max(la / lb, lb / la) > 2.2;
}

function kmeans(colors, k, iterations = 12) {
  const sorted = [...colors].sort((a, b) => lum(a) - lum(b));
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)]);
  let groups = [];
  for (let it = 0; it < iterations; it++) {
    groups = centers.map(() => []);
    for (const c of colors) {
      let best = 0;
      for (let i = 1; i < k; i++) if (dist(c, centers[i]) < dist(c, centers[best])) best = i;
      groups[best].push(c);
    }
    centers = groups.map((g, i) =>
      g.length ? [0, 1, 2].map((ch) => g.reduce((s, c) => s + c[ch], 0) / g.length) : centers[i],
    );
  }
  return centers
    .map((c, i) => ({ center: c, members: groups[i], share: groups[i].length / colors.length }))
    .sort((a, b) => b.share - a.share);
}

function bandAverage(px, mask, w, h, pick) {
  const cols = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i] && pick(x / w, y / h)) cols.push(px[i].c);
    }
  }
  const avg = litAverage(cols);
  return avg ? hex(avg) : null;
}

/** Largest centred rectangle (normalised x, y, w, h) where at least 97% of pixels are product. */
function productCrop(mask, w, h) {
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) (cx += x), (cy += y), n++;
  if (!n) return null;
  cx /= n;
  cy /= n;
  let best = null;
  for (let half = 2; half < Math.max(w, h) / 2; half++) {
    const x0 = Math.max(0, Math.round(cx - half));
    const x1 = Math.min(w, Math.round(cx + half));
    const y0 = Math.max(0, Math.round(cy - half * 1.2));
    const y1 = Math.min(h, Math.round(cy + half * 1.2));
    let inside = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) inside += mask[y * w + x];
    if (inside / ((x1 - x0) * (y1 - y0)) < 0.97) break;
    best = [x0 / w, y0 / h, (x1 - x0) / w, (y1 - y0) / h].map((v) => Number(v.toFixed(3)));
  }
  return best;
}

async function analyse(finish) {
  const { data, info } = await sharp(await imageBuffer(finish))
    .ensureAlpha()
    .resize(SIZE, SIZE, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = [];
  for (let i = 0; i < w * h; i++) {
    px.push({ c: [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]], a: data[i * 4 + 3] });
  }

  const bg = borderBackground(px, w, h);
  const mask = px.map((p) => (p.a > 200 && !(bg && dist(p.c, bg) < 28) ? 1 : 0));
  const subject = px.filter((_, i) => mask[i]).map((p) => p.c);
  if (subject.length < 40) return null;

  // Drop specular highlights unless the finish itself is light (white glaze, frosted, etc.).
  const noGlare = subject.filter((c) => !(lum(c) > 0.9 && sat(c) < 0.1));
  const colors = noGlare.length > subject.length * 0.4 ? noGlare : subject;
  const [first, ...rest] = kmeans(colors, 4);
  const second = rest.find((g) => g.share > 0.15 && distinct(first.center, g.center));

  return {
    source: finish.imageSource,
    coverage: Number((subject.length / (w * h)).toFixed(2)),
    primary: hex(litAverage(colors.filter((c) => !distinct(c, first.center)))),
    secondary: second ? hex(litAverage(colors.filter((c) => !distinct(c, second.center)))) : null,
    top: bandAverage(px, mask, w, h, (_, y) => y < 0.3),
    middle: bandAverage(px, mask, w, h, (_, y) => y >= 0.35 && y <= 0.65),
    bottom: bandAverage(px, mask, w, h, (_, y) => y > 0.7),
    left: bandAverage(px, mask, w, h, (x) => x < 0.3),
    right: bandAverage(px, mask, w, h, (x) => x > 0.7),
    crop: productCrop(mask, w, h),
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const finishes = {};
let failed = 0;
for (const f of catalog.finishes) {
  if (!f.imageUrl) continue;
  try {
    const entry = await analyse(f);
    if (entry) finishes[`${f.materialSlug}/${f.slug}`] = entry;
  } catch (err) {
    failed++;
    console.warn(`skip ${f.materialSlug}/${f.slug}: ${err.message}`);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generatedBy: "scripts/extract-finish-colors.mjs", finishes }, null, 2) + "\n");
const photos = Object.values(finishes).filter((e) => e.source === "factory_photo").length;
console.log(
  `Sampled ${Object.keys(finishes).length} finishes (${photos} factory photos, ${Object.keys(finishes).length - photos} AI renders)` +
    (failed ? `, ${failed} failed` : ""),
);
