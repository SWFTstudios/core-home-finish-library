/** Material Symbols used in library taxonomy — avoids invalid names rendering as text. */

export const VALID_TAXONOMY_ICONS = new Set([
  "layers",
  "view_in_ar",
  "auto_awesome",
  "wb_twilight",
  "tonality",
  "gradient",
  "swap_horiz",
  "sticker",
  "palette",
  "format_paint",
  "texture",
  "hardware",
  "auto_fix_high",
  "help_outline",
  "category",
  "breakfast_dining",
  "window",
  "rebase",
  "shopping_bag",
  "close",
  "expand_more",
  "search",
]);

function fallbackInitial(label) {
  const text = String(label || "?").trim();
  return text ? text.charAt(0).toUpperCase() : "?";
}

/** @returns {HTMLElement} */
export function taxonomyIconElement(iconName, label) {
  const name = String(iconName || "").trim();
  if (name && VALID_TAXONOMY_ICONS.has(name)) {
    const span = document.createElement("span");
    span.className = "material-symbols-outlined";
    span.setAttribute("aria-hidden", "true");
    span.textContent = name;
    return span;
  }
  const span = document.createElement("span");
  span.className = "library-icon-fallback";
  span.setAttribute("aria-hidden", "true");
  span.textContent = fallbackInitial(label);
  return span;
}

/** Safe HTML for templates (icon name must be in allowlist). */
export function taxonomyIconHtml(iconName, label) {
  const name = String(iconName || "").trim();
  if (name && VALID_TAXONOMY_ICONS.has(name)) {
    return `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
  }
  const initial = fallbackInitial(label);
  return `<span class="library-icon-fallback" aria-hidden="true">${initial}</span>`;
}
