/**
 * Paint a finish onto a flat product image (2D view) with real lighting — no WebGL needed.
 *
 * `npm run shells:export` renders each hero product from the front and back in the 3D studio and
 * saves, next to the neutral shell image, three "passes" that describe every pixel:
 *   <side>-uv.png     where the pixel sits on the product surface (u around, v up) + finishable mask
 *   <side>-light.png  light falling on it: matte diffuse, glossy reflection, satin reflection
 *   <side>-metal.png  mirror-metal and brushed-metal reflections, and how directly it faces us
 * Compositing looks up the finish colour map (finish-albedo.js) at u/v and lights it with those
 * passes, using the same roughness / metalness / clearcoat / transmission numbers as the 3D
 * material and the same ACES tone curve. Lid, straw and liner keep their neutral shell pixels.
 */
import { buildAlbedo } from "./finish-albedo.js";

const PASSES = ["uv", "light", "metal"];
const passCache = new Map();
const albedoCache = new Map();

/** Decoders for the 8-bit pass encodings written by render-qa.js (encodePasses). */
const LIGHT = new Float32Array(256).map((_, c) => (c / 255) ** 2 * 4);
const SRGB_TO_LIN = new Float32Array(256).map((_, c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
});

function linToSrgb8(x) {
  const v = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/** Three.js ACESFilmicToneMapping (exposure 1), so 2D matches the 3D view. */
function aces(r, g, b, out) {
  r /= 0.6;
  g /= 0.6;
  b /= 0.6;
  const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const ig = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const ib = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const fr = fit(ir);
  const fg = fit(ig);
  const fb = fit(ib);
  out[0] = Math.min(1, Math.max(0, 1.60475 * fr - 0.53108 * fg - 0.07367 * fb));
  out[1] = Math.min(1, Math.max(0, -0.10208 * fr + 1.10813 * fg - 0.00605 * fb));
  out[2] = Math.min(1, Math.max(0, -0.00327 * fr - 0.07276 * fg + 1.07602 * fb));
}

function imageData(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Shell pass missing: ${url}`));
    img.src = url;
  });
}

/**
 * Load the neutral shell and its passes for one product side.
 * @returns {Promise<{ width: number, height: number, shell: ImageData, uv: ImageData, light: ImageData, metal: ImageData }>}
 */
export function loadShellPasses(baseUrl, side) {
  const key = `${baseUrl}/${side}`;
  if (!passCache.has(key)) {
    const urls = [`${baseUrl}/${side}.png`, ...PASSES.map((p) => `${baseUrl}/${side}-${p}.png`)];
    passCache.set(
      key,
      Promise.all(urls.map(loadImg))
        .then((imgs) => {
          const [shell, uv, light, metal] = imgs.map(imageData);
          return { width: shell.width, height: shell.height, shell, uv, light, metal };
        })
        .catch((err) => {
          passCache.delete(key);
          throw err;
        }),
    );
  }
  return passCache.get(key);
}

function hexToLin(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  const n = m ? parseInt(m[1], 16) : 0xc9ccd0;
  return [SRGB_TO_LIN[(n >> 16) & 255], SRGB_TO_LIN[(n >> 8) & 255], SRGB_TO_LIN[n & 255]];
}

/** Stable per-texel random number (glitter sparkle, powder grit). */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hsvToLin(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const rgb = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][((i % 6) + 6) % 6];
  return rgb.map((c) => c * c);
}

/** Dielectric reflection (F0 ≈ 0.04, Fresnel included) at a given roughness. */
function reflection(gloss, satin, rough) {
  if (rough <= 0.06) return gloss;
  if (rough <= 0.42) return gloss + (satin - gloss) * ((rough - 0.06) / 0.36);
  return satin * (1 - Math.min(1, (rough - 0.42) / 0.58) * 0.85);
}

/** Metal reflection at a given roughness; very rough metal falls back toward diffuse. */
function metalReflection(mirror, brushed, diffuse, rough) {
  if (rough <= 0.06) return mirror;
  if (rough <= 0.34) return mirror + (brushed - mirror) * ((rough - 0.06) / 0.28);
  return brushed + (diffuse * 0.8 - brushed) * Math.min(1, (rough - 0.34) / 0.5);
}

/**
 * Light the finish colour map with the passes and return the finished product image.
 * @param {Awaited<ReturnType<typeof loadShellPasses>>} passes
 * @param {ImageData} albedo from buildAlbedo()
 * @param {object} spec from finishRenderSpec()
 * @param {HTMLCanvasElement} [target] canvas to draw into (resized to the shell)
 * @param {{ translucent?: boolean }} [opts] translucent: the map's alpha is pattern opacity over
 *   clear glass (see buildAlbedo)
 */
export function compositeFinish(passes, albedo, spec, target = document.createElement("canvas"), { translucent = false } = {}) {
  const { width: w, height: h, shell, uv, light, metal } = passes;
  target.width = w;
  target.height = h;
  const ctx = target.getContext("2d");
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const S = shell.data;
  const U = uv.data;
  const L = light.data;
  const M = metal.data;
  const A = albedo.data;
  const aw = albedo.width;
  const ah = albedo.height;

  const rough = spec.roughness ?? 0.4;
  const metalness = spec.metalness ?? 0;
  const coat = spec.clearcoat ?? 0;
  const coatRough = spec.clearcoatRoughness ?? 0.1;
  const transmission = spec.transmission ?? 0;
  const iridescence = spec.iridescence ?? 0;
  const sheen = spec.sheen ?? 0;
  const emissive = spec.emissiveIntensity ?? 0;
  const flakes = spec.flakes?.density ?? 0;
  const grit = spec.bump ? (spec.bump === "powder" ? 0.08 : 0.14) : 0;
  const tint = hexToLin(spec.color);
  const tone = [0, 0, 0];

  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const shellA = S[p + 3];
    if (!shellA) continue;
    if (U[p + 3] < 128) {
      // Lid, straw, liner: not finishable, keep the neutral shell.
      o[p] = S[p];
      o[p + 1] = S[p + 1];
      o[p + 2] = S[p + 2];
      o[p + 3] = shellA;
      continue;
    }

    const u = ((U[p] << 4) | (U[p + 2] >> 4)) / 4095;
    const v = ((U[p + 1] << 4) | (U[p + 2] & 15)) / 4095;

    // Bilinear sample of the colour map (u wraps around the product, v is clamped).
    const fx = u * aw - 0.5;
    const fy = (1 - v) * (ah - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.min(ah - 1, Math.max(0, Math.floor(fy)));
    const y1 = Math.min(ah - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - Math.floor(fy);
    const xa = ((x0 % aw) + aw) % aw;
    const xb = (xa + 1) % aw;
    const i00 = (y0 * aw + xa) * 4;
    const i10 = (y0 * aw + xb) * 4;
    const i01 = (y1 * aw + xa) * 4;
    const i11 = (y1 * aw + xb) * 4;
    const alb = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      alb[c] =
        SRGB_TO_LIN[A[i00 + c]] * (1 - tx) * (1 - ty) +
        SRGB_TO_LIN[A[i10 + c]] * tx * (1 - ty) +
        SRGB_TO_LIN[A[i01 + c]] * (1 - tx) * ty +
        SRGB_TO_LIN[A[i11 + c]] * tx * ty;
    }
    // Glass photo maps: alpha says how opaque the pattern is here; clear glass keeps the tint.
    let opaque = 0;
    if (translucent) {
      const a = (A[i00 + 3] * (1 - tx) * (1 - ty) + A[i10 + 3] * tx * (1 - ty) + A[i01 + 3] * (1 - tx) * ty + A[i11 + 3] * tx * ty) / 255;
      const cover = Math.min(1, a * 4);
      for (let c = 0; c < 3; c++) alb[c] = tint[c] + (alb[c] - tint[c]) * cover;
      opaque = Math.min(1, Math.max(0, (a - 0.2) / 0.6));
    }

    let diffuse = LIGHT[L[p]];
    const gloss = LIGHT[L[p + 1]];
    const satin = LIGHT[L[p + 2]];
    const mirror = LIGHT[M[p]];
    const brushed = LIGHT[M[p + 1]];
    const facing = M[p + 2] / 255;
    const texX = Math.floor(u * aw * 2);
    const texY = Math.floor(v * ah * 2);

    if (grit) diffuse *= 1 + grit * (hash(texX, texY) - 0.5);

    const refl = reflection(gloss, satin, rough);
    const metalRefl = metalReflection(mirror, brushed, diffuse, rough);
    const coatRefl = coat * reflection(gloss, satin, coatRough);

    // Thin-film colour shift with viewing angle (iridescent, pearl, colour-changing).
    let film = null;
    if (iridescence > 0) {
      const hue = (0.62 + (1 - facing) * 0.9 + v * 0.18) % 1;
      film = hsvToLin(hue, 0.85, 1);
    }

    let r = 0;
    let g = 0;
    let b = 0;
    for (let c = 0; c < 3; c++) {
      let a = alb[c];
      if (film) a *= 1 + (film[c] * 1.6 - 0.6) * iridescence * 0.45;
      const dielectric = a * diffuse + refl;
      const metallic = a * metalRefl;
      let col = dielectric + (metallic - dielectric) * metalness;
      const specTint = film ? 1 + (film[c] * 2 - 1) * iridescence * 0.6 : 1;
      col += coatRefl * specTint;
      if (sheen) col += sheen * (1 - facing) ** 2 * 0.35 * diffuse * (0.5 + 0.5 * a);
      if (emissive) col += a * emissive * 4;
      if (c === 0) r = col;
      else if (c === 1) g = col;
      else b = col;
    }

    // Glitter / metallic flake: individual flakes catch the light.
    if (flakes) {
      const n = hash(texX, texY);
      if (n < flakes * 0.09) {
        const glint = (satin * 10 + diffuse * 0.35) * (0.4 + hash(texY, texX) * 1.2);
        const tint = metalness > 0.3 ? alb : [1, 1, 1];
        r += glint * (0.5 + 0.5 * tint[0]);
        g += glint * (0.5 + 0.5 * tint[1]);
        b += glint * (0.5 + 0.5 * tint[2]);
      }
    }

    aces(r, g, b, tone);
    if (transmission <= 0) {
      o[p] = linToSrgb8(tone[0]);
      o[p + 1] = linToSrgb8(tone[1]);
      o[p + 2] = linToSrgb8(tone[2]);
      o[p + 3] = shellA;
      continue;
    }

    // See-through body. Light passing through tinted glass is the background × the tint, so the
    // clear part is drawn as a colour + alpha that gives exactly the tint over the (light) page
    // and a dark tinted glass over the dark theme. The tint deepens toward the edges, where the
    // path through the wall is longer. Reflections sit on top; opaque pattern (spots, frit,
    // plating) and frosting fade toward the fully lit solid result.
    const clearShare = transmission * (1 - Math.min(rough, 0.7) * 0.75) * (1 - opaque);
    const path = 1 + (1 - facing) * 1.6;
    const light = 0.6 + 0.4 * Math.min(1, diffuse);
    let minW = 1;
    const W = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      W[c] = linToSrgb8(Math.min(1, alb[c] ** path * light)) / 255;
      minW = Math.min(minW, W[c]);
    }
    const tintAlpha = Math.min(1, Math.max(0.07, 1 - minW));
    const reflections = linToSrgb8(Math.min(1, (refl + coatRefl) * 0.9)) / 255;
    // Premultiplied clear-glass colour, reflections added on top.
    const clearA = Math.min(1, tintAlpha + reflections * 0.85);
    const opaqueShare = 1 - clearShare;
    const outA = clearA * clearShare + opaqueShare;
    for (let c = 0; c < 3; c++) {
      const clearP = W[c] - (1 - tintAlpha) + reflections;
      const solidP = tone[c] <= 0.0031308 ? tone[c] * 12.92 : 1.055 * tone[c] ** (1 / 2.4) - 0.055;
      const premult = Math.max(0, clearP) * clearShare + solidP * opaqueShare;
      o[p + c] = Math.max(0, Math.min(255, Math.round((premult / Math.max(outA, 1e-3)) * 255)));
    }
    o[p + 3] = Math.round(shellA * Math.min(1, outA));
  }

  ctx.putImageData(out, 0, 0);
  return target;
}

/**
 * Build the finish colour map once and paint it onto several product sides.
 * @param {{ spec: object, photoUrl?: string|null, aspect: number, sides: { passes: object, canvas: HTMLCanvasElement }[] }} opts
 */
export async function paintFinish({ spec, photoUrl = null, aspect, sides }) {
  const key = JSON.stringify([spec, photoUrl, aspect]);
  let entry = albedoCache.get(key);
  if (!entry) {
    entry = buildAlbedo(spec, { photoUrl, aspect }).then(({ canvas, translucent }) => ({
      albedo: canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height),
      translucent,
    }));
    albedoCache.set(key, entry);
    // Keep the last few finishes so flicking back and forth on the wheel is instant.
    if (albedoCache.size > 8) albedoCache.delete(albedoCache.keys().next().value);
    entry.catch(() => albedoCache.delete(key));
  }
  const { albedo, translucent } = await entry;
  for (const side of sides) compositeFinish(side.passes, albedo, spec, side.canvas, { translucent });
}
