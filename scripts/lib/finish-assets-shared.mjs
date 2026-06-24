import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");

export const MAP_PATH = path.join(ROOT, "data", "asset-filename-map.json");
export const INVENTORY_PATH = path.join(ROOT, "data", "asset-inventory.json");
export const DRAFT_PATH = path.join(ROOT, "data", "asset-mapping-draft.json");
export const SEED_ASSETS_PATH = path.join(ROOT, "seed-finish-assets.sql");
export const PUBLIC_FINISHES = path.join(ROOT, "public", "assets", "finishes");

export function loadMap() {
  return JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
}

export function expandHome(p) {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME || "", p.slice(2));
  }
  return p;
}

export function sqlString(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function stemFromFilename(filename, suffix = "-Finish-Library.png") {
  if (filename.endsWith(suffix)) {
    return filename.slice(0, -suffix.length);
  }
  return filename.replace(/\.png$/i, "");
}

export function variantSlugFromStem(stem, map) {
  if (map.variantSlugAliases?.[stem]) {
    return map.variantSlugAliases[stem];
  }
  return slugify(stem);
}

export function humanLabelFromStem(stem) {
  return stem
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function materialPrefix(materialSlug) {
  const short = {
    stainless_steel: "ss",
    ceramic: "cer",
    glass: "gls",
    plastic: "pl",
  };
  return short[materialSlug] ?? materialSlug.slice(0, 3);
}

export function variantId(materialSlug, variantSlug, assetKind) {
  const kind = assetKind === "graphic_combo" ? "gfx" : "base";
  return `fav-${materialPrefix(materialSlug)}-${kind}-${variantSlug}`;
}

export function fileId(variantIdValue, role = "swatch", version = 1) {
  return `faf-${variantIdValue}-${role}-v${version}`;
}

export function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) return null;
  const sig = buf.readUInt32BE(0);
  if (sig !== 0x89504e47) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

export function publicPathForAsset({
  materialSlug,
  assetKind,
  variantSlug,
  graphicSubfolder,
}) {
  if (assetKind === "base_finish") {
    return `/assets/finishes/${materialSlug}/base/${variantSlug}.png`;
  }
  const sub = slugify(graphicSubfolder || "graphic");
  return `/assets/finishes/${materialSlug}/graphic/${sub}/${variantSlug}.png`;
}

export function destPathFromPublic(publicPath) {
  return path.join(ROOT, "public", publicPath.replace(/^\//, ""));
}

export function parseFinishSlugsFromSeed() {
  const seedPath = path.join(ROOT, "seed.sql");
  if (!fs.existsSync(seedPath)) return [];
  const text = fs.readFileSync(seedPath, "utf8");
  const finishes = [];
  const re =
    /INSERT OR REPLACE INTO finishes \([^)]+\) VALUES \('([^']+)', '([^']+)', '([^']+)', '([^']+)'/g;
  let m;
  while ((m = re.exec(text))) {
    finishes.push({
      id: m[1],
      slug: m[2],
      materialSlug: m[3],
      name: m[4].replace(/''/g, "'"),
    });
  }
  return finishes;
}

export function parseGraphicsFromSeed() {
  const seedPath = path.join(ROOT, "seed.sql");
  if (!fs.existsSync(seedPath)) return [];
  const text = fs.readFileSync(seedPath, "utf8");
  const graphics = [];
  const re =
    /INSERT OR REPLACE INTO graphic_application_types \([^)]+\) VALUES \('([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)'/g;
  let m;
  while ((m = re.exec(text))) {
    graphics.push({
      id: m[1],
      templateKey: m[2],
      label: m[3],
      uiLabel: m[4],
      materialSlug: m[5],
    });
  }
  return graphics;
}

export function resolveGraphicId(graphics, materialSlug, templateKey) {
  if (!templateKey) return "";
  const hit = graphics.find(
    (g) => g.materialSlug === materialSlug && g.templateKey === templateKey,
  );
  return hit?.id ?? "";
}

export function finishIdForSlug(finishes, materialSlug, finishSlug) {
  const hit = finishes.find(
    (f) => f.materialSlug === materialSlug && f.slug === finishSlug,
  );
  return hit?.id ?? null;
}
