/** Taxonomy icons (library page, material chips) — inline SVG from icons.js, no icon font. */
import { hasIcon, iconSvg } from "./icons.js";

/** Product thumbnail for a material (front shell render), as used on the material tabs. */
export function materialThumbHtml(slug, label = "") {
  return `<img class="material-thumb" src="/assets/${encodeURIComponent(slug)}/thumb.png" alt="" aria-hidden="true" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'material-thumb-fallback',textContent:${JSON.stringify(String(label).charAt(0).toUpperCase() || "?")}}))" />`;
}

function fallbackInitial(label) {
  const text = String(label || "?").trim();
  return text ? text.charAt(0).toUpperCase() : "?";
}

/** @returns {Element} */
export function taxonomyIconElement(iconName, label) {
  const tpl = document.createElement("template");
  tpl.innerHTML = taxonomyIconHtml(iconName, label);
  return tpl.content.firstElementChild;
}

/** Safe HTML for templates (unknown names get the label's initial, never raw text). */
export function taxonomyIconHtml(iconName, label) {
  if (hasIcon(iconName)) return iconSvg(iconName);
  const initial = fallbackInitial(label).replace(/[<>&"]/g, "");
  return `<span class="library-icon-fallback" aria-hidden="true">${initial}</span>`;
}
