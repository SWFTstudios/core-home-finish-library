import test from "node:test";
import assert from "node:assert/strict";
import { contrastInk, graphicRenderSpec } from "../public/js/graphic-application-spec.js";
import { finishRenderSpec } from "../public/js/finish-render-spec.js";
import { badgePlacement, surfaceRadius } from "../public/js/product-profiles.js";
import catalog from "../public/api/catalog.json" with { type: "json" };

const gfx = (templateKey) => ({ templateKey, uiLabel: templateKey });
const paint = (hex) => finishRenderSpec({ name: "Semi-Matte", hexColor: hex }, "stainless_steel", { primary: hex });

test("no graphic, no badge", () => {
  assert.equal(graphicRenderSpec(null, paint("#445566")), null);
});

test("every catalog graphic application has a defined look", () => {
  const generic = graphicRenderSpec(gfx("graphic.unknown"));
  for (const g of catalog.graphicApplicationTypes) {
    const spec = graphicRenderSpec(g, paint("#777777"));
    assert.ok(spec, g.templateKey);
    assert.notDeepEqual({ ...spec, key: null, label: "" }, { ...generic, key: null, label: "" }, `${g.templateKey} uses the fallback`);
  }
});

test("laser engraving on painted steel shows bare metal, sunk into the coating", () => {
  const s = graphicRenderSpec(gfx("graphic.laserEngraved"), paint("#5f7d77"));
  assert.equal(s.kind, "metal");
  assert.equal(s.metalness, 1);
  assert.ok(s.relief < 0);
});

test("laser engraving on bare metal leaves a darker mark instead", () => {
  const mirror = finishRenderSpec({ name: "Mirror", finishProcess: "Buff" }, "stainless_steel", { primary: "#c9ccd0" });
  const s = graphicRenderSpec(gfx("graphic.laserEngraved"), mirror);
  assert.ok(s.metalness < 1);
  assert.equal(s.color, "#5b5d61");
});

test("glass etching frosts; prints pick an ink that reads on the finish", () => {
  assert.equal(graphicRenderSpec(gfx("graphic.laserEtched")).kind, "frost");
  assert.equal(contrastInk("#111111"), "#f3f2ee");
  assert.equal(contrastInk("#f0e9d0"), "#2e3136");
  assert.equal(graphicRenderSpec(gfx("graphic.silkScreen"), paint("#101820")).color, "#f3f2ee");
});

test("raised prints stand up, emboss keeps the body finish, wax resist is bare clay", () => {
  assert.ok(graphicRenderSpec(gfx("graphic.partial3dPrint")).relief > 0.4);
  const body = paint("#bdb85d");
  const emboss = graphicRenderSpec(gfx("graphic.embossDeboss"), body);
  assert.equal(emboss.kind, "relief");
  assert.equal(emboss.color, body.color);
  const wax = graphicRenderSpec(gfx("graphic.waxResist"), body);
  assert.equal(wax.kind, "clay");
  assert.ok(wax.roughness > 0.85);
});

test("badge fits on every product", () => {
  for (const slug of ["ceramic", "glass", "stainless_steel", "plastic"]) {
    const { diameter, center, height } = badgePlacement(slug);
    assert.ok(diameter < height * 0.75, slug);
    assert.ok((center * height - diameter / 2) > 0 && center * height + diameter / 2 < height, slug);
    assert.ok(diameter < Math.PI * surfaceRadius(slug, center), `${slug} badge wraps less than half way round`);
  }
});
