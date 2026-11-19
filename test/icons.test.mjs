import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ICONS, hasIcon, iconSvg } from "../public/js/icons.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every taxonomy icon used by the library exists", () => {
  const src = read("public/js/library-grouping.js");
  const names = [...src.matchAll(/icon:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
  assert.ok(names.length > 5);
  for (const name of names) assert.ok(hasIcon(name), name);
});

test("no page or script still relies on the Material Symbols icon font", () => {
  const files = [
    "public/configurator/index.html",
    "public/library.html",
    "public/dashboard.html",
    "public/request.html",
    "public/js/configurator.js",
    "public/js/library.js",
    "public/js/components/core-home-navbar.js",
    "public/js/configurator-preview-3d.js",
  ];
  for (const f of files) {
    assert.doesNotMatch(read(f), /<span class="material-symbols-outlined[^"]*"[^>]*>\s*[a-z0-9_]+\s*<\/span>/, f);
  }
  assert.doesNotMatch(read("public/css/lumina-finish.css"), /Material\+Symbols/);
});

test("iconSvg is decorative by default, labelled on request, and never prints the name as text", () => {
  const svg = iconSvg("home");
  assert.match(svg, /^<svg [^>]*aria-hidden="true"/);
  assert.doesNotMatch(svg.replace(/data-icon="home"/, ""), />\s*home\s*</);
  assert.match(iconSvg("folder", { label: 'My "folder"' }), /role="img" aria-label="My &quot;folder&quot;"/);
  // Unknown names fall back to a glyph, not text.
  assert.match(iconSvg("does_not_exist"), /<svg[^>]*>.*<\/svg>$/);
});

test("every glyph is drawn on the 24px grid", () => {
  for (const [name, body] of Object.entries(ICONS)) {
    const nums = [...body.matchAll(/-?\d*\.?\d+/g)].map((m) => Number(m[0]));
    for (const n of nums) assert.ok(Math.abs(n) <= 26, `${name}: ${n} outside the grid`);
  }
});
