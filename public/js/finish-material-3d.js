/**
 * Turn a finish render spec (finish-render-spec.js) into a THREE.MeshPhysicalMaterial.
 *
 * Colour maps (gradients, speckle, factory-photo patterns) are generated per finish and owned by
 * the material: call disposeFinishMaterial() when replacing it. Surface maps (glitter flakes,
 * powder, hammered, …) are procedural and shared across finishes.
 */
import * as THREE from "three";

const WHITE = new THREE.Color(0xffffff);

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Deterministic noise so procedural maps look the same on every load. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function colorTexture(c, { repeatX = 1, mirror = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(repeatX, 1);
  t.anisotropy = 8;
  return t;
}

function gradientMap({ type, stops }) {
  const size = 512;
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const clean = stops.filter(Boolean);
  let g;
  if (type === "diagonal") g = ctx.createLinearGradient(0, size, size, 0);
  else g = ctx.createLinearGradient(0, 0, 0, size);
  if (type === "split") {
    g.addColorStop(0, clean[0]);
    g.addColorStop(0.49, clean[0]);
    g.addColorStop(0.51, clean[1] ?? clean[0]);
    g.addColorStop(1, clean[1] ?? clean[0]);
  } else {
    clean.forEach((stop, i) => g.addColorStop(clean.length === 1 ? 0 : i / (clean.length - 1), stop));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Mirrored wrap keeps diagonals continuous around the body with no seam.
  return colorTexture(c, type === "diagonal" ? { repeatX: 2, mirror: true } : {});
}

function speckleMap(baseColor, { color, density, multicolor }) {
  const size = 512;
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const rand = rng(7);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const palette = multicolor ? ["#f4f2ee", "#e25d4a", "#3c8dd9", "#f2c94c", "#4caf7a"] : [color];
  const count = Math.round(1800 * density);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 0.8 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  return colorTexture(c, { repeatX: 3 });
}

/** Centre share of the product crop used as texture; the outer band holds silhouettes and rims. */
const PHOTO_CORE = 0.6;

/** Draw the centre of the product crop of a factory photo into a tileable canvas. */
function loadPhotoMap(url, crop, aspect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const [cx, cy, cw, ch] = crop;
      const w = cw * PHOTO_CORE;
      const h = ch * PHOTO_CORE;
      const x = cx + (cw - w) / 2;
      const y = cy + (ch - h) / 2;
      const sw = Math.max(1, Math.round(w * img.naturalWidth));
      const sh = Math.max(1, Math.round(h * img.naturalHeight));
      const c = canvas(512, Math.round(512 * (sh / sw)) || 512);
      c.getContext("2d").drawImage(img, x * img.naturalWidth, y * img.naturalHeight, sw, sh, 0, 0, c.width, c.height);
      const tiles = Math.max(1, Math.round(aspect * (sh / sw)));
      resolve(colorTexture(c, { repeatX: tiles, mirror: true }));
    };
    img.onerror = () => reject(new Error(`Photo texture failed: ${url}`));
    img.src = url;
  });
}

const surfaceCache = new Map();

function surfaceMap(kind, draw, repeat) {
  const key = `${kind}:${repeat.join("x")}`;
  if (surfaceCache.has(key)) return surfaceCache.get(key);
  const c = canvas(512, 512);
  draw(c.getContext("2d"), 512, rng(kind.length * 97 + 13));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  surfaceCache.set(key, t);
  return t;
}

/** Glitter / metallic flakes: tiny tiles with random normals catch the light independently. */
function flakeNormalMap(density) {
  return surfaceMap(
    `flakes-${density}`,
    (ctx, size, rand) => {
      ctx.fillStyle = "rgb(128,128,255)";
      ctx.fillRect(0, 0, size, size);
      const count = Math.round(size * size * 0.06 * density);
      for (let i = 0; i < count; i++) {
        const r = Math.round(128 + (rand() - 0.5) * 220);
        const g = Math.round(128 + (rand() - 0.5) * 220);
        ctx.fillStyle = `rgb(${r},${g},235)`;
        const s = 1 + Math.round(rand() * 2);
        ctx.fillRect(rand() * size, rand() * size, s, s);
      }
    },
    [6, 6],
  );
}

const BUMPS = {
  powder: [[8, 8], (ctx, size, rand) => noise(ctx, size, rand, 1, 40)],
  sand: [[5, 5], (ctx, size, rand) => noise(ctx, size, rand, 2, 90)],
  leather: [[4, 4], (ctx, size, rand) => cells(ctx, size, rand, 220, false)],
  hammered: [[3, 2], (ctx, size, rand) => cells(ctx, size, rand, 60, true)],
  bubbles: [[3, 3], (ctx, size, rand) => rings(ctx, size, rand)],
  ribbed: [[24, 1], (ctx, size) => ribs(ctx, size)],
  cracks: [[2, 2], (ctx, size, rand) => cracks(ctx, size, rand)],
};

function noise(ctx, size, rand, cell, amp) {
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const v = Math.round(128 + (rand() - 0.5) * amp);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function cells(ctx, size, rand, count, dimple) {
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (dimple ? 28 : 10) + rand() * (dimple ? 26 : 10);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dimple ? "rgba(70,70,70,0.9)" : "rgba(110,110,110,0.7)");
    g.addColorStop(1, "rgba(150,150,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function rings(ctx, size, rand) {
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgb(200,200,200)";
  for (let i = 0; i < 140; i++) {
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 2 + rand() * 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function ribs(ctx, size) {
  for (let x = 0; x < size; x++) {
    const v = Math.round(128 + 110 * Math.sin((x / size) * Math.PI * 2));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, size);
  }
}

function cracks(ctx, size, rand) {
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgb(60,60,60)";
  for (let i = 0; i < 45; i++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.lineWidth = 0.6 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.5) * 70;
      y += (rand() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function bumpMap(kind) {
  const entry = BUMPS[kind];
  return entry ? surfaceMap(`bump-${kind}`, entry[1], entry[0]) : null;
}

/**
 * @param {object} spec from finishRenderSpec()
 * @param {{ photoUrl?: string, aspect?: number }} [opts] aspect = body circumference / height
 * @returns {Promise<THREE.MeshPhysicalMaterial>}
 */
export async function createFinishMaterial(spec, { photoUrl = null, aspect = 1.4 } = {}) {
  const color = new THREE.Color(spec.color);
  const owned = [];
  let map = null;

  if (spec.photo && photoUrl) {
    try {
      map = await loadPhotoMap(photoUrl, spec.photo.crop, aspect);
    } catch (err) {
      console.warn(err.message);
    }
  }
  if (!map && spec.gradient) map = gradientMap(spec.gradient);
  if (!map && spec.speckle) map = speckleMap(spec.color, spec.speckle);
  if (map) owned.push(map);

  const material = new THREE.MeshPhysicalMaterial({
    color: map ? WHITE : color,
    map,
    metalness: spec.metalness,
    roughness: spec.roughness,
    clearcoat: spec.clearcoat,
    clearcoatRoughness: spec.clearcoatRoughness,
    transmission: spec.transmission,
    thickness: spec.thickness,
    ior: spec.ior,
    iridescence: spec.iridescence,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 720],
    sheen: spec.sheen,
    sheenColor: color.clone().lerp(WHITE, 0.5),
    sheenRoughness: 0.5,
    emissive: spec.emissiveIntensity ? color : new THREE.Color(0x000000),
    emissiveIntensity: spec.emissiveIntensity,
    envMapIntensity: spec.metalness > 0.8 ? 1.2 : 1,
  });

  // Tinted glass / clear plastic: colour comes from absorption through the wall, so a short
  // attenuation distance (scene units; walls are ~0.03) keeps the tint visible against white.
  if (spec.transmission > 0) {
    material.attenuationColor = color;
    material.attenuationDistance = spec.attenuationDistance;
    material.color = map ? WHITE : color.clone().lerp(WHITE, 0.15);
  }
  if (spec.flakes) {
    material.normalMap = flakeNormalMap(spec.flakes.density);
    material.normalScale.set(0.35, 0.35);
  }
  const bump = spec.bump ? bumpMap(spec.bump) : null;
  if (bump) {
    material.bumpMap = bump;
    material.bumpScale = spec.bump === "powder" ? 0.6 : 2;
  }
  material.userData.ownedTextures = owned;
  material.userData.spec = spec;
  return material;
}

export function disposeFinishMaterial(material) {
  if (!material) return;
  for (const t of material.userData?.ownedTextures ?? []) t.dispose();
  material.dispose();
}
