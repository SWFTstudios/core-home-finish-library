/**
 * The logo artwork used by every graphic application preview: the Core Home badge — a disc with
 * the "core / HOME" wordmark knocked out (as in the Figma GraphicApplication tiles). It works as a
 * "your logo here" placeholder for all accounts.
 *
 * To use another logo, replace public/assets/brand/core-home-logo.svg (single colour, transparent
 * background); the badge, the 2D / 3D previews and the shelf thumbnails pick it up.
 */
export const LOGO_URL = "/assets/brand/core-home-logo.svg";
export const MASK_SIZE = 512;

let wordmarkPromise = null;
const maskCache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function loadWordmark() {
  wordmarkPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => {
      wordmarkPromise = null;
      reject(new Error(`Logo missing: ${LOGO_URL}`));
    };
    img.src = LOGO_URL;
  });
  return wordmarkPromise;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Hand-painted edge: wobble the coverage with streaky noise so the edge is not machine-perfect. */
function brushEdges(alpha, n) {
  const rand = rng(29);
  const streak = new Float32Array(n).map(() => rand());
  const out = new Float32Array(alpha.length);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const a = alpha[i];
      // Only the edge band (partly covered after the blur) is disturbed.
      const edge = a * (1 - a) * 4;
      const noise = (streak[(x + Math.round(y * 0.35)) % n] - 0.5) * 0.9 + (rand() - 0.5) * 0.4;
      out[i] = Math.min(1, Math.max(0, a + edge * noise));
      // Slight brush-stroke density variation inside the paint.
      if (a > 0.95) out[i] *= 0.9 + streak[(y + x * 3) % n] * 0.1;
    }
  }
  return out;
}

/**
 * Badge coverage mask, MASK_SIZE², values 0–1 (1 = logo material, 0 = product shows through).
 * @param {"crisp"|"soft"|"brush"} edge
 * @returns {Promise<{ size: number, alpha: Float32Array }>}
 */
export function badgeMask(edge = "crisp") {
  if (!maskCache.has(edge)) {
    maskCache.set(
      edge,
      loadWordmark().then((wordmark) => {
        const n = MASK_SIZE;
        const c = makeCanvas(n, n);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (edge !== "crisp") ctx.filter = `blur(${edge === "brush" ? 2.2 : 1.4}px)`;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(n / 2, n / 2, n * 0.47, 0, Math.PI * 2);
        ctx.fill();
        // Knock the wordmark out of the disc.
        const w = n * 0.68;
        const h = w * (wordmark.naturalHeight / wordmark.naturalWidth || 268 / 586);
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(wordmark, (n - w) / 2, (n - h) / 2 + n * 0.015, w, h);
        const data = ctx.getImageData(0, 0, n, n).data;
        let alpha = new Float32Array(n * n);
        for (let i = 0; i < n * n; i++) alpha[i] = data[i * 4 + 3] / 255;
        if (edge === "brush") alpha = brushEdges(alpha, n);
        return { size: n, alpha };
      }),
    );
    maskCache.get(edge).catch(() => maskCache.delete(edge));
  }
  return maskCache.get(edge);
}

/** Bilinear sample of a mask at normalised (x, y), 0 outside. */
export function sampleMask(mask, x, y) {
  const n = mask.size;
  const fx = x * n - 0.5;
  const fy = y * n - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  if (x0 < -1 || y0 < -1 || x0 >= n || y0 >= n) return 0;
  const tx = fx - x0;
  const ty = fy - y0;
  const a = mask.alpha;
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= n || yy >= n ? 0 : a[yy * n + xx]);
  return (
    at(x0, y0) * (1 - tx) * (1 - ty) +
    at(x0 + 1, y0) * tx * (1 - ty) +
    at(x0, y0 + 1) * (1 - tx) * ty +
    at(x0 + 1, y0 + 1) * tx * ty
  );
}

/**
 * Canvas with the mask as alpha over a white fill (3D decal map / alpha) — optionally the mask as
 * grey levels (bump map).
 */
export function maskCanvas(mask, { asGrey = false, opacity = 1, margin = 0 } = {}) {
  const n = mask.size;
  const size = Math.round(n * (1 + 2 * margin));
  const off = Math.round(n * margin);
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x - off;
      const sy = y - off;
      const a = sx < 0 || sy < 0 || sx >= n || sy >= n ? 0 : mask.alpha[sy * n + sx];
      const i = (y * size + x) * 4;
      if (asGrey) {
        const v = Math.round(a * 255);
        img.data.set([v, v, v, 255], i);
      } else {
        img.data.set([255, 255, 255, Math.round(a * opacity * 255)], i);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Shelf thumbnail: the badge in the application's style on a swatch of the finish colour.
 * @param {HTMLCanvasElement} canvas
 * @param {object} gspec graphicRenderSpec()
 * @param {object|null} finishSpec finishRenderSpec()
 */
export async function drawGraphicThumb(canvas, gspec, finishSpec) {
  const mask = await badgeMask(gspec.edge);
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  const base = finishSpec?.color ?? "#d8dde3";

  // Finish swatch with a soft cylinder shading so the thumb reads as the product surface.
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const shade = ctx.createLinearGradient(0, 0, size, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.18)");
  shade.addColorStop(0.45, "rgba(255,255,255,0.08)");
  shade.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  if (finishSpec?.transmission > 0.5) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, 0, size, size);
  }

  const badgePx = Math.round(size * 0.78);
  const art = maskCanvas(mask);
  const layer = makeCanvas(badgePx, badgePx);
  const lctx = layer.getContext("2d");
  lctx.drawImage(art, 0, 0, badgePx, badgePx);
  lctx.globalCompositeOperation = "source-in";
  if (gspec.kind === "metal") {
    const g = lctx.createLinearGradient(0, 0, badgePx, badgePx);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, gspec.color);
    g.addColorStop(0.6, "#7d8086");
    g.addColorStop(1, gspec.color);
    lctx.fillStyle = g;
  } else {
    lctx.fillStyle = gspec.color;
  }
  lctx.fillRect(0, 0, badgePx, badgePx);
  if (gspec.roughness < 0.3 && gspec.kind !== "metal") {
    // Gloss: a soft highlight across the print.
    const g = lctx.createLinearGradient(0, 0, 0, badgePx);
    g.addColorStop(0, "rgba(255,255,255,0.35)");
    g.addColorStop(0.45, "rgba(255,255,255,0)");
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, badgePx, badgePx);
  }

  const x = (size - badgePx) / 2;
  const y = (size - badgePx) / 2;
  // Relief: light from the upper right, as in the 3D studio.
  const step = Math.max(1, Math.round(size / 60)) * Math.sign(gspec.relief || 0);
  if (Math.abs(gspec.relief) > 0.02) {
    const strength = Math.min(0.6, Math.abs(gspec.relief) * 0.9 + 0.15);
    for (const [dx, dy, colour] of [
      [-step, step, `rgba(0,0,0,${strength})`],
      [step, -step, `rgba(255,255,255,${strength})`],
    ]) {
      const edge = makeCanvas(badgePx, badgePx);
      const ectx = edge.getContext("2d");
      ectx.drawImage(art, 0, 0, badgePx, badgePx);
      ectx.globalCompositeOperation = "source-in";
      ectx.fillStyle = colour;
      ectx.fillRect(0, 0, badgePx, badgePx);
      ctx.drawImage(edge, x + dx, y + dy);
    }
  }
  if (gspec.kind !== "relief") {
    ctx.globalAlpha = gspec.opacity;
    ctx.drawImage(layer, x, y);
    ctx.globalAlpha = 1;
  } else {
    // Emboss / deboss: the face is the finish itself.
    const face = makeCanvas(badgePx, badgePx);
    const fctx = face.getContext("2d");
    fctx.drawImage(art, 0, 0, badgePx, badgePx);
    fctx.globalCompositeOperation = "source-in";
    fctx.fillStyle = base;
    fctx.fillRect(0, 0, badgePx, badgePx);
    ctx.drawImage(face, x, y);
  }
}
