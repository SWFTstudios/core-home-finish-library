import test from "node:test";
import assert from "node:assert/strict";
import { FOCUS_DEG, MIN_SWATCH, WHEEL_RATIOS, nearestIndex, wheelSlot } from "../public/js/finish-wheel.js";

test("the focused swatch sits at about 9 o'clock and is the largest", () => {
  const focus = wheelSlot(0, 340);
  assert.equal(focus.angle, FOCUS_DEG);
  assert.ok(focus.x < -280, "left of the disc centre");
  assert.ok(Math.abs(focus.y) < 30, "close to the centre line");
  assert.ok(focus.size > wheelSlot(1, 340).size * 1.5);
  assert.equal(wheelSlot(3, 340).size, wheelSlot(1, 340).size);
});

test("later finishes run down the arc, earlier ones up, with a gap around the focus", () => {
  const up = wheelSlot(-1, 340);
  const down = wheelSlot(1, 340);
  const down2 = wheelSlot(2, 340);
  assert.ok(up.y < 0 && down.y > 0);
  assert.ok(down2.angle - down.angle < down.angle - FOCUS_DEG, "first step out of focus is the widest");
});

test("positions move continuously while the wheel turns", () => {
  for (const d of [-1.01, -0.99, -0.5, 0.5, 0.99, 1.01]) {
    const a = wheelSlot(d, 300);
    const b = wheelSlot(d + 0.001, 300);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1, `jump at d=${d}`);
  }
});

test("swatches never overlap or shrink below a touch target on a small wheel", () => {
  const r = 150;
  const ring = r * WHEEL_RATIOS.ring;
  for (let d = 1; d < 8; d++) {
    const a = wheelSlot(d, r, { minSwatch: MIN_SWATCH });
    const b = wheelSlot(d + 1, r, { minSwatch: MIN_SWATCH });
    assert.ok(a.size >= MIN_SWATCH);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.size, `overlap at ${d}`);
    assert.ok(Math.abs(Math.hypot(a.x, a.y) - ring) < 1e-6, "on the ring");
  }
});

test("nearestIndex clamps to the list", () => {
  assert.equal(nearestIndex(-0.3, 10), 0);
  assert.equal(nearestIndex(4.6, 10), 5);
  assert.equal(nearestIndex(12, 10), 9);
});
