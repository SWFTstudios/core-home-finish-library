/**
 * Guided walkthrough: dims the page, spotlights one part of the UI at a time and explains it in
 * a small card. Keyboard: → / Enter next, ← back, Esc closes. Steps whose target isn't on screen
 * (e.g. a panel hidden on a phone) are skipped.
 *
 * Pure DOM, no dependencies. Steps:
 *   { target?: string | () => Element, rect?: () => DOMRect-like, title, body, cta? }
 */

const PAD = 8;
const GAP = 16;

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
}

function resolve(step) {
  if (step.rect) return { rect: step.rect(), el: null };
  if (!step.target) return { rect: null, el: null };
  const el = typeof step.target === "function" ? step.target() : document.querySelector(step.target);
  return isVisible(el) ? { rect: el.getBoundingClientRect(), el } : null;
}

function h(tag, attrs = {}, text) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

/**
 * @param {object[]} steps
 * @param {{ onClose?: (info: { completed: boolean, index: number }) => void, label?: string }} opts
 */
export function startTour(steps, { onClose, label = "Finish Library walkthrough" } = {}) {
  document.querySelector(".tour-root")?.remove();
  const previousFocus = document.activeElement;

  const root = h("div", { class: "tour-root" });
  const spot = h("div", { class: "tour-spot", "aria-hidden": "true" });
  const pop = h("div", { class: "tour-pop", role: "dialog", "aria-modal": "true", "aria-label": label });
  const progress = h("p", { class: "tour-progress" });
  const title = h("h2", { class: "tour-title", id: "tour-title" });
  const body = h("p", { class: "tour-text", id: "tour-text" });
  const dots = h("div", { class: "tour-dots", "aria-hidden": "true" });
  const back = h("button", { type: "button", class: "tour-btn tour-btn--ghost" }, "Back");
  const next = h("button", { type: "button", class: "tour-btn tour-btn--primary" }, "Next");
  const skip = h("button", { type: "button", class: "tour-close", "aria-label": "Close walkthrough" }, "×");
  const actions = h("div", { class: "tour-actions" });
  actions.append(dots, h("span", { class: "tour-spacer" }), back, next);
  pop.setAttribute("aria-labelledby", "tour-title");
  pop.setAttribute("aria-describedby", "tour-text");
  pop.append(skip, progress, title, body, actions);
  root.append(spot, pop);
  document.body.append(root);

  // The steps that can be shown right now.
  let shown = steps.filter((s) => resolve(s));
  let index = 0;
  let closed = false;

  shown.forEach(() => dots.append(h("span", { class: "tour-dot" })));

  function place() {
    const step = shown[index];
    const found = resolve(step);
    const rect = found?.rect;
    const mobile = innerWidth < 640;
    root.classList.toggle("is-centered", !rect);
    if (rect) {
      const r = {
        left: Math.max(4, rect.left - PAD),
        top: Math.max(4, rect.top - PAD),
        right: Math.min(innerWidth - 4, rect.right + PAD),
        bottom: Math.min(innerHeight - 4, rect.bottom + PAD),
      };
      Object.assign(spot.style, {
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.right - r.left}px`,
        height: `${r.bottom - r.top}px`,
        borderRadius: step.round ? "999px" : "14px",
      });
      if (mobile) {
        pop.style.left = pop.style.top = "";
        pop.dataset.side = r.top > innerHeight / 2 ? "top-sheet" : "sheet";
        return;
      }
      const pw = pop.offsetWidth;
      const ph = pop.offsetHeight;
      const room = {
        right: innerWidth - r.right,
        left: r.left,
        bottom: innerHeight - r.bottom,
        top: r.top,
      };
      const order = step.side ? [step.side, "right", "left", "bottom", "top"] : ["right", "left", "bottom", "top"];
      const fits = (s) => (s === "right" || s === "left" ? room[s] >= pw + GAP * 2 : room[s] >= ph + GAP * 2);
      const side = order.find(fits) ?? order.reduce((a, b) => (room[a] > room[b] ? a : b));
      let x;
      let y;
      if (side === "right" || side === "left") {
        x = side === "right" ? r.right + GAP : r.left - GAP - pw;
        y = (r.top + r.bottom) / 2 - ph / 2;
      } else {
        x = (r.left + r.right) / 2 - pw / 2;
        y = side === "bottom" ? r.bottom + GAP : r.top - GAP - ph;
      }
      pop.style.left = `${Math.round(Math.min(Math.max(GAP, x), innerWidth - pw - GAP))}px`;
      pop.style.top = `${Math.round(Math.min(Math.max(GAP, y), innerHeight - ph - GAP))}px`;
      pop.dataset.side = side;
    } else {
      Object.assign(spot.style, { left: "50%", top: "50%", width: "0px", height: "0px" });
      pop.style.left = pop.style.top = "";
      pop.dataset.side = "center";
    }
  }

  function render() {
    const step = shown[index];
    const last = index === shown.length - 1;
    progress.textContent = index === 0 && !resolve(step)?.rect ? "Welcome" : `Step ${index + 1} of ${shown.length}`;
    title.textContent = step.title;
    body.textContent = step.body;
    back.hidden = index === 0;
    next.textContent = step.cta ?? (last ? "Finish" : "Next");
    [...dots.children].forEach((d, i) => d.classList.toggle("is-active", i === index));
    pop.classList.remove("is-in");
    // Restart the arrival animation.
    void pop.offsetWidth;
    pop.classList.add("is-in");
    place();
    next.focus({ preventScroll: true });
  }

  function close(completed) {
    if (closed) return;
    closed = true;
    removeEventListener("resize", onResize);
    removeEventListener("scroll", onResize, true);
    document.removeEventListener("keydown", onKey, true);
    root.classList.add("is-out");
    setTimeout(() => root.remove(), 180);
    if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    onClose?.({ completed, index });
  }

  function go(delta) {
    const target = index + delta;
    if (target >= shown.length) return close(true);
    if (target < 0) return;
    index = target;
    render();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    } else if (e.key === "ArrowRight" && !(e.target instanceof HTMLButtonElement && e.target === back)) {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Tab") {
      // Keep focus inside the card.
      const focusables = [...pop.querySelectorAll("button:not([hidden])")];
      const i = focusables.indexOf(document.activeElement);
      e.preventDefault();
      focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length]?.focus();
    }
  }

  let raf = 0;
  function onResize() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  }

  next.addEventListener("click", () => go(1));
  back.addEventListener("click", () => go(-1));
  skip.addEventListener("click", () => close(false));
  root.addEventListener("pointerdown", (e) => {
    // Clicks outside the card are swallowed so the page doesn't change under the tour.
    if (!pop.contains(e.target)) e.preventDefault();
  });
  addEventListener("resize", onResize);
  addEventListener("scroll", onResize, true);
  document.addEventListener("keydown", onKey, true);

  if (!shown.length) {
    close(true);
    return { close };
  }
  requestAnimationFrame(() => {
    root.classList.add("is-open");
    render();
  });
  return { close: () => close(false) };
}

/** The Finish Library (configurator) walkthrough. */
export function finishLibrarySteps(name = "") {
  return [
    {
      title: name ? `Welcome to the Finish Library, ${name}` : "Welcome to the Finish Library",
      body: "Here’s a one-minute tour: how to find a finish, see it on the product, and choose how the logo is applied.",
      cta: "Start the tour",
    },
    {
      target: "#material-row",
      title: "Start with a material",
      body: "Ceramic, glass, stainless steel or plastic. Each tab loads that product and its finishes.",
    },
    {
      target: ".finish-dial",
      title: "Browse finishes on the wheel",
      body: "Scroll or drag the wheel, or click any swatch to jump straight to it. The product updates as you go.",
    },
    {
      target: ".finish-dial-search",
      title: "Search and filter",
      body: "Type a finish name, or narrow the wheel by color, style or finish process.",
    },
    {
      target: ".specs-card",
      title: "Check the details",
      body: "Durability and cost ratings for the selected finish, with notes on how it’s made.",
    },
    {
      rect: () => {
        const w = Math.min(innerWidth * 0.34, 520);
        const hgt = Math.min(innerHeight * 0.5, 520);
        return { left: innerWidth / 2 - w / 2, top: innerHeight * 0.44 - hgt / 2, right: innerWidth / 2 + w / 2, bottom: innerHeight * 0.44 + hgt / 2 };
      },
      title: "Turn the product",
      body: "In 3D, click and drag to orbit the product. Use the zoom buttons on the left, or reset the view.",
    },
    {
      target: ".preview-view-toggle",
      title: "Switch between 3D and 2D",
      body: "2D shows flat front and back views for specs. 3D is best for reviews.",
      round: true,
    },
    {
      target: ".preview-zone",
      title: "Finish the body or the logo",
      body: "Pick Body or Logo to finish each part separately, or use Match body to keep them the same.",
      round: true,
    },
    {
      target: ".graphic-shelf",
      title: "Choose a logo application",
      body: "See the logo laser etched, printed, embossed and more, rendered on the product in the current finish.",
      side: "top",
    },
    {
      target: ".core-home-account__trigger",
      title: "Your profile and settings",
      body: "Update your profile, switch light or dark mode, or take this walkthrough again any time from here.",
      round: true,
      cta: "Finish",
    },
  ];
}
