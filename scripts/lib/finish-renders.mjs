/**
 * Finish image lookup.
 *
 * Two sources, best first:
 *  1. Factory photo: listed in data/factory-photos.json and stored in R2
 *     (<baseUrl>/<materialSlug>/<finishSlug>.webp). Real photos from the factory sheets.
 *  2. AI render: a transparent PNG cutout at public/assets/renders/<materialSlug>/<finishSlug>.png.
 *
 * A finish gets `imageUrl` (the best available), `imageSource` ("factory_photo" | "ai_render")
 * and, when both exist, `renderUrl` (the AI render) so the UI can offer it as an alternative.
 * Run `npm run renders:attach` (or the full importer) after changing either source.
 */
import fs from "node:fs";
import path from "node:path";

export const RENDERS_DIR = path.join("public", "assets", "renders");
const PHOTOS_MANIFEST = path.join("data", "factory-photos.json");

export function renderUrlFor(root, materialSlug, slug) {
  const rel = path.join(RENDERS_DIR, materialSlug, `${slug}.png`);
  return fs.existsSync(path.join(root, rel)) ? `/assets/renders/${materialSlug}/${slug}.png` : null;
}

let photosCache = null;
function photos(root) {
  if (!photosCache) {
    const file = path.join(root, PHOTOS_MANIFEST);
    photosCache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { photos: {} };
  }
  return photosCache;
}

export function photoFor(root, materialSlug, slug) {
  const m = photos(root);
  const source = m.photos?.[materialSlug]?.[slug];
  return source ? { url: `${m.baseUrl}/${materialSlug}/${slug}.webp`, source } : null;
}

/** Image fields for a finish: { imageUrl, imageSource, photoSource?, renderUrl? } or {}. */
export function imageFieldsFor(root, materialSlug, slug) {
  const render = renderUrlFor(root, materialSlug, slug);
  const photo = photoFor(root, materialSlug, slug);
  if (photo) {
    return {
      imageUrl: photo.url,
      imageSource: "factory_photo",
      photoSource: photo.source,
      ...(render ? { renderUrl: render } : {}),
    };
  }
  return render ? { imageUrl: render, imageSource: "ai_render" } : {};
}

const sql = (v) => `'${String(v).replace(/'/g, "''")}'`;

/** SQL that points finishes.image_url at each finish image (one UPDATE per finish with an image). */
export function renderSqlLines(finishes) {
  const lines = finishes
    .filter((f) => f.imageUrl)
    .map((f) => `UPDATE finishes SET image_url = ${sql(f.imageUrl)} WHERE id = ${sql(f.id)};`);
  return lines.length ? ["-- Finish renders (public/assets/renders)", ...lines, ""] : [];
}
