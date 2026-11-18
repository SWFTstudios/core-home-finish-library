/**
 * Finish render lookup.
 *
 * A render is a transparent PNG cutout at
 *   public/assets/renders/<materialSlug>/<finishSlug>.png
 * When the file exists, the finish gets imageUrl `/assets/renders/<materialSlug>/<finishSlug>.png`.
 * Drop a file in that folder and run `npm run renders:attach` (or the full importer) to wire it up.
 */
import fs from "node:fs";
import path from "node:path";

export const RENDERS_DIR = path.join("public", "assets", "renders");

export function renderUrlFor(root, materialSlug, slug) {
  const rel = path.join(RENDERS_DIR, materialSlug, `${slug}.png`);
  return fs.existsSync(path.join(root, rel)) ? `/assets/renders/${materialSlug}/${slug}.png` : null;
}

const sql = (v) => `'${String(v).replace(/'/g, "''")}'`;

/** SQL that points finishes.image_url at each render (one UPDATE per finish with a render). */
export function renderSqlLines(finishes) {
  const lines = finishes
    .filter((f) => f.imageUrl)
    .map((f) => `UPDATE finishes SET image_url = ${sql(f.imageUrl)} WHERE id = ${sql(f.id)};`);
  return lines.length ? ["-- Finish renders (public/assets/renders)", ...lines, ""] : [];
}
