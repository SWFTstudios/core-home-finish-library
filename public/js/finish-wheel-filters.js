/**
 * Finish wheel browse helpers — search, filter, and sort for the configurator dial.
 */
import { inferStyleFamily, processMeta, processSlug, STYLE_FAMILIES } from "./library-grouping.js";

export const FINISH_SORT_OPTIONS = [
  { id: "name-az", label: "Name A → Z" },
  { id: "name-za", label: "Name Z → A" },
  { id: "color-hue", label: "Color (spectrum)" },
  { id: "color-light", label: "Light → dark" },
  { id: "color-dark", label: "Dark → light" },
  { id: "process", label: "Process" },
];

export const COLOR_GROUPS = [
  { id: "", label: "All colors" },
  { id: "multi", label: "Multi-tone / effects" },
  { id: "neutral", label: "Neutrals & grays" },
  { id: "red", label: "Reds" },
  { id: "orange", label: "Oranges" },
  { id: "yellow", label: "Yellows" },
  { id: "green", label: "Greens" },
  { id: "cyan", label: "Cyans & teals" },
  { id: "blue", label: "Blues" },
  { id: "purple", label: "Purples" },
  { id: "pink", label: "Pinks & magentas" },
];

const STYLE_FILTER_FAMILIES = STYLE_FAMILIES.filter((f) => f.id !== "other");

function hexToRgb(hex) {
  const raw = String(hex ?? "").trim();
  let h = raw;
  if (h.startsWith("hsl")) return null;
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function finishColorMetrics(finish) {
  const rgb = hexToRgb(finish?.hexColor);
  if (!rgb) return { hue: 360, sat: 0, light: 0.5, group: inferColorGroup(finish) };
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return { hue: h, sat: s, light: l, group: inferColorGroup(finish, h, s, l) };
}

export function inferColorGroup(finish, hue = null, sat = null, light = null) {
  const name = String(finish?.name ?? "");
  if (/2-tone|2-color|ombr|gradient|speckle|glitter|iridescent|chameleon|diagonal/i.test(name)) {
    return "multi";
  }

  let h = hue;
  let s = sat;
  let l = light;
  if (h == null || s == null || l == null) {
    const rgb = hexToRgb(finish?.hexColor);
    if (!rgb) return "neutral";
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    h = hsl.h;
    s = hsl.s;
    l = hsl.l;
  }

  if (s < 0.14 && (l > 0.72 || l < 0.28)) return "neutral";
  if (s < 0.1) return "neutral";

  if (h < 12 || h >= 348) return "red";
  if (h < 38) return "orange";
  if (h < 68) return "yellow";
  if (h < 155) return "green";
  if (h < 195) return "cyan";
  if (h < 250) return "blue";
  if (h < 300) return "purple";
  return "pink";
}

export function uniqueFinishProcesses(finishes) {
  const seen = new Map();
  for (const finish of finishes) {
    const process = finish.finishProcess || finish.category || "Other";
    const slug = processSlug(process);
    if (!seen.has(slug)) seen.set(slug, process);
  }
  return [...seen.entries()]
    .map(([slug, label]) => ({ slug, label, order: processMeta(label).order }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function filterFinishes(finishes, { query = "", process = "", styleFamily = "", colorGroup = "" } = {}) {
  const needle = String(query ?? "").trim().toLowerCase();
  return finishes.filter((finish) => {
    if (process && processSlug(finish.finishProcess || finish.category) !== process) return false;
    if (styleFamily && inferStyleFamily(finish.name) !== styleFamily) return false;
    if (colorGroup && inferColorGroup(finish) !== colorGroup) return false;
    if (!needle) return true;
    const name = String(finish.name ?? "").toLowerCase();
    const slug = String(finish.slug ?? "").toLowerCase();
    const category = String(finish.category ?? finish.finishProcess ?? "").toLowerCase();
    return name.includes(needle) || slug.includes(needle) || category.includes(needle);
  });
}

export function sortFinishes(finishes, sortId = "name-az") {
  const list = [...finishes];
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  switch (sortId) {
    case "name-za":
      return list.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
    case "color-hue":
      return list.sort((a, b) => {
        const ca = finishColorMetrics(a);
        const cb = finishColorMetrics(b);
        if (ca.group !== cb.group) {
          const order = COLOR_GROUPS.map((g) => g.id).indexOf(ca.group) - COLOR_GROUPS.map((g) => g.id).indexOf(cb.group);
          if (order !== 0) return order;
        }
        if (ca.hue !== cb.hue) return ca.hue - cb.hue;
        return byName(a, b);
      });
    case "color-light":
      return list.sort((a, b) => {
        const la = finishColorMetrics(a).light;
        const lb = finishColorMetrics(b).light;
        if (la !== lb) return lb - la;
        return byName(a, b);
      });
    case "color-dark":
      return list.sort((a, b) => {
        const la = finishColorMetrics(a).light;
        const lb = finishColorMetrics(b).light;
        if (la !== lb) return la - lb;
        return byName(a, b);
      });
    case "process":
      return list.sort((a, b) => {
        const pa = processMeta(a.finishProcess || a.category).order;
        const pb = processMeta(b.finishProcess || b.category).order;
        if (pa !== pb) return pa - pb;
        return byName(a, b);
      });
    default:
      return list.sort(byName);
  }
}

export function browseFinishes(finishes, options = {}) {
  const filtered = filterFinishes(finishes, options);
  return sortFinishes(filtered, options.sort ?? "name-az");
}

export function focusIndexForBrowse(finishes, query) {
  if (!finishes.length) return 0;
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return 0;
  const exact = finishes.findIndex((f) => f.name.toLowerCase() === needle);
  if (exact >= 0) return exact;
  const prefix = finishes.findIndex((f) => f.name.toLowerCase().startsWith(needle));
  if (prefix >= 0) return prefix;
  return 0;
}

export { STYLE_FILTER_FAMILIES };
