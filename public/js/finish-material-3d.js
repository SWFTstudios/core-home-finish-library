/**
 * Turn a finish render spec (finish-render-spec.js) into a THREE.MeshPhysicalMaterial.
 *
 * Colour maps come from buildAlbedo() (finish-albedo.js), the same map the 2D shells use, and are
 * owned by the material: call disposeFinishMaterial() when replacing it. Surface maps (glitter flakes,
 * powder, hammered, …) are procedural and shared across finishes.
 */
import * as THREE from "three";
import { buildAlbedo, rng } from "./finish-albedo.js";
import { badgeMask, maskCanvas } from "./logo-art.js";
import { BADGE_MARGIN } from "./product-models-3d.js";

const WHITE = new THREE.Color(0xffffff);

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
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

  let transmissionMap = null;
  if ((spec.photo && photoUrl) || spec.gradient || spec.speckle || spec.grain > 0) {
    const albedo = await buildAlbedo(spec, { photoUrl, aspect });
    let source = albedo.canvas;
    if (albedo.translucent) {
      // Glass photo map: colour over the glass tint, and alpha → where the glass stays clear.
      const { width: w, height: h } = albedo.canvas;
      const colour = canvas(w, h);
      const cctx = colour.getContext("2d");
      cctx.fillStyle = spec.color;
      cctx.fillRect(0, 0, w, h);
      cctx.drawImage(albedo.canvas, 0, 0);
      source = colour;
      const clear = canvas(w, h);
      const tctx = clear.getContext("2d");
      const src = albedo.canvas.getContext("2d").getImageData(0, 0, w, h);
      const out = tctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const opaque = Math.min(1, Math.max(0, (src.data[i * 4 + 3] / 255 - 0.2) / 0.6));
        const v = Math.round((1 - opaque) * 255);
        out.data.set([v, v, v, 255], i * 4);
      }
      tctx.putImageData(out, 0, 0);
      transmissionMap = new THREE.CanvasTexture(clear);
      transmissionMap.wrapS = THREE.RepeatWrapping;
      transmissionMap.wrapT = THREE.ClampToEdgeWrapping;
      owned.push(transmissionMap);
    }
    map = new THREE.CanvasTexture(source);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.anisotropy = 8;
    owned.push(map);
  }

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
  if (transmissionMap) material.transmissionMap = transmissionMap;
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

/**
 * Decal material for the graphic application badge (logo). The badge mask is the alpha; relief
 * comes from the same mask as a bump map (raised > 0, etched / debossed < 0).
 * @param {object} gspec from graphicRenderSpec()
 */
export async function createGraphicMaterial(gspec) {
  const mask = await badgeMask(gspec.edge);
  const alphaTex = new THREE.CanvasTexture(maskCanvas(mask, { opacity: gspec.opacity, margin: BADGE_MARGIN }));
  alphaTex.colorSpace = THREE.SRGBColorSpace;
  alphaTex.anisotropy = 8;
  const bumpTex = new THREE.CanvasTexture(maskCanvas(mask, { asGrey: true, margin: BADGE_MARGIN }));
  bumpTex.anisotropy = 8;
  const color = new THREE.Color(gspec.color);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    map: alphaTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: gspec.roughness,
    metalness: gspec.metalness,
    clearcoat: gspec.clearcoat,
    clearcoatRoughness: 0.06,
    bumpMap: bumpTex,
    bumpScale: gspec.relief * 6,
    envMapIntensity: gspec.metalness > 0.8 ? 1.2 : 1,
  });
  // Emboss / deboss has no ink: only the pressed edge should show, so the face stays faint.
  if (gspec.kind === "relief") material.opacity = 0.35;
  material.userData.ownedTextures = [alphaTex, bumpTex];
  material.userData.graphic = gspec;
  return material;
}

export function disposeFinishMaterial(material) {
  if (!material) return;
  for (const t of material.userData?.ownedTextures ?? []) t.dispose();
  material.dispose();
}
