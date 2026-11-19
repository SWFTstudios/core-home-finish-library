/**
 * Core Home icon set — inline SVG, thin outline style (Figma), no icon font.
 *
 * Replaces the Google "Material Symbols" font: icons render instantly, offline, and can never
 * fall back to showing their name as text. Every glyph is drawn on a 24×24 grid with a 1.6px
 * round stroke in currentColor, sized by font-size (1em) so existing CSS keeps working. The
 * `material-symbols-outlined` class is kept on the <svg> for those size rules.
 *
 * Pure module (no DOM): also used by scripts/build-icons.mjs to rewrite static HTML.
 */

/** name → SVG inner markup. `F` marks shapes that are filled rather than stroked. */
const F = 'fill="currentColor" stroke="none"';

export const ICONS = {
  // Navigation / app chrome
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  account_circle:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="3"/><path d="M6.4 17.6a7 7 0 0 1 11.2 0"/>',
  light_mode:
    '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  dark_mode: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  add: '<path d="M12 5.5v13M5.5 12h13"/>',
  expand_less: '<path d="m6.5 14.5 5.5-5.5 5.5 5.5"/>',
  expand_more: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  help_outline:
    '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.8" r=".9" ' + F + "/>",

  // Viewport controls
  zoom_in: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5M10.8 8.1v5.4M8.1 10.8h5.4"/>',
  zoom_out: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5M8.1 10.8h5.4"/>',
  360: '<path d="M8.5 16.2C5.3 15.6 3 14 3 12c0-2.5 4-4.5 9-4.5s9 2 9 4.5c0 1.9-2.4 3.5-5.8 4.2"/><path d="m10.8 13.8-2.3 2.4 2.3 2.3"/>',
  "3d_rotation":
    '<path d="M12 3.5 19 7.5v9L12 20.5 5 16.5v-9z"/><path d="M12 20.5V12M19 7.5 12 12 5 7.5"/>',
  view_in_ar:
    '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M12 7.5l4 2.3v4.4l-4 2.3-4-2.3V9.8z"/><path d="M12 16.5V12l4-2.2M12 12 8 9.8"/>',

  // Finish / process taxonomy (library page)
  layers: '<path d="M12 4 3.5 8.5 12 13l8.5-4.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  auto_awesome:
    '<path d="M10 4.5 11.6 9l4.4 1.5-4.4 1.6L10 16.5l-1.6-4.4L4 10.5 8.4 9z"/><path d="m17.5 14 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  auto_fix_high:
    '<path d="m4.5 19.5 10-10 2 2-10 10z" transform="translate(0 -1)"/><path d="M15 4l.7 1.6 1.6.7-1.6.7L15 8.6l-.7-1.6-1.6-.7 1.6-.7zM19.5 9.5l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z"/>',
  wb_twilight:
    '<path d="M3 18.5h18M6.5 18.5a5.5 5.5 0 0 1 11 0M12 6.5V4M5.9 9.9 4.5 8.5M18.1 9.9l1.4-1.4"/>',
  tonality: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" ' + F + "/>",
  gradient:
    '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="8" cy="15.5" r="1" ' + F + '/><circle cx="11" cy="12.5" r="1" ' + F + '/><circle cx="14" cy="9.5" r="1" ' + F + '/><circle cx="12" cy="16.5" r=".8" ' + F + '/><circle cx="16" cy="13" r=".8" ' + F + "/>",
  swap_horiz: '<path d="M4 8.5h14.5M15 5l3.5 3.5L15 12M20 15.5H5.5M9 12l-3.5 3.5L9 19"/>',
  palette:
    '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.7-1 1.2-1.9-.6-1.1.1-2.3 1.3-2.3h2.3A3.7 3.7 0 0 0 20.5 12.6C20.5 7.5 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11.5" r="1" ' + F + '/><circle cx="10" cy="7.8" r="1" ' + F + '/><circle cx="14.5" cy="7.8" r="1" ' + F + "/>",
  format_paint:
    '<rect x="4.5" y="3.5" width="12.5" height="5" rx="1"/><path d="M17 6h2.5v5H12v3"/><rect x="10.5" y="14" width="3" height="6.5" rx="1"/>',
  texture: '<path d="M4 20 20 4M4 14 14 4M10 20 20 10M4 8.5 8.5 4M15.5 20l4.5-4.5"/>',
  hardware: '<path d="m4.5 19.5 8-8"/><path d="m10.5 7.5 3.5-3.5 6 6-3.5 3.5z"/>',
  category:
    '<path d="M12 3.5 16 10H8z"/><circle cx="16.8" cy="16.8" r="3.3"/><rect x="4" y="13.5" width="6.6" height="6.6" rx="1"/>',
  sticker:
    '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2V13l-6.5 6.5h-6.5a2 2 0 0 1-2-2z"/><path d="M13 19.5V15a2 2 0 0 1 2-2h4.5"/>',

  // Products (fallback when a material has no thumbnail image)
  mug: '<path d="M5 6.5h11v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 9h1.5a2.6 2.6 0 0 1 0 5.2H16"/>',
  cold_cup: '<path d="M6.5 7.5h11l-1.4 12.2a1 1 0 0 1-1 .8H8.9a1 1 0 0 1-1-.8z"/><path d="M6 7.5h12M12.5 7.5 14.5 2.5"/>',
  tumbler: '<path d="M7 7h10l-1.3 13a1 1 0 0 1-1 .9H9.3a1 1 0 0 1-1-.9z"/><path d="M6.5 7h11V5.5h-11zM12 5.5V2"/>',
};

/** Old Material Symbols names still in data or markup → the closest icon here. */
const ALIASES = {
  breakfast_dining: "mug",
  window: "cold_cup",
  rebase: "tumbler",
  shopping_bag: "tumbler",
  stamp: "sticker",
  approval: "sticker",
};

export function hasIcon(name) {
  const key = String(name ?? "").trim();
  return key in ICONS || key in ALIASES;
}

/**
 * SVG markup for an icon. Decorative by default (aria-hidden); pass `label` for a meaningful one.
 * @param {string} name
 * @param {{ label?: string, className?: string }} [opts]
 */
export function iconSvg(name, { label = "", className = "" } = {}) {
  const key = String(name ?? "").trim();
  const body = ICONS[key] ?? ICONS[ALIASES[key]] ?? ICONS.help_outline;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : 'aria-hidden="true" focusable="false"';
  const cls = ["material-symbols-outlined", "ch-icon", className].filter(Boolean).join(" ");
  return `<svg class="${cls}" data-icon="${key}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}
