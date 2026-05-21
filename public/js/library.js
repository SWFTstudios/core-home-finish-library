import {
  buildLibraryTree,
  filterFinishes,
  inferStyleFamily,
  MATERIAL_ICONS,
  processMeta,
  styleFamilyById,
} from "./library-grouping.js";
import { swatchStyle, formatRating, costDots } from "./finish-swatch.js";
import { taxonomyIconHtml } from "./library-icons.js";

const API = "/api";
const DEFAULT_MATERIAL = "stainless_steel";

const state = {
  material: DEFAULT_MATERIAL,
  processId: null,
  familyId: null,
  searchQuery: "",
  catalog: null,
  materials: [],
  finishes: [],
  graphicTypes: [],
  processes: [],
  detailFinish: null,
  detailTrigger: null,
};

function $(id) {
  return document.getElementById(id);
}

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function isMobile() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function normalizeFinish(f) {
  return {
    ...f,
    category: f.category ?? f.finishProcess ?? "Other",
    finishProcess: f.finishProcess ?? f.category ?? "Other",
  };
}

function readUrlState() {
  const p = new URLSearchParams(location.search);
  return {
    material: p.get("material") || DEFAULT_MATERIAL,
    process: p.get("process"),
    family: p.get("family"),
    q: p.get("q") || "",
  };
}

function syncUrlState() {
  const p = new URLSearchParams();
  p.set("material", state.material);
  if (state.processId) p.set("process", state.processId);
  if (state.familyId) p.set("family", state.familyId);
  if (state.searchQuery.trim()) p.set("q", state.searchQuery.trim());
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function setBanner(message, type = "") {
  const el = $("page-banner");
  if (!el) return;
  el.textContent = message;
  el.className = `status-banner library-banner${type ? ` ${type}` : ""}`;
  el.hidden = !message;
}

function materialEnabled(m) {
  return m.enabled === 1 || m.enabled === true;
}

function currentMaterial() {
  return state.materials.find((m) => m.slug === state.material) ?? null;
}

function filteredFinishes() {
  return filterFinishes(state.finishes, state.searchQuery);
}

function rebuildProcesses() {
  const mat = currentMaterial();
  if (!mat || !materialEnabled(mat)) {
    state.processes = [];
    return;
  }
  const tree = buildLibraryTree([mat], filteredFinishes());
  state.processes = tree[0]?.processes ?? [];
  if (!state.processes.some((p) => p.id === state.processId)) {
    state.processId = state.processes[0]?.id ?? null;
  }
}

function activeProcess() {
  return state.processes.find((p) => p.id === state.processId) ?? state.processes[0] ?? null;
}

function renderMaterials() {
  const row = $("material-row");
  if (!row) return;
  row.innerHTML = "";

  for (const m of state.materials) {
    const enabled = materialEnabled(m);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "library-material-chip";
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-pressed", String(m.slug === state.material));
    btn.dataset.slug = m.slug;
    if (!enabled) {
      btn.disabled = true;
      btn.title = "Coming soon";
    }

    const icon = MATERIAL_ICONS[m.slug] || "category";
    btn.innerHTML = `${taxonomyIconHtml(icon, m.label || m.slug)}<span>${escapeHtml(m.label || m.slug)}</span>`;

    if (enabled) {
      btn.addEventListener("click", () => selectMaterial(m.slug));
    }
    row.appendChild(btn);
  }
}

function renderBreadcrumb() {
  const nav = $("library-breadcrumb");
  if (!nav) return;

  const mat = currentMaterial();
  const proc = activeProcess();
  const fam = state.familyId ? styleFamilyById(state.familyId) : null;

  const parts = [];
  if (mat) parts.push({ label: mat.label || mat.slug, current: !proc });
  if (proc) parts.push({ label: proc.label, current: !fam });
  if (fam && state.familyId) parts.push({ label: fam.label, current: true });

  if (!parts.length) {
    nav.innerHTML = "";
    return;
  }

  nav.innerHTML = parts
    .map((p, i) => {
      const sep = i > 0 ? '<span class="library-breadcrumb-sep" aria-hidden="true">›</span>' : "";
      const inner = p.current
        ? `<span aria-current="page">${escapeHtml(p.label)}</span>`
        : `<span>${escapeHtml(p.label)}</span>`;
      return `${sep}${inner}`;
    })
    .join("");
}

function renderProcessNav() {
  const nav = $("process-nav");
  if (!nav) return;
  nav.innerHTML = "";

  const mat = currentMaterial();
  if (!mat || !materialEnabled(mat)) {
    nav.innerHTML = '<p class="library-empty">Pick a material that is available.</p>';
    return;
  }

  if (!state.processes.length) {
    nav.innerHTML = '<p class="library-empty">No finish types match your search.</p>';
    return;
  }

  for (const proc of state.processes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "library-process-btn";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(proc.id === state.processId));
    btn.dataset.process = proc.id;
    btn.innerHTML = `${taxonomyIconHtml(proc.icon, proc.label)}<span>${escapeHtml(proc.label)}</span><span class="library-process-count">${proc.count}</span>`;
    btn.addEventListener("click", () => selectProcess(proc.id));
    nav.appendChild(btn);
  }
}

function renderFinishCard(finish) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "library-finish-card";
  btn.setAttribute("aria-label", `View ${finish.name}`);

  const swatch = document.createElement("div");
  swatch.className = "library-finish-swatch";
  Object.assign(swatch.style, swatchStyle(finish));
  if (finish.image_url || finish.imageUrl) {
    const img = document.createElement("img");
    img.src = finish.image_url || finish.imageUrl;
    img.alt = "";
    swatch.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "library-finish-body";
  body.innerHTML = `
    <p class="library-finish-name">${escapeHtml(finish.name)}</p>
    <div class="library-finish-meta">
      <span title="Cost">${costDots(finish.costTier)}</span>
      <span title="Durability">${formatRating(finish.durabilityScore)}</span>
    </div>
  `;

  btn.appendChild(swatch);
  btn.appendChild(body);
  btn.addEventListener("click", () => openDetail(finish, btn));
  return btn;
}

function renderSections() {
  const root = $("library-sections");
  if (!root) return;
  root.innerHTML = "";

  const mat = currentMaterial();
  if (!mat || !materialEnabled(mat)) {
    root.innerHTML =
      '<div class="library-empty"><strong>Coming soon</strong>This material is not in the library yet.</div>';
    return;
  }

  const proc = activeProcess();
  if (!proc) {
    root.innerHTML =
      '<div class="library-empty"><strong>No matches</strong>Try a different search or pick another type.</div>';
    return;
  }

  if (!proc.families.length) {
    root.innerHTML =
      '<div class="library-empty"><strong>No finishes here</strong>Nothing in this group matches your search.</div>';
    return;
  }

  const openId = state.familyId || proc.families[0]?.id;

  for (const family of proc.families) {
    const section = document.createElement("section");
    section.className = "library-family";
    section.dataset.family = family.id;
    const isOpen = family.id === openId;
    if (isOpen) section.classList.add("is-open");

    const header = document.createElement("button");
    header.type = "button";
    header.className = "library-family-header";
    header.setAttribute("aria-expanded", String(isOpen));
    header.setAttribute("aria-controls", `family-panel-${family.id}`);
    header.innerHTML = `
      <span class="library-family-icon">${taxonomyIconHtml(family.icon, family.label)}</span>
      <span class="library-family-text">
        <span class="library-family-title">${escapeHtml(family.label)}</span>
        <span class="library-family-desc">${escapeHtml(family.description)}</span>
      </span>
      <span class="library-family-badge">${family.count}</span>
      <span class="material-symbols-outlined library-family-chevron" aria-hidden="true">expand_more</span>
    `;

    const panel = document.createElement("div");
    panel.id = `family-panel-${family.id}`;
    panel.className = "library-family-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", family.label);

    const grid = document.createElement("div");
    grid.className = "library-finish-grid";
    for (const finish of family.finishes) {
      grid.appendChild(renderFinishCard(finish));
    }
    panel.appendChild(grid);

    header.addEventListener("click", () => toggleFamily(family.id, section));
    section.appendChild(header);
    section.appendChild(panel);
    root.appendChild(section);
  }
}

function toggleFamily(familyId, sectionEl) {
  const wasOpen = sectionEl.classList.contains("is-open");
  if (isMobile()) {
    document.querySelectorAll(".library-family.is-open").forEach((el) => {
      el.classList.remove("is-open");
      el.querySelector(".library-family-header")?.setAttribute("aria-expanded", "false");
    });
  }
  if (!wasOpen) {
    sectionEl.classList.add("is-open");
    sectionEl.querySelector(".library-family-header")?.setAttribute("aria-expanded", "true");
    state.familyId = familyId;
  } else {
    sectionEl.classList.remove("is-open");
    sectionEl.querySelector(".library-family-header")?.setAttribute("aria-expanded", "false");
    state.familyId = null;
  }
  renderBreadcrumb();
  syncUrlState();
}

function selectMaterial(slug) {
  if (slug === state.material) return;
  state.material = slug;
  state.processId = null;
  state.familyId = null;
  loadCatalog().catch(showError);
}

function selectProcess(processId) {
  state.processId = processId;
  state.familyId = null;
  renderProcessNav();
  renderBreadcrumb();
  renderSections();
  syncUrlState();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function graphicLabels(finish) {
  const ids = new Set(finish.compatibleGraphics ?? []);
  return state.graphicTypes.filter((g) => ids.has(g.id)).map((g) => g.uiLabel || g.label);
}

function openDetail(finish, triggerEl = null) {
  state.detailFinish = finish;
  state.detailTrigger = triggerEl;
  const panel = $("finish-detail");
  const backdrop = $("finish-detail-backdrop");
  const title = $("detail-title");
  const body = $("detail-body");
  const link = $("detail-configurator-link");

  if (!panel || !title || !body) return;

  title.textContent = finish.name;

  const swatch = document.createElement("div");
  swatch.className = "library-detail-swatch";
  Object.assign(swatch.style, swatchStyle(finish));

  const proc = finish.finishProcess || finish.category || "—";
  const meta = processMeta(proc);
  const family = styleFamilyById(inferStyleFamily(finish.name));
  const graphics = graphicLabels(finish);

  body.innerHTML = "";
  body.appendChild(swatch);

  const rows = [
    ["Type", meta.label],
    ["Style", family.label],
    ["Durability", formatRating(finish.durabilityScore)],
    ["Cost", costDots(finish.costTier)],
    ["Price band", finish.priceBand || "—"],
  ];

  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "library-detail-row";
    row.innerHTML = `
      <span class="library-detail-label">${escapeHtml(label)}</span>
      <p class="library-detail-value">${escapeHtml(String(value))}</p>
    `;
    body.appendChild(row);
  }

  const notes = finish.durabilityNotes || finish.description;
  if (notes && notes !== "/") {
    const row = document.createElement("div");
    row.className = "library-detail-row";
    row.innerHTML = `
      <span class="library-detail-label">Notes</span>
      <p class="library-detail-value">${escapeHtml(notes)}</p>
    `;
    body.appendChild(row);
  }

  if (graphics.length) {
    const row = document.createElement("div");
    row.className = "library-detail-row";
    row.innerHTML = `<span class="library-detail-label">Works with graphics</span>`;
    const chips = document.createElement("div");
    chips.className = "library-detail-chips";
    for (const g of graphics) {
      const chip = document.createElement("span");
      chip.className = "library-detail-chip";
      chip.textContent = g;
      chips.appendChild(chip);
    }
    row.appendChild(chips);
    body.appendChild(row);
  }

  if (link && finish.slug) {
    link.href = `/configurator/?finish=${encodeURIComponent(finish.slug)}`;
  }

  panel.hidden = false;
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.classList.add("is-open");
  }
  document.body.style.overflow = "hidden";
  panel.querySelector(".library-detail-close")?.focus();
}

function closeDetail() {
  const panel = $("finish-detail");
  const backdrop = $("finish-detail-backdrop");
  const trigger = state.detailTrigger;

  if (panel) {
    panel.hidden = true;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  }
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.classList.remove("is-open");
  }
  document.body.style.overflow = "";
  state.detailFinish = null;
  state.detailTrigger = null;
  trigger?.focus();
}

async function loadCatalog() {
  setBanner("");
  const data = await api(`/catalog?material=${encodeURIComponent(state.material)}`);
  state.catalog = data;
  state.materials = data.materials ?? [];
  state.graphicTypes = data.graphicApplicationTypes ?? [];
  state.finishes = (data.finishes ?? []).map(normalizeFinish);

  const mat = state.materials.find((m) => m.slug === state.material);
  if (!mat || !materialEnabled(mat)) {
    state.finishes = [];
  }

  rebuildProcesses();

  const url = readUrlState();
  if (url.process && state.processes.some((p) => p.id === url.process)) {
    state.processId = url.process;
  }
  if (url.family) state.familyId = url.family;

  renderMaterials();
  renderProcessNav();
  renderBreadcrumb();
  renderSections();
  syncUrlState();
}

function showError(err) {
  setBanner(err.message || "Something went wrong.", "error");
}

function bindUi() {
  $("library-search")?.addEventListener(
    "input",
    debounce((e) => {
      state.searchQuery = e.target.value;
      rebuildProcesses();
      renderProcessNav();
      renderSections();
      syncUrlState();
    }, 250),
  );

  $("finish-detail-backdrop")?.addEventListener("click", closeDetail);
  $("finish-detail")?.addEventListener("click", (e) => {
    if (e.target.closest(".library-detail-close")) {
      e.preventDefault();
      closeDetail();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.detailFinish) closeDetail();
  });
}

function init() {
  const url = readUrlState();
  state.material = url.material;
  state.processId = url.process;
  state.familyId = url.family;
  state.searchQuery = url.q;

  const search = $("library-search");
  if (search && url.q) search.value = url.q;

  bindUi();
  loadCatalog().catch(showError);
}

document.addEventListener("DOMContentLoaded", init);