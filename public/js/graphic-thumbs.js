/**
 * Graphic application shelf thumbnails: the current product, in the current finish, wearing the
 * logo in each application style (as in the Figma GraphicApplication tiles). Rendered with the 2D
 * compositor on quarter-size shell passes, so they work in both the 2D and 3D views.
 * Falls back to a flat badge swatch (logo-art.js) when the passes are unavailable.
 */
import { loadRenderData } from "./finish-render-data.js";
import { finishRenderSpec, renderDataFor } from "./finish-render-spec.js";
import { loadShellPasses, paintFinish } from "./finish-composite-2d.js";
import { graphicRenderSpec } from "./graphic-application-spec.js";
import { drawGraphicThumb } from "./logo-art.js";
import { badgePlacement, surfaceAspect } from "./product-profiles.js";

const THUMB_STEP = 4;
const smallCache = new Map();

/** Nearest-neighbour downsample (no filtering: the uv pass holds packed coordinates). */
function shrink(img, step) {
  const w = Math.floor(img.width / step);
  const h = Math.floor(img.height / step);
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y * step + (step >> 1)) * img.width + x * step + (step >> 1)) * 4;
      out.data.set(img.data.subarray(s, s + 4), (y * w + x) * 4);
    }
  }
  return out;
}

async function smallPasses(materialSlug) {
  if (!smallCache.has(materialSlug)) {
    smallCache.set(
      materialSlug,
      loadShellPasses(`/assets/${materialSlug}`, "front").then((p) => {
        const shell = shrink(p.shell, THUMB_STEP);
        return {
          width: shell.width,
          height: shell.height,
          shell,
          uv: shrink(p.uv, THUMB_STEP),
          light: shrink(p.light, THUMB_STEP),
          metal: shrink(p.metal, THUMB_STEP),
        };
      }),
    );
    smallCache.get(materialSlug).catch(() => smallCache.delete(materialSlug));
  }
  return smallCache.get(materialSlug);
}

/**
 * Bounding box of the product body in a render: rows at least 40% as wide as the widest row,
 * so a tall straw does not shrink a tumbler to a sliver in the tile.
 */
function bodyBox(render) {
  const { width: w, height: h } = render;
  const a = render.getContext("2d").getImageData(0, 0, w, h).data;
  const rows = [];
  for (let y = 0; y < h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 40) {
        if (l < 0) l = x;
        r = x;
      }
    }
    rows.push(l < 0 ? null : [l, r]);
  }
  const widest = Math.max(0, ...rows.map((row) => (row ? row[1] - row[0] : 0)));
  const body = rows.map((row, y) => (row && row[1] - row[0] >= widest * 0.4 ? y : -1)).filter((y) => y >= 0);
  if (!body.length) return { x: 0, y: 0, w, h };
  const xs = rows.filter(Boolean).flat();
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  return { x: x0, y: body[0], w: x1 - x0 + 1, h: body[body.length - 1] - body[0] + 1 };
}

/** Copy the product body of a render into a thumbnail canvas, centred with a little air. */
function fitInto(render, canvas) {
  const ctx = canvas.getContext("2d");
  const { width: cw, height: ch } = canvas;
  ctx.clearRect(0, 0, cw, ch);
  const box = bodyBox(render);
  const scale = Math.min((ch * 0.88) / box.h, (cw * 0.88) / box.w);
  const w = box.w * scale;
  const h = box.h * scale;
  ctx.drawImage(render, box.x, box.y, box.w, box.h, (cw - w) / 2, (ch - h) / 2, w, h);
}

let runToken = 0;

/**
 * Paint every shelf thumbnail. Later calls cancel earlier ones (finish wheel scrolling).
 * @param {{ materialSlug: string, finish: object|null, items: { graphic: object, canvas: HTMLCanvasElement }[] }} opts
 */
export async function renderGraphicThumbs({ materialSlug, finish, items }) {
  const token = ++runToken;
  const data = await loadRenderData();
  if (token !== runToken) return;
  const { sampled, override } = renderDataFor(data.renderData, data.overrides, materialSlug, finish?.slug);
  const spec = finish ? finishRenderSpec(finish, materialSlug, sampled, override) : null;

  let passes = null;
  try {
    passes = spec ? await smallPasses(materialSlug) : null;
  } catch (err) {
    console.warn(`Graphic thumbnails: ${err.message}`);
  }
  for (const { graphic, canvas } of items) {
    if (token !== runToken) return;
    const gspec = graphicRenderSpec(graphic, spec);
    try {
      if (!passes) throw new Error("no passes");
      const render = document.createElement("canvas");
      await paintFinish({
        spec,
        photoUrl: finish?.imageUrl ?? null,
        aspect: surfaceAspect(materialSlug),
        sides: [{ passes, canvas: render }],
        graphic: { gspec, placement: badgePlacement(materialSlug) },
      });
      if (token !== runToken) return;
      fitInto(render, canvas);
    } catch {
      await drawGraphicThumb(canvas, gspec, spec).catch(() => {});
    }
    // Let the page breathe between thumbnails.
    await new Promise((r) => setTimeout(r, 0));
  }
}
