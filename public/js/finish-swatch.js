/** Shared swatch styling for finish cards. */

/** Render image for a finish (transparent PNG cutout), if one exists. */
export function finishImageUrl(finish) {
  return finish?.imageUrl || finish?.image_url || null;
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
