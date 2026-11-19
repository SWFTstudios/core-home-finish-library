/**
 * Hero product side profiles, in millimetres (radius, height), one per material.
 * No Three.js here: the 2D view needs the same proportions to wrap finishes.
 *
 * Profiles were traced from the Figma product images at typical sizes; replace the values once PD
 * confirms real dimensions, then re-run `npm run shells:export`.
 */
export const PROFILES = {
  stainless_steel: {
    label: "24 oz cold cup tumbler",
    outer: [[30, 0], [33, 0.8], [34.5, 4], [46, 210], [46.5, 214]],
    wall: 2.5,
    innerBottom: 8,
    lid: { radius: 47.5, height: 16, top: 44 },
    straw: { radius: 3.6, top: 300 },
    logoBand: [0.38, 0.66],
    // Graphic application badge: diameter (mm) and centre height (0 = base, 1 = lip).
    badge: { diameter: 62, center: 0.57 },
  },
  ceramic: {
    label: "14 oz mug",
    outer: [[38, 0], [44, 0.6], [46.5, 3], [47.5, 8], [47.5, 88], [47, 90]],
    wall: 4,
    innerBottom: 8,
    // D-shaped handle: centreline points (x from axis, y), swept with a round tube.
    handle: { tube: 6, path: [[45, 76], [60, 78], [72, 66], [73, 44], [63, 26], [45, 22]] },
    logoBand: [0.3, 0.72],
    // Graphic application badge: diameter (mm) and centre height (0 = base, 1 = lip).
    badge: { diameter: 44, center: 0.5 },
  },
  glass: {
    label: "16 oz glass cold cup",
    outer: [[33, 0], [36, 1.5], [37, 6], [41, 172], [41, 175]],
    wall: 3,
    innerBottom: 14,
    lid: { radius: 43, height: 12, top: 41 },
    straw: { radius: 3.6, top: 255 },
    logoBand: [0.4, 0.68],
    // Graphic application badge: diameter (mm) and centre height (0 = base, 1 = lip).
    badge: { diameter: 50, center: 0.52 },
  },
  plastic: {
    label: "24 oz double-wall tumbler",
    outer: [[29, 0], [32, 1.5], [33, 5], [45, 200], [45.5, 205]],
    wall: 1.6,
    innerBottom: 6,
    liner: { gap: 4, bottom: 16 },
    lid: { radius: 46.5, height: 22, top: 43 },
    straw: { radius: 3.6, top: 290 },
    logoBand: [0.38, 0.66],
    // Graphic application badge: diameter (mm) and centre height (0 = base, 1 = lip).
    badge: { diameter: 60, center: 0.56 },
  },
};

/** Body circumference / body height: how many times wider than tall the unrolled surface is. */
export function surfaceAspect(materialSlug) {
  const profile = PROFILES[materialSlug] ?? PROFILES.stainless_steel;
  const height = profile.outer[profile.outer.length - 1][1];
  const radius = Math.max(...profile.outer.map(([r]) => r));
  return (2 * Math.PI * radius) / height;
}

/** Outer radius (mm) at height fraction v (0 = base, 1 = lip). */
export function surfaceRadius(materialSlug, v) {
  const outer = (PROFILES[materialSlug] ?? PROFILES.stainless_steel).outer;
  const y = v * outer[outer.length - 1][1];
  for (let i = 1; i < outer.length; i++) {
    const [r0, y0] = outer[i - 1];
    const [r1, y1] = outer[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(y1 - y0, 1e-6);
  }
  return outer[outer.length - 1][0];
}

/** Badge placement for the graphic application preview, in surface units. */
export function badgePlacement(materialSlug) {
  const profile = PROFILES[materialSlug] ?? PROFILES.stainless_steel;
  const height = profile.outer[profile.outer.length - 1][1];
  const { diameter, center } = profile.badge;
  return { diameter, center, height, radius: (v) => surfaceRadius(materialSlug, v) };
}
