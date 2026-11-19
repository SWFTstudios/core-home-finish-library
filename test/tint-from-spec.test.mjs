import test from "node:test";
import assert from "node:assert/strict";
import { applyFinishOverlay, tintFromSpec } from "../public/js/configurator-preview-2d.js";
import { finishRenderSpec } from "../public/js/finish-render-spec.js";

function fakeTint() {
  const props = new Map();
  const classes = new Set();
  return {
    style: {
      opacity: "0",
      filter: "",
      setProperty(k, v) {
        props.set(k, v);
      },
      removeProperty(k) {
        props.delete(k);
      },
      getProperty(k) {
        return props.get(k);
      },
    },
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    _props: props,
    _classes: classes,
  };
}

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

test("applyFinishOverlay maps photo onto shell mask", () => {
  const el = fakeTint();
  const finish = { name: "Dull/Textured", hexColor: "#4a7a4a" };
  applyFinishOverlay(el, "/assets/plastic/front.png", finish, null, "/assets/renders/plastic/x.png");
  assert.equal(el._props.get("--mug-src"), 'url("/assets/plastic/front.png")');
  assert.equal(el._props.get("--finish-photo"), 'url("/assets/renders/plastic/x.png")');
  assert.ok(el._classes.has("mug-tint--photo"));
  assert.equal(el.style.opacity, "1");
});

test("applyFinishOverlay uses colour tint when there is no photo", () => {
  const el = fakeTint();
  const finish = { name: "Matte", hexColor: "#445566" };
  const spec = finishRenderSpec(finish, "plastic");
  applyFinishOverlay(el, "/assets/plastic/front.png", finish, spec, null);
  assert.ok(!el._classes.has("mug-tint--photo"));
  assert.ok(el._props.get("--finish-tint"));
  assert.ok(!el._props.has("--finish-photo"));
  assert.ok(Number(el.style.opacity) > 0);
});

test("preferred view reads query string", async () => {
  const mod = await import("../public/js/configurator-preview.js");
  assert.equal(typeof mod.initPreview, "function");
  assert.equal(typeof mod.setPreviewView, "function");
  assert.equal(typeof mod.getPreviewView, "function");
});
