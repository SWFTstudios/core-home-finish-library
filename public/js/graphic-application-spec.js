/**
 * Graphic application → how the logo looks on the product.
 *
 * Pure data (no DOM / Three.js), shared by the 2D compositor, the 3D decal and the shelf
 * thumbnails. The Core Home badge (assets/brand) is the "your logo here" artwork for every
 * account; each application changes its feel, so designers and PD can see which printing
 * methods a finish supports and roughly what they look like (Figma: GraphicApplication_*).
 *
 * Output fields:
 *   kind        "ink" | "metal" | "frost" | "relief" | "clay" — what the logo area is made of
 *   color       ink / metal colour ("auto" = contrast with the finish)
 *   roughness, metalness, clearcoat   like finishRenderSpec
 *   opacity     0–1 coverage of the ink layer (frost and translucent prints < 1)
 *   relief      height of the edge: > 0 raised, < 0 debossed / etched, 0 flat
 *   edge        "crisp" | "soft" | "brush" — edge quality of the print
 */

const STEEL = "#c9ccd0";
const INK_DARK = "#2e3136";
const INK_LIGHT = "#f3f2ee";

const STYLES = {
  // Laser removes the coating down to bare steel; on glass it frosts the surface.
  "graphic.laserEngraved": { kind: "metal", color: STEEL, roughness: 0.32, metalness: 1, relief: -0.25, edge: "crisp" },
  "graphic.laserEtched": { kind: "frost", color: "#f4f6f8", roughness: 0.75, opacity: 0.7, relief: -0.2, edge: "crisp" },
  "graphic.engraving": { kind: "frost", color: "#f4f6f8", roughness: 0.8, opacity: 0.8, relief: -0.45, edge: "crisp" },
  "graphic.sandblastEtch": { kind: "frost", color: "#f1efe9", roughness: 0.85, opacity: 0.6, relief: -0.15, edge: "soft" },
  // Fired / applied decals: thin printed film with a satin sheen.
  "graphic.laserDecal": { kind: "ink", color: "auto", roughness: 0.25, clearcoat: 0.6, relief: 0.05, edge: "crisp" },
  "graphic.waterDecal": { kind: "ink", color: "auto", roughness: 0.3, clearcoat: 0.5, relief: 0.06, edge: "crisp" },
  "graphic.waterSlideDecal": { kind: "ink", color: "auto", roughness: 0.3, clearcoat: 0.5, relief: 0.06, edge: "crisp" },
  "graphic.decal": { kind: "ink", color: "auto", roughness: 0.3, clearcoat: 0.5, relief: 0.06, edge: "crisp" },
  "graphic.icon": { kind: "ink", color: "auto", roughness: 0.3, clearcoat: 0.5, relief: 0.06, edge: "crisp" },
  "graphic.heatTransfer": { kind: "ink", color: "auto", roughness: 0.45, clearcoat: 0.2, relief: 0.08, edge: "crisp" },
  // Screen and pad printing: flat ink, matte; pad print edges are a touch softer.
  "graphic.silkScreen": { kind: "ink", color: "auto", roughness: 0.7, relief: 0.04, edge: "crisp" },
  "graphic.silkscreen": { kind: "ink", color: "auto", roughness: 0.7, relief: 0.04, edge: "crisp" },
  "graphic.silkPrinting": { kind: "ink", color: "auto", roughness: 0.7, relief: 0.04, edge: "crisp" },
  "graphic.padPrinting": { kind: "ink", color: "auto", roughness: 0.6, relief: 0.02, edge: "soft" },
  "graphic.digitalDirectPrint": { kind: "ink", color: "auto", roughness: 0.55, relief: 0.02, edge: "crisp" },
  // UV / 3D prints: glossy and raised.
  "graphic.partial3dPrint": { kind: "ink", color: "auto", roughness: 0.08, clearcoat: 1, relief: 0.6, edge: "crisp" },
  "graphic.uvDigital": { kind: "ink", color: "auto", roughness: 0.12, clearcoat: 1, relief: 0.25, edge: "crisp" },
  "graphic.uvInkjet": { kind: "ink", color: "auto", roughness: 0.12, clearcoat: 1, relief: 0.2, edge: "crisp" },
  "graphic.uvJet": { kind: "ink", color: "auto", roughness: 0.1, clearcoat: 1, relief: 0.3, edge: "crisp" },
  "graphic.raisedEnamel": { kind: "ink", color: "auto", roughness: 0.1, clearcoat: 1, relief: 0.7, edge: "soft" },
  // Metallic foils and lustre.
  "graphic.hotStamping": { kind: "metal", color: "#d8d9db", roughness: 0.12, metalness: 1, relief: 0.05, edge: "crisp" },
  "graphic.preciousMetalLustre": { kind: "metal", color: "#e2bf72", roughness: 0.08, metalness: 1, relief: 0.03, edge: "crisp" },
  // No ink: the shape is pressed into / out of the body.
  "graphic.embossDeboss": { kind: "relief", color: null, roughness: null, relief: 0.8, edge: "soft" },
  // Ceramic: hand-applied ink; wax resist leaves the logo as unglazed clay.
  "graphic.handPaint": { kind: "ink", color: "auto", roughness: 0.35, clearcoat: 0.3, relief: 0.05, edge: "brush" },
  "graphic.waxResist": { kind: "clay", color: "#cdb994", roughness: 0.92, relief: -0.12, edge: "soft" },
};

const DEFAULT_STYLE = { kind: "ink", color: "auto", roughness: 0.5, relief: 0.03, edge: "crisp" };

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return 0.6;
  const n = parseInt(m[1], 16);
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Ink that reads against the finish: light ink on dark finishes, charcoal on light ones. */
export function contrastInk(finishColor) {
  return luminance(finishColor) < 0.18 ? INK_LIGHT : INK_DARK;
}

/**
 * @param {object|null} graphic catalog graphicApplicationTypes row
 * @param {object|null} finishSpec finishRenderSpec() of the body finish (for contrast / emboss)
 * @returns {object|null} null when there is no graphic
 */
export function graphicRenderSpec(graphic, finishSpec = null) {
  if (!graphic) return null;
  const style = STYLES[graphic.templateKey] ?? DEFAULT_STYLE;
  const base = finishSpec?.color ?? "#c9ccd0";
  const spec = {
    key: graphic.templateKey ?? null,
    label: graphic.uiLabel ?? graphic.label ?? "",
    kind: style.kind,
    color: style.color === "auto" ? contrastInk(base) : style.color,
    roughness: style.roughness ?? finishSpec?.roughness ?? 0.4,
    metalness: style.metalness ?? 0,
    clearcoat: style.clearcoat ?? 0,
    opacity: style.opacity ?? 1,
    relief: style.relief ?? 0,
    edge: style.edge ?? "crisp",
  };
  // Emboss / deboss keeps the body finish; only the surface height changes.
  if (spec.kind === "relief") {
    spec.color = base;
    spec.roughness = finishSpec?.roughness ?? 0.4;
    spec.metalness = finishSpec?.metalness ?? 0;
    spec.clearcoat = finishSpec?.clearcoat ?? 0;
  }
  // Laser on a bare / plated metal finish shows a darker oxidised mark instead of more steel.
  if (spec.key === "graphic.laserEngraved" && (finishSpec?.metalness ?? 0) > 0.8) {
    Object.assign(spec, { color: "#5b5d61", roughness: 0.55, metalness: 0.6 });
  }
  return spec;
}
