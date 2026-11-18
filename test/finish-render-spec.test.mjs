import test from "node:test";
import assert from "node:assert/strict";
import { finishRenderSpec } from "../public/js/finish-render-spec.js";

const sampled = {
  source: "factory_photo",
  primary: "#3b6ea5",
  secondary: "#e8e2d4",
  top: "#4a7db3",
  middle: "#3b6ea5",
  bottom: "#1d3550",
  left: "#4a7db3",
  right: "#1d3550",
  crop: [0.1, 0.1, 0.8, 0.8],
};

const spec = (name, material = "stainless_steel", extra = {}, s = sampled, o = null) =>
  finishRenderSpec({ name, slug: "x", ...extra }, material, s, o);

test("paint over steel is a dielectric coating, not metal", () => {
  const s = spec("Semi-Matte");
  assert.equal(s.metalness, 0);
  assert.equal(s.roughness, 0.45);
  assert.equal(s.color, sampled.primary);
});

test("semi-matte wins over matte and gloss keywords", () => {
  assert.equal(spec("2-Tone Semi-Matte/Glossy").roughness, 0.45);
  assert.equal(spec("Matte").roughness, 0.82);
  assert.equal(spec("Glossy (Opaque)").clearcoat, 1);
});

test("bare and plated metal is fully metallic", () => {
  assert.equal(spec("Mirror", "stainless_steel", { finishProcess: "Buff" }).metalness, 1);
  assert.equal(spec("High Gloss", "stainless_steel", { finishProcess: "Buff" }).family, "metal");
  assert.equal(spec("PVD").color, sampled.primary);
  assert.equal(spec("Gilded").color, "#e2bf72");
});

test("plastic high gloss stays plastic", () => {
  const s = spec("High-Gloss", "plastic", { finishProcess: "Injection Mold" });
  assert.equal(s.metalness, 0);
  assert.ok(s.transmission > 0);
});

test("ombre, diagonal, triple and two-tone pick the right gradient", () => {
  assert.deepEqual(spec("Semi-Matte Ombré").gradient, { type: "vertical", stops: ["#4a7db3", "#1d3550"] });
  assert.equal(spec("2-Color Diagonal Glossy Ombré").gradient.type, "diagonal");
  assert.equal(spec("Triple Powder Coating Ombré").gradient.stops.length, 3);
  assert.equal(spec("2-Tone Gloss").gradient.type, "split");
});

test("glitter, iridescent and pearl families", () => {
  assert.ok(spec("Glitter").flakes.density > 0.5);
  assert.equal(spec("Chameleon").iridescence, 1);
  assert.equal(spec("Pearlized").family, "pearl");
});

test("pattern finishes use the factory photo, not a flat colour", () => {
  assert.deepEqual(spec("Triple Swirl – Glossy (Opaque)").photo, { crop: sampled.crop });
  assert.equal(spec("Splatter", "stainless_steel", {}, { ...sampled, crop: null }).photo, null);
  assert.equal(spec("Splatter").gradient, null);
});

test("glass is transmissive unless sprayed opaque", () => {
  assert.equal(spec("Solid Tint", "glass").transmission, 1);
  assert.equal(spec("Opaque Spray", "glass").transmission, 0);
  assert.equal(spec("Frosted", "glass").roughness, 0.6);
  assert.equal(spec("Ribbed", "glass").bump, "ribbed");
});

test("works with no sampled colours (falls back to catalog hex)", () => {
  const s = finishRenderSpec({ name: "Matte", hexColor: "#123456" }, "plastic");
  assert.equal(s.color, "#123456");
  assert.equal(s.gradient, null);
});

test("overrides win over every rule", () => {
  assert.equal(spec("Mirror", "stainless_steel", {}, sampled, { roughness: 0.3 }).roughness, 0.3);
});
