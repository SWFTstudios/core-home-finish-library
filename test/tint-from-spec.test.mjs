import test from "node:test";
import assert from "node:assert/strict";
import { tintFromSpec } from "../public/js/configurator-preview-2d.js";
import { finishRenderSpec } from "../public/js/finish-render-spec.js";

test("tintFromSpec raises opacity for matte finishes", () => {
  const spec = finishRenderSpec({ name: "Matte", hexColor: "#445566" }, "plastic");
  const tint = tintFromSpec(spec);
  assert.ok(tint.opacity > 0.7);
  assert.ok(tint.brightness < 1);
});

test("tintFromSpec boosts contrast for metallic finishes", () => {
  const spec = finishRenderSpec({ name: "Metallic", hexColor: "#8899aa" }, "stainless_steel");
  const tint = tintFromSpec(spec);
  assert.ok(tint.contrast >= 1.08);
});

test("preferred view reads query string", async () => {
  // Facade prefers ?view= without needing a browser DOM; smoke-import only.
  const mod = await import("../public/js/configurator-preview.js");
  assert.equal(typeof mod.initPreview, "function");
  assert.equal(typeof mod.setPreviewView, "function");
  assert.equal(typeof mod.getPreviewView, "function");
});
