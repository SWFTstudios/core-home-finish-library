/**
 * Finish colour map ("albedo") shared by the 2D shells and the 3D product.
 *
 * One canvas covers the whole product surface: x = u (one full turn around the product, seam at
 * the back), y = v (lip at the top row, base at the bottom row). See surfaceUV() in
 * product-models-3d.js. No Three.js here so the 2D view works without WebGL.
 *
 * Sources, in order of preference:
 *   1. The finish photo (factory photo or AI sample) for patterned and textured finishes. The
 *      clean centre of the product is cut out, the studio shading baked into the photo is removed
 *      (de-lit), and the strip is cross-faded so it wraps around the product without a seam.
 *   2. A gradient (ombré, diagonal, two-tone) from the colours sampled from the photo.
 *   3. Speckle dots over the base colour.
 *   4. A flat colour.
 */

export const ALBEDO_WIDTH = 1024;
export const ALBEDO_HEIGHT = 512;

/** Centre share of the product crop used as texture; the outer band holds silhouettes and rims. */
const PHOTO_CORE = 0.6;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined" && typeof document === "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Deterministic noise so procedural maps look the same on every load. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const imageCache = new Map();

/** Load an image once per URL (CORS-enabled so the pixels can be read). */
export function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => {
          imageCache.delete(url);
          reject(new Error(`Image failed: ${url}`));
        };
        img.src = url;
      }),
    );
  }
  return imageCache.get(url);
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Remove the studio lighting baked into a product photo strip.
 *
 * On a cylinder the shading runs across the width (dark edges, bright highlight streaks), so the
 * smoothed brightness of each column is the lighting and everything else is the finish. Dividing
 * by it leaves the pattern and its real contrast, lit evenly. Highlights brighter than the
 * finish itself are pulled back to the column average.
 */
export function delightStrip(data, w, h, { strength = 1 } = {}) {
  const col = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      sum += lum(data[i], data[i + 1], data[i + 2]);
    }
    col[x] = sum / h;
  }
  // Smooth over ~6% of the width so the profile follows lighting, not the pattern.
  const radius = Math.max(2, Math.round(w * 0.06));
  const smooth = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const xx = Math.min(w - 1, Math.max(0, x + k));
      sum += col[xx];
      n++;
    }
    smooth[x] = sum / n;
  }
  // Target: the brighter, lit part of the strip (photos are exposed for the lit side).
  const sorted = [...smooth].sort((a, b) => a - b);
  const target = sorted[Math.floor(sorted.length * 0.6)] || 1;
  for (let x = 0; x < w; x++) {
    const gain = 1 + ((target / Math.max(smooth[x], 4)) - 1) * strength;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, data[i + c] * gain);
    }
  }
  return data;
}

/**
 * In renders of clear glass the straw shows through the middle of the body as a narrow, more
 * opaque vertical band. Replace those columns with their neighbours.
 */
export function removeStrawColumns(data, w, h) {
  const alpha = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) sum += data[(y * w + x) * 4 + 3];
    alpha[x] = sum / h / 255;
  }
  const median = [...alpha].sort((a, b) => a - b)[Math.floor(w / 2)];
  if (median > 0.85) return 0;
  const limit = Math.max(median * 1.8, median + 0.12);
  const marked = Array.from(alpha, (a) => a > limit);
  let removed = 0;
  for (let x = 0; x < w; ) {
    if (!marked[x]) {
      x++;
      continue;
    }
    let end = x;
    while (end < w && marked[end]) end++;
    if (end - x <= w * 0.12) {
      // Fill the band from just outside it: left half from the left, right half from the right.
      for (let k = x; k < end; k++) {
        const src = k - x < (end - x) / 2 ? Math.max(0, x - 1 - (k - x)) : Math.min(w - 1, end + (end - 1 - k));
        for (let y = 0; y < h; y++) {
          const d = (y * w + k) * 4;
          const sIdx = (y * w + src) * 4;
          for (let c = 0; c < 4; c++) data[d + c] = data[sIdx + c];
        }
      }
      removed += end - x;
    }
    x = end;
  }
  return removed;
}

/**
 * Glass renders look more opaque where the wall is seen edge-on (and where the far wall shows
 * through), which tiles into vertical bands. Even out the per-column opacity the same way
 * delightStrip evens out brightness; opaque photos are left alone.
 */
export function flattenAlpha(data, w, h) {
  const col = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) sum += data[(y * w + x) * 4 + 3];
    col[x] = sum / h;
  }
  const sorted = [...col].sort((a, b) => a - b);
  const median = sorted[Math.floor(w / 2)];
  if (median > 0.85 * 255) return;
  const radius = Math.max(2, Math.round(w * 0.06));
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      sum += col[Math.min(w - 1, Math.max(0, x + k))];
      n++;
    }
    const gain = median / Math.max(sum / n, 1);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4 + 3;
      data[i] = Math.min(255, data[i] * gain);
    }
  }
}

/** Cut the clean product core out of a photo, de-light it, and return it as a canvas. */
async function photoStrip(url, crop) {
  const img = await loadImage(url);
  const [cx, cy, cw, ch] = crop ?? [0, 0, 1, 1];
  const w = cw * PHOTO_CORE;
  const h = ch * PHOTO_CORE;
  const x = cx + (cw - w) / 2;
  const y = cy + (ch - h) / 2;
  const sw = Math.max(1, Math.round(w * img.naturalWidth));
  const sh = Math.max(1, Math.round(h * img.naturalHeight));
  const outW = Math.min(512, sw);
  const outH = Math.max(1, Math.round(outW * (sh / sw)));
  const c = makeCanvas(outW, outH);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, x * img.naturalWidth, y * img.naturalHeight, sw, sh, 0, 0, outW, outH);
  const pixels = ctx.getImageData(0, 0, outW, outH);
  removeStrawColumns(pixels.data, outW, outH);
  delightStrip(pixels.data, outW, outH);
  flattenAlpha(pixels.data, outW, outH);
  ctx.putImageData(pixels, 0, 0);
  return c;
}

/**
 * Make a strip tile seamlessly left-to-right: the right-hand overlap is cross-faded into the left
 * edge, so the tile repeats without the mirror symmetry a flipped copy would show.
 */
function seamlessStrip(strip, overlapShare = 0.3) {
  const sw = strip.width;
  const sh = strip.height;
  const overlap = Math.max(1, Math.round(sw * overlapShare));
  const period = sw - overlap;
  const tile = makeCanvas(period, sh);
  const ctx = tile.getContext("2d");
  ctx.drawImage(strip, 0, 0, period, sh, 0, 0, period, sh);
  // The strip's last `overlap` columns continue past the tile edge; blend them in over the start.
  // A true linear blend (fade out the tile, add the faded continuation) so translucent glass
  // strips do not get a more opaque band where the two overlap.
  const gradient = (c, from, to) => {
    const g = c.createLinearGradient(0, 0, overlap, 0);
    g.addColorStop(0, `rgba(0,0,0,${from})`);
    g.addColorStop(1, `rgba(0,0,0,${to})`);
    return g;
  };
  const fade = makeCanvas(overlap, sh);
  const fctx = fade.getContext("2d");
  fctx.drawImage(strip, period, 0, overlap, sh, 0, 0, overlap, sh);
  fctx.globalCompositeOperation = "destination-in";
  fctx.fillStyle = gradient(fctx, 1, 0);
  fctx.fillRect(0, 0, overlap, sh);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient(ctx, 1, 0);
  ctx.fillRect(0, 0, overlap, sh);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(fade, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return tile;
}

/**
 * Wrap a strip around the product. The tile count keeps the photo at its real proportions; the
 * pattern is offset so a tile edge never sits in the middle of the front view.
 * @param aspect body circumference / body height
 */
function wrapStrip(ctx, strip, aspect, W, H) {
  const tile = seamlessStrip(strip);
  const tiles = Math.max(1, Math.round(aspect * (tile.height / tile.width)));
  const tileW = W / tiles;
  const offset = tileW * 0.37;
  for (let i = -1; i <= tiles; i++) ctx.drawImage(tile, i * tileW + offset, 0, tileW, H);
}

function paintGradient(ctx, { type, stops, angle }, W, H) {
  const clean = (stops ?? []).filter(Boolean);
  if (!clean.length) return;
  const addStops = (g) => {
    if (type === "split") {
      g.addColorStop(0, clean[0]);
      g.addColorStop(0.49, clean[0]);
      g.addColorStop(0.51, clean[1] ?? clean[0]);
      g.addColorStop(1, clean[1] ?? clean[0]);
    } else {
      clean.forEach((stop, i) => g.addColorStop(clean.length === 1 ? 0 : i / (clean.length - 1), stop));
    }
  };
  if (type === "diagonal") {
    // Two mirrored halves keep the diagonal continuous around the body with no seam.
    const half = W / 2;
    for (let i = 0; i < 2; i++) {
      ctx.save();
      if (i) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      const g =
        angle === 90 ? ctx.createLinearGradient(0, 0, half, 0) : ctx.createLinearGradient(0, H, half, 0);
      addStops(g);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, half, H);
      ctx.restore();
    }
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  addStops(g);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function paintSpeckle(ctx, { color, density, multicolor }, W, H) {
  const rand = rng(7);
  const palette = multicolor ? ["#f4f2ee", "#e25d4a", "#3c8dd9", "#f2c94c", "#4caf7a"] : [color];
  const count = Math.round(9000 * density);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 0.7 + rand() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Fine colour variation (orange peel, glaze pooling) so flat finishes do not look like plastic CG. */
function paintGrain(ctx, amount, W, H, seed = 11) {
  if (amount <= 0) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const rand = rng(seed);
  // Low-frequency mottling from a coarse random grid, plus per-pixel grain.
  const gw = 32;
  const gh = 16;
  const grid = Array.from({ length: gw * gh }, () => rand() - 0.5);
  for (let y = 0; y < H; y++) {
    const gy = (y / H) * (gh - 1);
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let x = 0; x < W; x++) {
      const gx = (x / W) * gw;
      const x0 = Math.floor(gx) % gw;
      const x1 = (x0 + 1) % gw;
      const fx = gx - Math.floor(gx);
      const y1 = Math.min(gh - 1, y0 + 1);
      const m =
        grid[y0 * gw + x0] * (1 - fx) * (1 - fy) +
        grid[y0 * gw + x1] * fx * (1 - fy) +
        grid[y1 * gw + x0] * (1 - fx) * fy +
        grid[y1 * gw + x1] * fx * fy;
      const k = 1 + amount * (m * 0.35 + (rand() - 0.5) * 0.5);
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Build the colour map for one finish.
 *
 * @param {object} spec from finishRenderSpec()
 * @param {{ photoUrl?: string|null, aspect?: number, width?: number, height?: number }} [opts]
 *   aspect = body circumference / body height (sets how many times a photo strip repeats)
 * @returns {Promise<{ canvas: HTMLCanvasElement|OffscreenCanvas, source: "photo"|"gradient"|"speckle"|"flat", translucent: boolean }>}
 *   translucent: glass / clear plastic photo map; its alpha is how opaque the pattern is (spots,
 *   filigree, frit) over otherwise clear glass.
 */
export async function buildAlbedo(spec, { photoUrl = null, aspect = 2.4, width = ALBEDO_WIDTH, height = ALBEDO_HEIGHT } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const fillBase = () => {
    ctx.fillStyle = spec.color ?? "#c9ccd0";
    ctx.fillRect(0, 0, width, height);
  };
  const translucent = Boolean(spec.photo && photoUrl && spec.transmission > 0);
  if (!translucent) fillBase();

  let source = "flat";
  if (spec.photo && photoUrl) {
    try {
      const strip = await photoStrip(photoUrl, spec.photo.crop);
      wrapStrip(ctx, strip, aspect, width, height);
      source = "photo";
    } catch (err) {
      console.warn(err.message);
      if (translucent) fillBase();
    }
  }
  if (translucent && source === "photo") return { canvas, source, translucent: true };
  if (source === "flat" && spec.gradient) {
    paintGradient(ctx, spec.gradient, width, height);
    source = "gradient";
  }
  if (spec.speckle && source !== "photo") {
    paintSpeckle(ctx, spec.speckle, width, height);
    source = source === "flat" ? "speckle" : source;
  }
  if (source !== "photo") paintGrain(ctx, spec.grain ?? 0, width, height);
  return { canvas, source, translucent: false };
}
