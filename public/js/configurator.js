import { getStoredTheme, setLuminaTheme } from "./components/core-home-navbar.js";
import {
  initPreview3d,
  setPreviewAutoRotate,
  updatePreview3d,
  zoomPreview,
} from "./configurator-preview-3d.js";

const API = "/api";

const MATERIAL_ICONS = {
  ceramic: "breakfast_dining",
  glass: "window",
  stainless_steel: "rebase",
  plastic: "shopping_bag",
};

const WHEEL_ITEM_STEP = 68;
const WHEEL_ARC_X = -16;
const WHEEL_FADE_SPREAD = 3.25;

const GRAPHIC_ICONS = {
  "graphic.embossed_decal": "texture",
  "graphic.silk_print": "print",
  "graphic.laser_decal": "flare",
  "graphic.wax_resist": "waves",
  "graphic.debossed": "check_box_outline_blank",
  "graphic.embossed": "layers",
};

const state = {
  luminaTheme: "light",
  material: "stainless_steel",
  catalog: null,
  finishes: [],
  filteredFinishes: [],
  finishIndex: 0,
  finishId: null,
  graphicId: null,
  preview3dReady: false,
  previewAutoRotate: false,
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function setBanner(message, type = "") {
  const el = document.getElementById("page-banner");
  if (!el) return;
  el.textContent = message;
  el.className = `status-banner${type ? ` ${type}` : ""}`;
  el.hidden = !message;
}

function applyTheme(mode) {
  state.luminaTheme = mode;
  setLuminaTheme(mode);
  syncPreview();
}

function selectedGraphic(finish) {
  const graphics = compatibleGraphics(finish);
  return graphics.find((g) => g.id === state.graphicId) ?? graphics[0] ?? null;
}

function syncPreview() {
  if (!state.preview3dReady) return;
  const finish = selectedFinish();
  updatePreview3d({
    materialSlug: state.material,
    finish,
    graphic: selectedGraphic(finish),
    theme: state.luminaTheme,
  });
}

function ensurePreview3d() {
  const el = document.getElementById("preview-3d");
  if (!el || state.preview3dReady) return;
  const ok = initPreview3d(el, {
    onReady: () => {
      state.preview3dReady = true;
      syncPreview();
    },
    onError: (msg) => setBanner(msg, "error"),
  });
  if (ok === false) state.preview3dReady = false;
}

function selectedFinish() {
  return state.filteredFinishes[state.finishIndex] ?? null;
}

function compatibleGraphics(finish) {
  if (!finish || !state.catalog) return [];
  const ids = new Set(finish.compatibleGraphics ?? []);
  return state.catalog.graphicApplicationTypes.filter((g) => ids.has(g.id));
}

function formatRating(value, max = 5) {
  const n = Math.round(Number(value) || 0);
  if (n <= 0) return "—";
  return `${n}/${max}`;
}

function updateSpecs() {
  const finish = selectedFinish();
  const name = document.getElementById("specs-name");
  const durability = document.getElementById("durability-value");
  const cost = document.getElementById("cost-value");
  const notes = document.getElementById("specs-notes");

  if (!finish) {
    name.textContent = "Select a finish";
    name.removeAttribute("title");
    durability.textContent = "—";
    cost.textContent = "—";
    notes.textContent = "";
    notes.removeAttribute("title");
    return;
  }

  state.finishId = finish.id;
  name.textContent = finish.name;
  name.title = finish.name;
  durability.textContent = formatRating(finish.durabilityScore);
  cost.textContent = formatRating(finish.costTier);
  const noteText = finish.durabilityNotes || finish.description || "";
  notes.textContent = noteText;
  notes.title = noteText;
}

function wheelViewport() {
  return document.getElementById("wheel-viewport");
}

function wheelList() {
  return document.getElementById("wheel-list");
}

function applyWheelItemVisuals(items, focusIndex) {
  items.forEach((el, i) => {
    const dist = Math.abs(i - focusIndex);
    const t = Math.min(dist / WHEEL_FADE_SPREAD, 1);
    const scale = 1 - t * 0.38;
    const opacity = Math.max(0.15, 1 - t * 0.85);
    const arcX = WHEEL_ARC_X * (1 - t ** 0.9);
    el.style.setProperty("--wheel-scale", String(scale));
    el.style.setProperty("--wheel-opacity", String(opacity));
    el.style.setProperty("--wheel-x", `${arcX}px`);
    el.classList.toggle("is-active", i === focusIndex);
    el.classList.toggle("is-near", dist === 1);
    el.setAttribute("aria-selected", i === focusIndex);
  });
}

function updateWheelLayout() {
  const viewport = wheelViewport();
  const list = wheelList();
  if (!viewport || !list) return;

  const items = [...list.querySelectorAll(".wheel-item")];
  const count = items.length;
  if (!count) return;

  const index = Math.min(state.finishIndex, count - 1);
  state.finishIndex = index;

  const viewH = viewport.clientHeight || 360;
  const pad = viewH / 2 - WHEEL_ITEM_STEP / 2;
  list.style.setProperty("--wheel-item-step", `${WHEEL_ITEM_STEP}px`);
  list.style.paddingTop = `${pad}px`;
  list.style.paddingBottom = `${pad}px`;
  list.style.transform = `translateY(${-index * WHEEL_ITEM_STEP}px)`;
  applyWheelItemVisuals(items, index);
}

function buildWheelItems() {
  const list = wheelList();
  list.innerHTML = "";
  const finishes = state.filteredFinishes;

  finishes.forEach((finish, index) => {
    const li = document.createElement("li");
    li.className = "wheel-item";
    li.dataset.index = String(index);
    li.setAttribute("role", "option");

    const inner = document.createElement("div");
    inner.className = "wheel-item-inner";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "finish-swatch-btn";
    btn.setAttribute("aria-label", finish.name);

    const swatch = document.createElement("span");
    swatch.className = "finish-swatch";
    swatch.style.background = finish.hexColor || "#c3c6d7";
    btn.appendChild(swatch);

    const label = document.createElement("span");
    label.className = "wheel-item-label";
    label.textContent = finish.name;

    inner.appendChild(btn);
    inner.appendChild(label);
    li.appendChild(inner);
    btn.addEventListener("click", () => selectFinishIndex(index));
    list.appendChild(li);
  });
}

function renderWheel() {
  buildWheelItems();
  updateWheelLayout();
  updateSpecs();
  syncPreview();
  renderCarousel();
}

function selectFinishIndex(index) {
  if (index < 0 || index >= state.filteredFinishes.length) return;
  if (index === state.finishIndex) return;
  state.finishIndex = index;
  const finish = state.filteredFinishes[index];
  state.finishId = finish?.id ?? null;
  const graphics = compatibleGraphics(finish);
  state.graphicId = graphics[0]?.id ?? null;
  updateWheelLayout();
  updateSpecs();
  syncPreview();
  renderCarousel();
}

function bindFinishWheel() {
  const viewport = wheelViewport();
  const list = wheelList();
  if (!viewport || !list) return;

  let wheelAccum = 0;
  const WHEEL_THRESHOLD = 48;

  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
      const step = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      selectFinishIndex(state.finishIndex + step);
    },
    { passive: false }
  );

  let dragStartY = 0;
  let dragStartIndex = 0;
  let dragging = false;

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStartY = e.clientY;
    dragStartIndex = state.finishIndex;
    list.classList.add("is-dragging");
    viewport.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const delta = e.clientY - dragStartY;
    const offset = -dragStartIndex * WHEEL_ITEM_STEP + delta;
    list.style.transform = `translateY(${offset}px)`;
    const raw = dragStartIndex - Math.round(delta / WHEEL_ITEM_STEP);
    const preview = Math.max(0, Math.min(state.filteredFinishes.length - 1, raw));
    applyWheelItemVisuals([...list.querySelectorAll(".wheel-item")], preview);
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    list.classList.remove("is-dragging");
    viewport.releasePointerCapture(e.pointerId);
    const delta = e.clientY - dragStartY;
    const next = Math.max(
      0,
      Math.min(
        state.filteredFinishes.length - 1,
        dragStartIndex - Math.round(delta / WHEEL_ITEM_STEP)
      )
    );
    selectFinishIndex(next);
  };

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);

  document.getElementById("wheel-up")?.addEventListener("click", () => {
    selectFinishIndex(state.finishIndex - 1);
  });
  document.getElementById("wheel-down")?.addEventListener("click", () => {
    selectFinishIndex(state.finishIndex + 1);
  });

  window.addEventListener("resize", () => updateWheelLayout());
}

async function loadFinishesForMaterial() {
  const data = await api(`/catalog?material=${encodeURIComponent(state.material)}`);
  state.catalog = data;
  state.finishes = data.finishes ?? [];
  state.filteredFinishes = [...state.finishes];
  state.finishIndex = 0;
  state.finishId = state.finishes[0]?.id ?? null;
  const g0 = compatibleGraphics(state.finishes[0])[0];
  state.graphicId = g0?.id ?? null;
  renderWheel();
  syncPreview();
}

function renderMaterials() {
  const row = document.getElementById("material-row");
  row.innerHTML = "";
  const materials = state.catalog?.materials ?? [];

  for (const mat of materials) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "material-tab";
    btn.setAttribute("role", "tab");
    const enabled = mat.enabled === 1 || mat.enabled === true;
    if (!enabled) {
      btn.disabled = true;
      btn.title = "Coming soon";
    }
    const selected = mat.slug === state.material;
    btn.setAttribute("aria-selected", selected);

    const icon = MATERIAL_ICONS[mat.slug] ?? "category";
    const shortLabel =
      mat.slug === "stainless_steel" ? "S. Steel" : mat.label?.replace("Stainless Steel", "S. Steel") ?? mat.label;

    btn.innerHTML = `
      <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
      <span>${shortLabel}</span>
    `;

    if (enabled) {
      btn.addEventListener("click", async () => {
        if (state.material === mat.slug) return;
        state.material = mat.slug;
        renderMaterials();
        await loadFinishesForMaterial();
      });
    }
    row.appendChild(btn);
  }
}

function renderCarousel() {
  const track = document.getElementById("carousel-track");
  track.innerHTML = "";

  const finish = selectedFinish();
  const graphics = compatibleGraphics(finish);

  if (!graphics.length) {
    track.innerHTML = '<p class="empty-state">No graphic applications for this finish.</p>';
    state.graphicId = null;
    syncPreview();
    return;
  }

  if (!graphics.some((g) => g.id === state.graphicId)) {
    state.graphicId = graphics[0].id;
  }

  graphics.forEach((g) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "graphic-card";
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", g.id === state.graphicId);

    const icon = GRAPHIC_ICONS[g.templateKey] ?? "texture";

    card.innerHTML = `
      <div class="graphic-card-thumb">
        <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
      </div>
      <span class="graphic-card-label">${g.uiLabel}</span>
    `;

    card.addEventListener("click", () => {
      state.graphicId = g.id;
      renderCarousel();
      syncPreview();
    });
    track.appendChild(card);
  });
}

function bindHudMobileDock() {
  const dock = document.querySelector(".hud-mobile-dock");
  if (!dock) return;

  const panels = {
    specs: document.querySelector('[data-hud-panel-id="specs"]'),
    finish: document.querySelector('[data-hud-panel-id="finish"]'),
    graphics: document.querySelector('[data-hud-panel-id="graphics"]'),
  };

  const mq = window.matchMedia("(max-width: 1023px)");

  const syncPanels = () => {
    if (!mq.matches) {
      for (const el of Object.values(panels)) {
        el?.classList.remove("is-mobile-open");
      }
      return;
    }
    const active =
      dock.querySelector('.hud-mobile-dock-btn[aria-expanded="true"]')?.dataset.hudPanel ?? "finish";
    for (const [id, el] of Object.entries(panels)) {
      el?.classList.toggle("is-mobile-open", id === active);
    }
  };

  dock.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hud-panel]");
    if (!btn || !mq.matches) return;
    const id = btn.dataset.hudPanel;
    dock.querySelectorAll("[data-hud-panel]").forEach((b) => {
      b.setAttribute("aria-expanded", String(b === btn));
    });
    for (const [pid, el] of Object.entries(panels)) {
      el?.classList.toggle("is-mobile-open", pid === id);
    }
  });

  mq.addEventListener("change", syncPanels);
  syncPanels();
}

function bindPreviewZoom() {
  document.getElementById("preview-zoom-in")?.addEventListener("click", () => zoomPreview(0.12));
  document.getElementById("preview-zoom-out")?.addEventListener("click", () => zoomPreview(-0.12));

  const btn360 = document.getElementById("preview-zoom-360");
  btn360?.addEventListener("click", () => {
    state.previewAutoRotate = !state.previewAutoRotate;
    setPreviewAutoRotate(state.previewAutoRotate);
    btn360.setAttribute("aria-pressed", String(state.previewAutoRotate));
    btn360.classList.toggle("is-active", state.previewAutoRotate);
  });
}

function bindControls() {
  ensurePreview3d();
  bindHudMobileDock();
  bindPreviewZoom();
  bindFinishWheel();

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const onWheel = document.activeElement === wheelViewport();
    if (!onWheel && e.target.matches("button:not(#wheel-up):not(#wheel-down)")) return;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectFinishIndex(state.finishIndex - 1);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      selectFinishIndex(state.finishIndex + 1);
    }
  });

  wheelViewport()?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectFinishIndex(state.finishIndex - 1);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      selectFinishIndex(state.finishIndex + 1);
    }
  });
}

function finishIndexFromSlug(slug) {
  if (!slug) return -1;
  const needle = String(slug).trim().toLowerCase();
  return state.filteredFinishes.findIndex((f) => String(f.slug).toLowerCase() === needle);
}

function applyFinishDeepLink() {
  const slug = new URLSearchParams(location.search).get("finish");
  const index = finishIndexFromSlug(slug);
  if (index < 0) return;
  selectFinishIndex(index);
}

async function loadCatalog() {
  const data = await api(`/catalog?material=${encodeURIComponent(state.material)}`);
  state.catalog = data;
  state.finishes = data.finishes ?? [];
  state.filteredFinishes = [...state.finishes];
  state.finishIndex = 0;
  state.finishId = state.finishes[0]?.id ?? null;
  const g0 = compatibleGraphics(state.finishes[0])[0];
  state.graphicId = g0?.id ?? null;

  renderMaterials();
  renderWheel();
  applyFinishDeepLink();
  syncPreview();
}

document.addEventListener("lumina-theme-change", (e) => {
  state.luminaTheme = e.detail.mode;
  syncPreview();
});

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getStoredTheme());
  bindControls();
  loadCatalog().catch((err) => setBanner(err.message, "error"));
});
