/** Shared swatch styling for finish cards. */

/** Best image for a finish: a factory photo when one exists, else an AI render (PNG cutout). */
export function finishImageUrl(finish) {
  return finish?.imageUrl || finish?.image_url || null;
}

/** True when the finish image is a real factory photo (fills its frame) rather than an AI cutout. */
export function isFactoryPhoto(finish) {
  if (finish?.imageSource) return finish.imageSource === "factory_photo";
  const url = finishImageUrl(finish);
  return Boolean(url) && !url.startsWith("/assets/renders/");
}

/** Short label for where the finish image comes from. */
export function imageSourceLabel(finish) {
  if (!finishImageUrl(finish)) return null;
  if (isFactoryPhoto(finish)) return finish.photoSource ? `Factory photo (${finish.photoSource})` : "Factory photo";
  return "AI sample render, not a real sample";
}

export function swatchStyle(finish) {
  if (finishImageUrl(finish)) return {};
  if (finish.hexColor || finish.hex_color) {
    return { background: finish.hexColor || finish.hex_color };
  }
  return { background: "var(--lumina-surface-container-high)" };
}

export function formatRating(n, max = 5) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return `${Number(n)}/${max}`;
}

export function costDots(tier, max = 5) {
  const n = tier == null ? 0 : Math.min(max, Math.max(0, Number(tier)));
  return "●".repeat(n) + "○".repeat(max - n);
}
