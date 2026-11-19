import { getStoredTheme, setLuminaTheme } from "./components/core-home-navbar.js";
import {
  initPreview,
  updatePreview,
  zoomPreview,
  setPreviewAutoRotate,
  setPreviewView,
  getPreviewView,
} from "./configurator-preview.js";
import { renderGraphicThumbs } from "./graphic-thumbs.js";
import { createFinishWheel } from "./finish-wheel.js";
import { materialThumbHtml } from "./library-icons.js";
import {
  browseFinishes,
  COLOR_GROUPS,
  FINISH_SORT_OPTIONS,
  focusIndexForBrowse,
  STYLE_FILTER_FAMILIES,
  uniqueFinishProcesses,
} from "./finish-wheel-filters.js";

const API = "/api";


const state = {
  luminaTheme: "light",
  material: "stainless_steel",
  catalog: null,
  finishes: [],
  filteredFinishes: [],
  finishIndex: 0,
  finishId: null,
  graphicId: null,
  previewReady: false,
  previewAutoRotate: false,
  // The finish wheel edits one product zone at a time; the logo follows the body until picked.
  activeZone: "body",
  bodyFinishId: null,
  logoFinishId: null,
  zoneEntryFinishId: null,
  finishSearchQuery: "",
  finishSort: "name-az",
  finishFilterProcess: "",
  finishFilterStyle: "",
  finishFilterColor: "",
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

function finishById(id) {
  return id ? state.finishes.find((f) => f.id === id) ?? null : null;
}

function recordZoneFinish(current) {
  if (!current) return;
  if (state.activeZone === "body") {
    state.bodyFinishId = current.id;
  } else if (current.id !== state.zoneEntryFinishId) {
    state.logoFinishId = current.id;
    state.zoneEntryFinishId = null;
  }
}

function updateZoneControls() {
  document.querySelectorAll(".preview-zone-btn").forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.dataset.zone === state.activeZone));
  });
  const reset = document.getElementById("preview-zone-reset");
  if (reset) reset.hidden = !state.logoFinishId;
}

function syncPreview() {
  const current = selectedFinish();
  recordZoneFinish(current);
  updateZoneControls();
  if (!state.previewReady) return;
  const body = state.activeZone === "body" ? current : finishById(state.bodyFinishId) ?? current;
  updatePreview({
    materialSlug: state.material,
    finish: body,
    logoFinish: getPreviewView() === "3d" ? finishById(state.logoFinishId) : null,
    graphic: selectedGraphic(current),
    theme: state.luminaTheme,
  });
}

function setActiveZone(zone) {
  state.activeZone = zone;
  const targetId = zone === "logo" ? state.logoFinishId ?? state.bodyFinishId : state.bodyFinishId;
  const index = state.filteredFinishes.findIndex((f) => f.id === targetId);
  if (index >= 0 && index !== state.finishIndex) {
    state.finishIndex = index;
    state.finishId = targetId;
    updateWheelLayout();
    updateSpecs();
    renderCarousel();
  }
  state.zoneEntryFinishId = selectedFinish()?.id ?? null;
  syncPreview();
}

function resetZones() {
  state.activeZone = "body";
  state.bodyFinishId = null;
  state.logoFinishId = null;
  state.zoneEntryFinishId = null;
}

/** Open the request builder with the finishes currently chosen for each zone. */
function bindCreateRequest() {
  document.getElementById("create-render-request")?.addEventListener("click", () => {
    const body = state.bodyFinishId ?? selectedFinish()?.id ?? null;
    if (!body) {
      setBanner("Pick a finish first, then create a render request.", "error");
      return;
    }
    const params = new URLSearchParams({ body });
    if (state.logoFinishId) params.set("logo", state.logoFinishId);
    location.href = `/request.html?${params}`;
  });
}

function bindZoneToggle() {
  document.querySelectorAll(".preview-zone-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveZone(btn.dataset.zone));
  });
  document.getElementById("preview-zone-reset")?.addEventListener("click", () => {
    state.logoFinishId = null;
    setActiveZone("body");
  });
}

async function ensurePreview() {
  const el = document.getElementById("preview-stage");
  if (!el || state.previewReady) return;
  try {
    const ok = await initPreview(el, {
      onReady: () => {
        state.previewReady = true;
        syncPreview();
      },
      onError: (msg) => setBanner(msg, "error"),
    });
    if (ok === false) state.previewReady = false;
  } catch (err) {
    console.error("Preview unavailable", err);
    setBanner("Preview could not load. Finish details still work.", "error");
  }
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
    cost.removeAttribute("title");
    notes.textContent = "";
    notes.removeAttribute("title");
    return;
  }

  state.finishId = finish.id;
  name.textContent = finish.name;
  name.title = finish.name;
  durability.textContent = formatRating(finish.durabilityScore);
  cost.textContent = formatRating(finish.costTier);
  if (finish.costNote) cost.title = finish.costNote;
  else cost.removeAttribute("title");
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

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function finishBrowseOptions() {
  return {
    query: state.finishSearchQuery,
    sort: state.finishSort,
    process: state.finishFilterProcess,
    styleFamily: state.finishFilterStyle,
    colorGroup: state.finishFilterColor,
  };
}

function readFinishBrowseControls() {
  state.finishSearchQuery = document.getElementById("finish-search")?.value ?? "";
  state.finishSort = document.getElementById("finish-sort")?.value ?? "name-az";
  state.finishFilterProcess = document.getElementById("finish-filter-process")?.value ?? "";
  state.finishFilterStyle = document.getElementById("finish-filter-style")?.value ?? "";
  state.finishFilterColor = document.getElementById("finish-filter-color")?.value ?? "";
}

function fillSelectOptions(select, options, selected) {
  if (!select) return;
  select.innerHTML = "";
  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.id;
    el.textContent = opt.label;
    if (opt.id === selected) el.selected = true;
    select.appendChild(el);
  }
}

function populateFinishBrowseControls() {
  fillSelectOptions(
    document.getElementById("finish-sort"),
    FINISH_SORT_OPTIONS,
    state.finishSort,
  );
  fillSelectOptions(
    document.getElementById("finish-filter-color"),
    COLOR_GROUPS,
    state.finishFilterColor,
  );
  fillSelectOptions(
    document.getElementById("finish-filter-style"),
    [{ id: "", label: "All styles" }, ...STYLE_FILTER_FAMILIES.map((f) => ({ id: f.id, label: f.label }))],
    state.finishFilterStyle,
  );
  fillSelectOptions(
    document.getElementById("finish-filter-process"),
    [{ id: "", label: "All processes" }, ...uniqueFinishProcesses(state.finishes).map((p) => ({ id: p.slug, label: p.label }))],
    state.finishFilterProcess,
  );
}

function updateFinishSearchStatus() {
  const status = document.getElementById("finish-search-status");
  if (!status) return;

  const count = state.filteredFinishes.length;
  const total = state.finishes.length;
  const query = state.finishSearchQuery.trim();
  const hasFilter =
    query ||
    state.finishFilterProcess ||
    state.finishFilterStyle ||
    state.finishFilterColor ||
    state.finishSort !== "name-az";

  if (!hasFilter) {
    status.hidden = true;
    status.textContent = "";
    return;
  }

  status.hidden = false;
  if (!count) {
    status.textContent = "No finishes match your search and filters.";
    return;
  }
  const parts = [`Showing ${count} of ${total}`];
  if (query) parts.push(`for “${query}”`);
  status.textContent = `${parts.join(" ")}.`;
}

function applyFinishBrowse({ keepSelection = false } = {}) {
  readFinishBrowseControls();
  state.filteredFinishes = browseFinishes(state.finishes, finishBrowseOptions());
  updateFinishSearchStatus();

  if (!state.filteredFinishes.length) {
    state.finishIndex = 0;
    state.finishId = null;
    state.graphicId = null;
    renderWheel();
    updateSpecs();
    syncPreview();
    renderCarousel();
    return;
  }

  let index = focusIndexForBrowse(state.filteredFinishes, state.finishSearchQuery);
  if (keepSelection && state.finishId) {
    const current = state.filteredFinishes.findIndex((f) => f.id === state.finishId);
    if (current >= 0) index = current;
  }

  const finish = state.filteredFinishes[index];
  state.finishIndex = index;
  state.finishId = finish?.id ?? null;
  const graphics = compatibleGraphics(finish);
  state.graphicId = graphics[0]?.id ?? null;
  renderWheel();
  updateSpecs();
  syncPreview();
  renderCarousel();
}

function resetFinishBrowse() {
  state.finishSearchQuery = "";
  state.finishSort = "name-az";
  state.finishFilterProcess = "";
  state.finishFilterStyle = "";
  state.finishFilterColor = "";
  const input = document.getElementById("finish-search");
  if (input) input.value = "";
  populateFinishBrowseControls();
  updateFinishSearchStatus();
}

function bindFinishSearch() {
  populateFinishBrowseControls();

  const input = document.getElementById("finish-search");
  const runBrowse = debounce(() => applyFinishBrowse(), 120);
  input?.addEventListener("input", runBrowse);
  input?.addEventListener("search", runBrowse);

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      resetFinishBrowse();
      applyFinishBrowse();
      input.blur();
    }
  });

  for (const id of ["finish-sort", "finish-filter-color", "finish-filter-style", "finish-filter-process"]) {
    document.getElementById(id)?.addEventListener("change", () => applyFinishBrowse());
  }
}

let finishWheel = null;

/** Round swatch for a finish: its photo / render, else the catalog colour. */
function renderFinishSwatch(finish) {
  const swatch = document.createElement("span");
  swatch.className = "finish-swatch";
  if (finish.imageUrl) {
    swatch.classList.add("has-render");
    if (finish.imageSource === "factory_photo") swatch.classList.add("is-photo");
    const img = document.createElement("img");
    img.src = finish.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    swatch.appendChild(img);
  } else {
    swatch.style.background = finish.hexColor || "#c3c6d7";
  }
  return swatch;
}

function ensureFinishWheel() {
  if (finishWheel) return finishWheel;
  const viewport = wheelViewport();
  const list = wheelList();
  const root = viewport?.closest(".finish-dial");
  if (!viewport || !list || !root) return null;
  finishWheel = createFinishWheel({
    root,
    viewport,
    list,
    renderSwatch: renderFinishSwatch,
    onSelect: (index) => selectFinishIndex(index, { fromWheel: true }),
  });
  return finishWheel;
}

/** Point the wheel at state.finishIndex (after a change made outside the wheel). */
function updateWheelLayout() {
  ensureFinishWheel()?.setIndex(state.finishIndex);
}

function buildWheelItems() {
  ensureFinishWheel()?.setItems(state.filteredFinishes, state.finishIndex);
}

function renderWheel() {
  buildWheelItems();
  updateWheelLayout();
  updateSpecs();
  syncPreview();
  renderCarousel();
}

function selectFinishIndex(index, { fromWheel = false } = {}) {
  if (index < 0 || index >= state.filteredFinishes.length) return;
  if (index === state.finishIndex) return;
  state.finishIndex = index;
  const finish = state.filteredFinishes[index];
  state.finishId = finish?.id ?? null;
  const graphics = compatibleGraphics(finish);
  state.graphicId = graphics[0]?.id ?? null;
  if (!fromWheel) updateWheelLayout();
  updateSpecs();
  syncPreview();
  renderCarousel();
}

function bindFinishWheel() {
  ensureFinishWheel();
  document.getElementById("wheel-up")?.addEventListener("click", () => {
    selectFinishIndex(state.finishIndex - 1);
  });
  document.getElementById("wheel-down")?.addEventListener("click", () => {
    selectFinishIndex(state.finishIndex + 1);
  });
}

function catalogForMaterial(data, materialSlug) {
  const material = materialSlug ?? data.material ?? state.material;
  const finishes = (data.finishes ?? []).filter(
    (f) =>
      (!f.materialSlug || f.materialSlug === material) && f.availability !== "not_offered",
  );
  const graphicApplicationTypes = (data.graphicApplicationTypes ?? []).filter(
    (g) => !g.materialSlug || g.materialSlug === material,
  );
  return { ...data, material, finishes, graphicApplicationTypes };
}

async function loadFinishesForMaterial() {
  const data = await api(`/catalog?material=${encodeURIComponent(state.material)}`);
  state.catalog = catalogForMaterial(data, state.material);
  state.finishes = state.catalog.finishes ?? [];
  resetFinishBrowse();
  resetZones();
  state.filteredFinishes = browseFinishes(state.finishes, finishBrowseOptions());
  state.finishIndex = 0;
  state.finishId = state.finishes[0]?.id ?? null;
  const g0 = compatibleGraphics(state.finishes[0])[0];
  state.graphicId = g0?.id ?? null;
  populateFinishBrowseControls();
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

    const shortLabel =
      mat.slug === "stainless_steel" ? "S. Steel" : mat.label?.replace("Stainless Steel", "S. Steel") ?? mat.label;

    btn.innerHTML = `
      ${materialThumbHtml(mat.slug, shortLabel)}
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

  const thumbs = [];
  graphics.forEach((g) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "graphic-card";
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", g.id === state.graphicId);

    // Thumbnail: the product in this finish wearing the logo in this application's style.
    card.innerHTML = `
      <div class="graphic-card-thumb">
        <canvas width="192" height="128" aria-hidden="true"></canvas>
      </div>
      <span class="graphic-card-label">${g.uiLabel}</span>
    `;
    thumbs.push({ graphic: g, canvas: card.querySelector("canvas") });

    card.addEventListener("click", () => {
      state.graphicId = g.id;
      renderCarousel();
      syncPreview();
    });
    track.appendChild(card);
  });
  renderGraphicThumbs({ materialSlug: state.material, finish, items: thumbs }).catch((err) =>
    console.warn("Graphic thumbnails", err),
  );
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

function bindViewToggle() {
  document.querySelectorAll(".preview-view-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const view = btn.dataset.view;
      if (!view || view === getPreviewView()) return;
      state.previewReady = false;
      const ok = await setPreviewView(view);
      state.previewReady = Boolean(ok);
      if (ok) syncPreview();
    });
  });
}

function bindControls() {
  ensurePreview();
  bindHudMobileDock();
  bindPreviewZoom();
  bindViewToggle();
  bindZoneToggle();
  bindCreateRequest();
  bindFinishWheel();
  bindFinishSearch();

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

}

function finishIndexFromSlug(slug) {
  if (!slug) return -1;
  const needle = String(slug).trim().toLowerCase();
  return state.filteredFinishes.findIndex((f) => String(f.slug).toLowerCase() === needle);
}

function applyFinishDeepLink() {
  const slug = new URLSearchParams(location.search).get("finish");
  if (!slug) return;
  let index = finishIndexFromSlug(slug);
  if (index < 0) {
    resetFinishBrowse();
    state.filteredFinishes = browseFinishes(state.finishes, finishBrowseOptions());
    populateFinishBrowseControls();
    index = finishIndexFromSlug(slug);
  }
  if (index < 0) return;
  selectFinishIndex(index);
}

async function loadCatalog() {
  const data = await api(`/catalog?material=${encodeURIComponent(state.material)}`);
  state.catalog = catalogForMaterial(data, state.material);
  state.finishes = state.catalog.finishes ?? [];
  resetFinishBrowse();
  state.filteredFinishes = browseFinishes(state.finishes, finishBrowseOptions());
  state.finishIndex = 0;
  state.finishId = state.finishes[0]?.id ?? null;
  const g0 = compatibleGraphics(state.finishes[0])[0];
  state.graphicId = g0?.id ?? null;

  renderMaterials();
  populateFinishBrowseControls();
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
