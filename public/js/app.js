import { loadAccessDefaults, readAccessEditor, renderAccessEditor } from "./request-access-ui.js";

const API = "/api";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function swatchStyle(finish) {
  if (finish.image_url) return {};
  if (finish.hex_color) return { background: finish.hex_color };
  return { background: "var(--surface-2)" };
}

function renderFinishCard(finish, { selectable = false, selected = false } = {}) {
  const card = document.createElement("article");
  card.className = `finish-card${selected ? " is-selected" : ""}`;
  card.dataset.id = finish.id;
  card.dataset.name = finish.name;
  card.dataset.category = finish.category || "";

  const swatch = document.createElement("div");
  swatch.className = "swatch";
  Object.assign(swatch.style, swatchStyle(finish));
  if (finish.image_url) {
    const img = document.createElement("img");
    img.src = finish.image_url;
    img.alt = finish.name;
    swatch.appendChild(img);
  }

  card.innerHTML = `
    <div class="card-body">
      <span class="badge">${finish.category || "finish"}</span>
      <h3>${finish.name}</h3>
      <p>${finish.description || ""}</p>
    </div>
  `;
  card.prepend(swatch);

  if (selectable) {
    card.addEventListener("click", () => {
      card.classList.toggle("is-selected");
      document.dispatchEvent(
        new CustomEvent("finish-toggle", { detail: { finish, selected: card.classList.contains("is-selected") } }),
      );
    });
  }

  return card;
}

async function loadFinishes({ gridEl, filters = {}, selectable = false }) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);

  const query = params.toString() ? `?${params}` : "";
  const { finishes } = await api(`/finishes${query}`);

  gridEl.innerHTML = "";
  if (!finishes.length) {
    gridEl.innerHTML = '<p class="empty-state">No finishes found. Run <code>npm run db:seed:local</code> for demo data.</p>';
    return finishes;
  }

  for (const finish of finishes) {
    gridEl.appendChild(renderFinishCard(finish, { selectable }));
  }
  return finishes;
}

async function loadRequests(tableBody) {
  const { requests } = await api("/requests");
  tableBody.innerHTML = "";

  if (!requests.length) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No requests yet.</td></tr>';
    return;
  }

  for (const req of requests) {
    const tr = document.createElement("tr");
    const esc = (v) =>
      String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    tr.innerHTML = `
      <td>${esc(req.title)}</td>
      <td>${esc(req.product_type || "—")}</td>
      <td><span class="status-pill ${esc(String(req.status).toLowerCase().replace(/\s+/g, "-"))}">${esc(req.status)}</span></td>
      <td>${esc(req.deadline || "—")}</td>
      <td>${esc(req.updated_at || req.created_at || "—")}</td>
    `;
    tableBody.appendChild(tr);
  }
}

function bindRequestPage() {
  const grid = document.getElementById("picker-grid");
  const list = document.getElementById("selection-list");
  const form = document.getElementById("request-form");
  const banner = document.getElementById("form-banner");
  if (!grid || !form) return;

  const selections = new Map();
  // Zones carried over from the configurator (?body=<id>&logo=<id>); picked finishes fill the rest.
  const preset = new URLSearchParams(location.search);
  const presetZones = new Map(
    ["body", "logo"].filter((z) => preset.get(z)).map((z) => [preset.get(z), z]),
  );
  if (preset.get("product")) form.product_type.value = preset.get("product");

  // Who can access this request: start from the preparer's saved defaults.
  const accessEditor = document.getElementById("access-editor");
  const resetAccessEditor = () =>
    accessEditor
      ? loadAccessDefaults()
          .then((d) => renderAccessEditor(accessEditor, d.departments, d.access))
          .catch(showError)
      : Promise.resolve();
  resetAccessEditor();

  document.addEventListener("finish-toggle", (e) => {
    const { finish, selected } = e.detail;
    if (selected) selections.set(finish.id, finish);
    else selections.delete(finish.id);
    renderSelections(list, selections, presetZones);
  });

  loadFinishes({ gridEl: grid, selectable: true })
    .then((finishes) => {
      const byId = new Map(finishes.map((f) => [f.id, f]));
      for (const id of presetZones.keys()) {
        const finish = byId.get(id);
        if (finish) selections.set(finish.id, finish);
      }
      renderSelections(list, selections, presetZones);
    })
    .catch(showError);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setBanner(banner, "");

    const title = form.title.value.trim();
    if (!title) {
      setBanner(banner, "Title is required.", "error");
      return;
    }

    const finishes = zonedSelections(selections, presetZones);

    try {
      await api("/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          product_type: form.product_type.value,
          notes: form.notes.value,
          deadline: form.deadline.value || null,
          status: "Submitted",
          access: accessEditor ? readAccessEditor(accessEditor) : undefined,
          finishes,
        }),
      });
      setBanner(banner, "Request submitted. ID team can pick it up from the dashboard.", "success");
      form.reset();
      resetAccessEditor();
      selections.clear();
      renderSelections(list, selections);
      grid.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
    } catch (err) {
      setBanner(banner, err.message, "error");
    }
  });
}

function bindDashboardPage() {
  const tbody = document.getElementById("requests-body");
  if (!tbody) return;
  loadRequests(tbody).catch(showError);
}

/** Assign each selected finish a zone: configurator zones first, then body, logo and accents. */
function zonedSelections(selections, presetZones = new Map()) {
  const taken = new Set(presetZones.values());
  const free = ["body", "logo"].filter((z) => !taken.has(z));
  return [...selections.values()].map((f) => ({
    finish_id: f.id,
    zone: presetZones.get(f.id) ?? free.shift() ?? "accent",
  }));
}

function renderSelections(listEl, selections, presetZones = new Map()) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!selections.size) {
    listEl.innerHTML = "<li class='empty-state'>Tap finishes to build your spec (body, logo, accents).</li>";
    return;
  }
  for (const { finish_id, zone } of zonedSelections(selections, presetZones)) {
    const finish = selections.get(finish_id);
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = finish.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = zone;
    li.append(name, badge);
    listEl.appendChild(li);
  }
}

function setBanner(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.className = `status-banner${type ? ` ${type}` : ""}`;
  el.hidden = !message;
}

function showError(err) {
  const banner = document.getElementById("page-banner");
  setBanner(banner, err.message || "Something went wrong.", "error");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  bindRequestPage();
  bindDashboardPage();
});
