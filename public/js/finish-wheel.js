/**
 * Finish wheel — swatches on a large disc at the right edge of the screen (Figma "SS_Wheel").
 *
 * The disc's centre sits just past the right edge; swatches ride a ring inside it. The focused
 * finish sits at about 9 o'clock in a white bump with its name beside it; the others run up and
 * down the arc. The wheel position is continuous (float index), so it turns smoothly:
 *   - mouse wheel / trackpad scroll turns it and snaps to the nearest finish when you stop
 *   - drag anywhere on the disc turns it, with a little momentum
 *   - click any swatch, in any order, and the wheel rotates to bring it into focus
 *   - up / down buttons and the keyboard (arrows, Page Up / Down, Home / End) step through
 * onSelect(index) fires once per settled choice, not on every animation frame.
 */

/** Figma proportions (1920×1080 frame): disc r 341, swatch ring r 300, swatch 44, focus bump 113. */
export const WHEEL_RATIOS = {
  ring: 0.88,
  swatch: 0.13,
  focusBump: 0.33,
  focusSwatch: 0.23,
  centreOffset: 0.065,
};

/** Angle between neighbouring swatches, and the extra gap that opens around the focused one. */
export const STEP_DEG = 10;
export const FOCUS_GAP_DEG = 13;
/** Focus slot: just above 9 o'clock, as in the Figma. */
export const FOCUS_DEG = -4;

/**
 * Where an item sits on the arc for a given distance from the wheel position (d = index − pos).
 * Angle is measured from the 9 o'clock direction, positive going down.
 * @returns {{ angle: number, x: number, y: number, size: number }} x, y relative to the disc centre
 */
export function wheelSlot(d, radius, { minSwatch = 0 } = {}) {
  const ring = radius * WHEEL_RATIOS.ring;
  const swatch = Math.max(radius * WHEEL_RATIOS.swatch, minSwatch);
  const focusSwatch = Math.max(radius * WHEEL_RATIOS.focusSwatch, swatch * 1.4);
  // On a small wheel the swatches keep a usable size, so the spacing opens up to fit them.
  const step = Math.max(STEP_DEG, ((swatch * 1.18) / ring) * (180 / Math.PI));
  const gap = Math.max(FOCUS_GAP_DEG, (((focusSwatch - swatch) * 0.9) / ring) * (180 / Math.PI));
  const near = Math.max(-1, Math.min(1, d));
  const deg = FOCUS_DEG + d * step + near * gap;
  const rad = (deg * Math.PI) / 180;
  const t = Math.min(1, Math.abs(d));
  const size = focusSwatch + (swatch - focusSwatch) * t;
  return { angle: deg, x: -ring * Math.cos(rad), y: ring * Math.sin(rad), size, step };
}

/** Smallest comfortable swatch (touch target) in CSS px. */
export const MIN_SWATCH = 30;

/** Nearest valid index for a float position. */
export function nearestIndex(pos, count) {
  return Math.max(0, Math.min(count - 1, Math.round(pos)));
}

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {{
 *   root: HTMLElement,          // positioned container the disc is laid out in (.finish-dial)
 *   viewport: HTMLElement,      // focusable listbox host (#wheel-viewport)
 *   list: HTMLElement,          // <ul> for the swatches (#wheel-list)
 *   renderSwatch: (finish: object) => HTMLElement,
 *   onSelect: (index: number) => void,
 * }} opts
 */
export function createFinishWheel({ root, viewport, list, renderSwatch, onSelect }) {
  viewport.classList.add("finish-wheel");
  const disc = document.createElement("div");
  disc.className = "finish-wheel-disc";
  disc.setAttribute("aria-hidden", "true");
  disc.innerHTML = '<span class="finish-wheel-plate"></span><span class="finish-wheel-bump"></span>';
  viewport.prepend(disc);
  const name = document.createElement("p");
  name.className = "finish-wheel-name";
  name.setAttribute("aria-live", "polite");
  viewport.appendChild(name);

  let finishes = [];
  let items = [];
  let pos = 0;
  let target = 0;
  let selected = -1;
  let raf = 0;
  let lastTime = 0;
  let geom = { cx: 0, cy: 0, r: 300, top: 0, bottom: 600 };
  let settleTimer = 0;

  function measure() {
    const box = root.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    // Disc fills the dial height (a little more, so the arc runs off top and bottom like Figma).
    const r = Math.max(150, Math.min(360, box.height * 0.56, window.innerWidth * 0.3));
    // Centre just past the right edge of the screen, wherever the panel sits.
    const toEdge = Math.max(0, document.documentElement.clientWidth - box.right);
    const cx = box.width + toEdge + r * WHEEL_RATIOS.centreOffset;
    const cy = box.height / 2;
    geom = { cx, cy, r, top: 0, bottom: box.height };
    root.style.setProperty("--wheel-r", `${r}px`);
    root.style.setProperty("--wheel-cx", `${cx}px`);
    root.style.setProperty("--wheel-cy", `${cy}px`);
    const focus = wheelSlot(0, r, { minSwatch: MIN_SWATCH });
    root.style.setProperty("--wheel-focus-x", `${cx + focus.x}px`);
    root.style.setProperty("--wheel-focus-y", `${cy + focus.y}px`);
    root.style.setProperty("--wheel-focus-line", `${cy + focus.y}px`);
    return true;
  }

  function layout() {
    const { cx, cy, r, top, bottom } = geom;
    const fadeBand = r * 0.18;
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const d = i - pos;
      // Only the left half of the circle is ever on screen.
      if (Math.abs(d) > 14) {
        if (!el.hidden) el.hidden = true;
        continue;
      }
      const slot = wheelSlot(d, r, { minSwatch: MIN_SWATCH });
      const x = cx + slot.x;
      const y = cy + slot.y;
      const visible = Math.abs(slot.angle) < 80 && y > top - slot.size && y < bottom + slot.size;
      el.hidden = !visible;
      if (!visible) continue;
      const edge = Math.min(y - top, bottom - y);
      const opacity = Math.max(0, Math.min(1, edge / fadeBand));
      el.style.transform = `translate(${x - slot.size / 2}px, ${y - slot.size / 2}px)`;
      el.style.width = el.style.height = `${slot.size}px`;
      el.style.opacity = String(opacity);
      el.style.zIndex = String(100 - Math.round(Math.abs(d) * 4));
      const focused = Math.abs(d) < 0.5;
      el.classList.toggle("is-active", focused);
      el.setAttribute("aria-selected", String(i === selected));
    }
    const near = nearestIndex(pos, finishes.length);
    const finish = finishes[near];
    if (finish && name.dataset.index !== String(near)) {
      name.textContent = finish.name;
      name.dataset.index = String(near);
    }
    name.style.opacity = finish ? String(Math.max(0, 1 - Math.abs(near - pos) * 2.2)) : "0";
  }

  function tick(time) {
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 11);
    pos += (target - pos) * k;
    if (Math.abs(target - pos) < 0.002) pos = target;
    layout();
    if (pos !== target) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      lastTime = 0;
    }
  }

  function animate() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /** Commit the finish under the focus slot (once the wheel stops). */
  function commit(index) {
    if (!finishes.length) return;
    const i = nearestIndex(index, finishes.length);
    target = i;
    animate();
    if (i !== selected) {
      selected = i;
      onSelect(i);
    }
  }

  function goTo(index) {
    clearTimeout(settleTimer);
    commit(index);
  }

  // —— Scroll: turn continuously, then snap and commit when the scrolling stops. ——
  viewport.addEventListener(
    "wheel",
    (e) => {
      if (!finishes.length) return;
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      target = Math.max(-0.4, Math.min(finishes.length - 0.6, target + px / 90));
      animate();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => commit(target), 140);
    },
    { passive: false },
  );

  // —— Drag along the disc; a tap (no movement) on a swatch selects it. ——
  let drag = null;
  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !finishes.length) return;
    drag = { id: e.pointerId, y: e.clientY, x: e.clientX, start: target, moved: false, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dy, e.clientX - drag.x) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add("is-dragging");
      clearTimeout(settleTimer);
    }
    // One step of arc length per swatch: dragging down pulls earlier finishes into focus.
    const stepPx = (geom.r * WHEEL_RATIOS.ring * wheelSlot(2, geom.r, { minSwatch: MIN_SWATCH }).step * Math.PI) / 180;
    target = Math.max(-0.4, Math.min(finishes.length - 0.6, drag.start - dy / stepPx));
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = (-(e.clientY - drag.lastY) / stepPx / dt) * 1000;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
    animate();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, v } = drag;
    drag = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture?.(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
    if (!moved) return; // a tap: the swatch's click handler selects it
    // Momentum: carry on a little in the direction of the flick.
    commit(target + Math.max(-4, Math.min(4, v * 0.12)));
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  viewport.addEventListener("keydown", (e) => {
    const steps = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1, PageUp: -5, PageDown: 5 };
    if (e.key in steps) {
      e.preventDefault();
      e.stopPropagation();
      goTo((selected < 0 ? 0 : selected) + steps[e.key]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      goTo(e.key === "Home" ? 0 : finishes.length - 1);
    }
  });

  const ro = new ResizeObserver(() => {
    if (measure()) layout();
  });
  ro.observe(root);

  return {
    /** Replace the finishes (search / filter / material change) and jump to `index`. */
    setItems(next, index = 0) {
      finishes = next;
      list.innerHTML = "";
      items = finishes.map((finish, i) => {
        const li = document.createElement("li");
        li.className = "wheel-item";
        li.setAttribute("role", "option");
        li.dataset.index = String(i);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "finish-swatch-btn";
        btn.setAttribute("aria-label", finish.name);
        btn.tabIndex = -1;
        btn.appendChild(renderSwatch(finish));
        btn.addEventListener("click", () => goTo(i));
        li.appendChild(btn);
        list.appendChild(li);
        return li;
      });
      selected = finishes.length ? nearestIndex(index, finishes.length) : -1;
      pos = target = Math.max(0, selected);
      name.dataset.index = "";
      measure();
      layout();
    },
    /** Rotate to `index` (from outside: arrows, zone switch, deep link). Does not call onSelect. */
    setIndex(index, { animate: smooth = true } = {}) {
      if (!finishes.length) return;
      selected = nearestIndex(index, finishes.length);
      target = selected;
      if (!smooth || reducedMotion) {
        pos = target;
        layout();
      } else animate();
    },
    relayout() {
      if (measure()) layout();
    },
    dispose() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
    },
  };
}
