import test from "node:test";
import assert from "node:assert/strict";
import { delightStrip } from "../public/js/finish-albedo.js";
import { surfaceAspect } from "../public/js/product-profiles.js";
import { finishRenderSpec } from "../public/js/finish-render-spec.js";

/** A w×h strip: a two-colour pattern under cylinder shading (dark edges, bright centre). */
function shadedStrip(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const shade = 0.45 + 0.55 * Math.sin((Math.PI * (x + 0.5)) / w);
      const base = (x + y) % 8 < 4 ? 200 : 100;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = base * shade;
      data[i + 3] = 255;
    }
  }
  return data;
}

const columnMean = (data, w, h, x) => {
  let s = 0;
  for (let y = 0; y < h; y++) s += data[(y * w + x) * 4];
  return s / h;
};

test("delightStrip removes the photo's cylinder shading but keeps the pattern", () => {
  const w = 64;
  const h = 32;
  const data = shadedStrip(w, h);
  const edgeBefore = columnMean(data, w, h, 2) / columnMean(data, w, h, w / 2);
  delightStrip(data, w, h);
  const edgeAfter = columnMean(data, w, h, 2) / columnMean(data, w, h, w / 2);
  assert.ok(edgeBefore < 0.6, "fixture is shaded");
  assert.ok(edgeAfter > 0.85, `edges lifted to the centre level (${edgeAfter.toFixed(2)})`);
  // Pattern contrast survives: the light and dark stripes still differ by ~2×.
  const centre = w / 2;
  const light = data[(0 * w + centre) * 4];
  const dark = data[(0 * w + centre + 4) * 4];
  assert.ok(Math.max(light, dark) / Math.min(light, dark) > 1.6);
});

test("surfaceAspect: a mug unrolls wider than a tall tumbler", () => {
  assert.ok(surfaceAspect("ceramic") > 2.5);
  assert.ok(surfaceAspect("stainless_steel") < 2);
  assert.equal(surfaceAspect("unknown"), surfaceAspect("stainless_steel"));
});

const sampled = { primary: "#3b6ea5", top: "#4a7db3", bottom: "#1d3550", crop: [0.2, 0.1, 0.6, 0.8] };

test("textured finishes take their surface from the photo", () => {
  for (const name of ["Glitter", "White Speckle", "Sand Clay", "Ice Crackle"]) {
    const material = name === "Sand Clay" ? "ceramic" : name === "Ice Crackle" ? "plastic" : "stainless_steel";
    assert.deepEqual(finishRenderSpec({ name }, material, sampled).photo, { crop: sampled.crop }, name);
  }
  assert.equal(finishRenderSpec({ name: "Semi-Matte" }, "stainless_steel", sampled).photo, null);
});

test("grain: matte surfaces mottle, metal and clear glass stay clean", () => {
  assert.ok(finishRenderSpec({ name: "Matte" }, "stainless_steel", sampled).grain > 0.05);
  assert.equal(finishRenderSpec({ name: "Mirror", finishProcess: "Buff" }, "stainless_steel", sampled).grain, 0);
  assert.equal(finishRenderSpec({ name: "Clear" }, "glass", sampled).grain, 0);
});
