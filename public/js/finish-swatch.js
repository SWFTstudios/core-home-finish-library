/** Shared swatch styling for finish cards. */

export function swatchStyle(finish) {
  if (finish.image_url) return {};
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
