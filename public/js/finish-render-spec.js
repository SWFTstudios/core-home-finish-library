/**
 * Finish → physical material description for the 3D product preview.
 *
 * Pure data (no Three.js) so the rules can be unit-tested. Inputs:
 *   - the catalog finish (name, process, material)
 *   - sampled colours from public/data/finish-render.json (scripts/extract-finish-colors.mjs)
 *   - optional hand corrections from public/data/finish-render-overrides.json
 *
 * Output fields map 1:1 onto THREE.MeshPhysicalMaterial plus a few texture hints:
 *   gradient  { type: "vertical" | "diagonal" | "split", stops: [hex, ...] }
 *   flakes    { density, tint }   glitter / sparkle / metallic paint normal map
 *   speckle   { color, density }  dots painted into the colour map
 *   bump      "powder" | "leather" | "hammered" | "ribbed" | "bubbles" | "cracks" | "sand"
 *   photo     { crop: [x, y, w, h] }  use the factory photo itself as the colour map
 *   grain     0–1 fine colour variation (orange peel, glaze pooling) on flat colour maps
 */

const STEEL = "#c9ccd0";

/** Paint over steel is a dielectric coating; only bare or plated metal is metallic. */
const MATERIAL_BASE = {
  stainless_steel: { metalness: 0, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.2 },
  ceramic: { metalness: 0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 },
  glass: { metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.06, ior: 1.5, attenuationDistance: 0.1 },
  plastic: {
    metalness: 0,
    roughness: 0.12,
    transmission: 0.55,
    thickness: 0.05,
    ior: 1.49,
    clearcoat: 0.5,
    attenuationDistance: 0.03,
  },
};

/** Finishes whose look is a pattern no single colour can describe; drawn from the photo. */
const PATTERN =
  /splatter|drip|swirl|marbl|reactive|freeform|transfer|decal|silk screen|3d print|laser engraved|leafed|raindrop|filigree|debris|colou?red spots|colou?red powder|two color clay|sand clay|scented|sheer 3d|geo electroplating/;

/**
 * Finishes whose surface texture (flake, grit, crackle, mottling) is best shown by the photo
 * itself. The photo is de-lit before use, so its shading does not fight the product lighting.
 */
const TEXTURED_PHOTO = /glitter|sparkle|speckle|sand|clay|crackle|crack|rustic|leather|marbl|terrazzo|stone|granite|confetti|bubble/;

const has = (re, s) => re.test(s);

function metalTint(name, sampled) {
  if (/rose ?gold/.test(name)) return "#e3b19c";
  if (/gold|gilded/.test(name)) return "#e2bf72";
  if (/dark silver|black/.test(name)) return "#4a4c50";
  if (/silver|mirror|high gloss|hydroform|reflective|laser/.test(name)) return STEEL;
  return sampled ?? STEEL;
}

function gradientFor(name, sampled) {
  if (!sampled) return null;
  const { top, middle, bottom, left, right, primary, secondary } = sampled;
  if (/diagonal/.test(name)) return { type: "diagonal", stops: [left ?? top, right ?? bottom] };
  if (/triple/.test(name) && /ombr/.test(name)) return { type: "vertical", stops: [top, middle, bottom] };
  if (/vertical/.test(name) && /ombr/.test(name)) return { type: "diagonal", stops: [left ?? top, right ?? bottom], angle: 90 };
  if (/ombr|gradient/.test(name)) return { type: "vertical", stops: [top, bottom] };
  if (/2-tone|two tone|two-tone|half /.test(name)) {
    return { type: "split", stops: [top ?? primary, bottom ?? secondary ?? primary] };
  }
  return null;
}

/**
 * @param {object} finish catalog finish
 * @param {string} materialSlug
 * @param {object} [sampled] entry from finish-render.json
 * @param {object} [override] entry from finish-render-overrides.json (wins over every rule)
 */
export function finishRenderSpec(finish, materialSlug, sampled = null, override = null) {
  const name = String(finish?.name ?? "")
    .toLowerCase()
    .replace(/é/g, "e")
    .replace(/[–—]/g, "-");
  const process = String(finish?.finishProcess ?? finish?.category ?? "").toLowerCase();
  const base = MATERIAL_BASE[materialSlug] ?? MATERIAL_BASE.stainless_steel;
  const spec = {
    family: "paint",
    color: sampled?.primary ?? finish?.hexColor ?? STEEL,
    color2: sampled?.secondary ?? null,
    metalness: base.metalness,
    roughness: base.roughness,
    clearcoat: base.clearcoat ?? 0,
    clearcoatRoughness: base.clearcoatRoughness ?? 0.1,
    transmission: base.transmission ?? 0,
    thickness: base.thickness ?? 0,
    attenuationDistance: base.attenuationDistance ?? 0.1,
    ior: base.ior ?? 1.5,
    iridescence: 0,
    sheen: 0,
    emissiveIntensity: 0,
    gradient: null,
    flakes: null,
    speckle: null,
    bump: null,
    photo: null,
    grain: 0.05,
  };

  // Surface sheen level. Order matters: "semi-matte" must win over "matte" and "gloss".
  if (has(/semi-matte|semi gloss|semi-gloss|satin/, name)) Object.assign(spec, { roughness: 0.45, clearcoat: 0.15 });
  else if (has(/\bmatte\b|dull|rubber/, name)) Object.assign(spec, { roughness: 0.82, clearcoat: 0 });
  else if (has(/gloss|uv|lacquer|glossy/, name)) Object.assign(spec, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });

  if (has(/rubber/, name)) Object.assign(spec, { family: "rubber", roughness: 0.9, sheen: 0.5 });
  if (has(/powder/, name) || has(/powder/, process)) {
    Object.assign(spec, { family: "powder", roughness: Math.max(spec.roughness, 0.62), bump: "powder" });
  }
  if (has(/metallic/, name)) {
    Object.assign(spec, { family: "metallic-paint", metalness: 0.55, roughness: Math.min(spec.roughness, 0.4) });
    spec.flakes = { density: 0.35, tint: null };
  }
  if (has(/glitter|sparkle|shimmer/, name)) {
    spec.family = "glitter";
    spec.flakes = { density: has(/shimmer/, name) ? 0.4 : 0.85, tint: null };
    spec.metalness = Math.max(spec.metalness, 0.45);
    spec.clearcoat = 1;
    spec.clearcoatRoughness = 0.05;
  }
  if (has(/speckle/, name)) {
    spec.family = "speckle";
    const color = has(/white/, name) ? "#f4f2ee" : sampled?.secondary ?? "#f4f2ee";
    spec.speckle = { color, density: 0.5, multicolor: has(/colou?r speckle/, name) };
  }
  if (has(/pearl/, name)) Object.assign(spec, { family: "pearl", sheen: 1, iridescence: 0.35, roughness: 0.3 });
  if (has(/iridescen|chameleon|colou?r changing|colou?r shift|rainbow/, name)) {
    Object.assign(spec, { family: "iridescent", iridescence: 1 });
  }
  if (has(/frosted/, name)) Object.assign(spec, { family: "frosted", roughness: 0.6, clearcoat: 0, sheen: 0.3 });
  if (has(/leather/, name)) Object.assign(spec, { family: "leather", roughness: 0.7, bump: "leather" });
  if (has(/rustic|vintage|textured|sand texture/, name)) spec.bump = spec.bump ?? "sand";
  if (has(/glow in the dark/, name)) spec.emissiveIntensity = 0.12;

  // Bare / plated metal: steel itself shows, or a thin metal coating.
  const bareMetal =
    has(/mirror|hydroform|ionplating|\bpvd\b|electroplat|plating|gilded|reflective|laser engraved/, name) ||
    (has(/high gloss/, name) && has(/buff/, process));
  if (bareMetal && !has(/powder coat pvd reveal/, name)) {
    Object.assign(spec, {
      family: "metal",
      metalness: 1,
      roughness: has(/mirror|high gloss|reflective/, name) ? 0.04 : 0.18,
      clearcoat: 0,
      transmission: 0,
      sheen: 0,
      color: metalTint(name, /pvd|ionplating|electroplat|plating/.test(name) ? sampled?.primary : null),
    });
  }
  if (has(/powder coat pvd reveal/, name)) {
    spec.family = "pvd-reveal";
    spec.color2 = metalTint(name.replace(/.*reveal - /, ""), sampled?.secondary);
    if (/rainbow/.test(name)) spec.iridescence = 1;
  }

  // Glass and clear plastic: the tint is the colour, the body stays see-through.
  if (materialSlug === "glass") {
    if (has(/frosted|sandblast|satin/, name)) Object.assign(spec, { roughness: has(/satin/, name) ? 0.35 : 0.6 });
    if (has(/opaque spray/, name)) Object.assign(spec, { transmission: 0, roughness: 0.4, family: "paint" });
    if (has(/metal plating/, name)) Object.assign(spec, { transmission: 0 });
    if (has(/bubble/, name)) spec.bump = "bubbles";
    if (has(/ribbed/, name)) spec.bump = "ribbed";
    if (has(/hammered/, name)) spec.bump = "hammered";
    if (has(/ice crack/, name)) spec.bump = "cracks";
  }
  if (materialSlug === "plastic") {
    if (has(/pearl|rubber|uv|colou?r shift/, name)) spec.transmission = 0;
    if (has(/ice crackle/, name)) spec.bump = "cracks";
  }
  if (materialSlug === "ceramic" && has(/clay|sand/, name)) Object.assign(spec, { roughness: 0.88, clearcoat: 0, bump: "sand" });

  spec.gradient = gradientFor(name, sampled);
  if (spec.family === "pvd-reveal" && sampled) {
    spec.gradient = { type: "split", stops: [sampled.top ?? spec.color, spec.color2] };
  }

  // Flat colour maps get a little variation; metal and glass stay clean.
  if (spec.family === "metal" || spec.transmission > 0.5) spec.grain = 0;
  else if (spec.roughness > 0.6) spec.grain = 0.08;
  else if (spec.roughness < 0.2) spec.grain = 0.03;

  if ((has(PATTERN, name) || has(TEXTURED_PHOTO, name)) && sampled?.crop) {
    spec.photo = { crop: sampled.crop };
    spec.gradient = null;
    spec.speckle = null;
  }

  return override ? { ...spec, ...override } : spec;
}

/** Look up sampled colours and overrides for one finish. */
export function renderDataFor(renderData, overrides, materialSlug, slug) {
  const key = `${materialSlug}/${slug}`;
  return {
    sampled: renderData?.finishes?.[key] ?? null,
    override: overrides?.finishes?.[key] ?? null,
  };
}
