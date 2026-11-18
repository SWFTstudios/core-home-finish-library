import { generateRequestPdf } from "./render-request-pdf.js";

const API = "/api";
export const REQUEST_DRAFT_KEY = "corehome:request-draft";

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
  card.dataset.materialSlug = finish.material_slug || "";

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
        new CustomEvent("finish-toggle", {
          detail: { finish, selected: card.classList.contains("is-selected") },
        }),
      );
    });
  }

  return card;
}

async function loadFinishes({ gridEl, filters = {}, selectable = false, preselectedIds = [] }) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);

  const query = params.toString() ? `?${params}` : "";
  const { finishes } = await api(`/finishes${query}`);

  gridEl.innerHTML = "";
  if (!finishes.length) {
    gridEl.innerHTML =
      '<p class="empty-state">No finishes found. Run <code>npm run db:seed:local</code> for demo data.</p>';
    return finishes;
  }

  const selectedSet = new Set(preselectedIds);
  for (const finish of finishes) {
    gridEl.appendChild(
      renderFinishCard(finish, { selectable, selected: selectedSet.has(finish.id) }),
    );
  }
  return finishes;
}

async function fetchRequestDetail(id) {
  const { request } = await api(`/requests/${encodeURIComponent(id)}`);
  return request;
}

function readDraft() {
  try {
    const raw = sessionStorage.getItem(REQUEST_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  sessionStorage.removeItem(REQUEST_DRAFT_KEY);
}

function renderDraftChips(draft) {
  const el = document.getElementById("draft-chips");
  if (!el || !draft) {
    if (el) el.hidden = true;
    return;
  }

  const chips = [];
  if (draft.source === "folder" && draft.folder_item_count) {
    chips.push(`<span class="draft-chip">${draft.folder_item_count} item(s) from folder</span>`);
  }
  if (draft.material_label || draft.material_slug) {
    chips.push(`<span class="draft-chip">Material: ${draft.material_label || draft.material_slug}</span>`);
  }
  if (draft.graphic_label) {
    chips.push(`<span class="draft-chip">Graphic: ${draft.graphic_label}</span>`);
  }
  if (draft.finish_name && draft.source !== "folder") {
    chips.push(`<span class="draft-chip">Body finish: ${draft.finish_name}</span>`);
  }
  if (draft.source === "folder" && draft.finishes?.length) {
    chips.push(`<span class="draft-chip">${draft.finishes.length} finish(es) selected</span>`);
  }

  if (!chips.length) {
    el.hidden = true;
    return;
  }

  const label =
    draft.source === "folder"
      ? "From folder"
      : draft.source === "configurator"
        ? "From configurator"
        : "From draft";
  el.innerHTML = `<p class="draft-chips-label">${label}</p><div class="draft-chips-row">${chips.join("")}</div>`;
  el.hidden = false;
}

function zoneForSelectionIndex(index, existingZones) {
  const order = ["body", "logo", "accent"];
  if (index < order.length) return order[index];
  return `zone-${index + 1}`;
}

function buildSpecSnapshot(draft, selections, form) {
  return {
    title: form.title.value.trim(),
    product_type: form.product_type.value,
    notes: form.notes.value,
    deadline: form.deadline.value || null,
    material_slug: draft?.material_slug ?? null,
    material_label: draft?.material_label ?? null,
    graphic_application_id: draft?.graphic_application_id ?? null,
    graphic_label: draft?.graphic_label ?? null,
    source: draft?.source ?? "request_form",
    finishes: [...selections.values()].map((f, i) => ({
      finish_id: f.id,
      name: f.name,
      zone: zoneForSelectionIndex(i, []),
      category: f.category,
    })),
    exported_at: new Date().toISOString(),
  };
}

function bindRequestPage() {
  const grid = document.getElementById("picker-grid");
  const list = document.getElementById("selection-list");
  const form = document.getElementById("request-form");
  const banner = document.getElementById("form-banner");
  if (!grid || !form) return;

  const draft = readDraft();
  renderDraftChips(draft);

  if (draft?.folder_notes && form.notes && !form.notes.value.trim()) {
    form.notes.value = draft.folder_notes;
  }

  const selections = new Map();
  const preselectedIds = (draft?.finishes ?? []).map((f) => f.finish_id);

  document.addEventListener("finish-toggle", (e) => {
    const { finish, selected } = e.detail;
    if (selected) selections.set(finish.id, finish);
    else selections.delete(finish.id);
    renderSelections(list, selections);
  });

  loadFinishes({ gridEl: grid, selectable: true, preselectedIds })
    .then((finishes) => {
      for (const id of preselectedIds) {
        const finish = finishes.find((f) => f.id === id);
        if (finish) selections.set(id, finish);
      }
      renderSelections(list, selections);
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

    const finishList = [...selections.values()];
    const finishes = finishList.map((f, i) => ({
      finish_id: f.id,
      zone: zoneForSelectionIndex(i, []),
    }));

    const materialSlug =
      draft?.material_slug ?? finishList[0]?.material_slug ?? finishList[0]?.materialSlug ?? null;

    const specSnapshot = buildSpecSnapshot(draft, selections, form);
    if (draft?.source === "folder") {
      specSnapshot.handoff = "folder";
      specSnapshot.folder_item_count = draft.folder_item_count ?? null;
    }

    const apiSource =
      draft?.source === "configurator" ? "configurator" : "request_form";

    try {
      const { id } = await api("/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          product_type: form.product_type.value,
          notes: form.notes.value,
          deadline: form.deadline.value || null,
          status: "Submitted",
          material_slug: materialSlug,
          graphic_application_id: draft?.graphic_application_id ?? null,
          source: apiSource,
          spec_snapshot: specSnapshot,
          finishes,
        }),
      });

      clearDraft();

      let pdfOk = true;
      try {
        const detail = await fetchRequestDetail(id);
        await generateRequestPdf(detail);
      } catch (pdfErr) {
        pdfOk = false;
        console.warn("PDF export failed:", pdfErr);
      }

      const pdfNote = pdfOk ? " PDF downloaded." : " PDF export failed — open the request to retry.";
      setBanner(
        banner,
        `Request submitted.${pdfNote} <a href="/request-detail.html?id=${encodeURIComponent(id)}">View request</a>`,
        "success",
      );
      form.reset();
      selections.clear();
      renderSelections(list, selections);
      grid.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
      document.getElementById("draft-chips")?.remove();
    } catch (err) {
      setBanner(banner, err.message, "error");
    }
  });
}

async function loadRequests(tableBody, statusFilter) {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const { requests } = await api(`/requests${query}`);
  tableBody.innerHTML = "";

  if (!requests.length) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No requests yet.</td></tr>';
    return;
  }

  for (const req of requests) {
    const tr = document.createElement("tr");
    tr.className = "request-row";
    tr.tabIndex = 0;
    tr.dataset.id = req.id;
    tr.innerHTML = `
      <td><a class="request-link" href="/request-detail.html?id=${encodeURIComponent(req.id)}">${escapeHtml(req.title)}</a></td>
      <td>${escapeHtml(req.product_type || "—")}</td>
      <td><span class="status-pill ${String(req.status).toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(req.status)}</span></td>
      <td>${escapeHtml(req.deadline || "—")}</td>
      <td>${escapeHtml(req.updated_at || req.created_at || "—")}</td>
    `;
    tr.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      window.location.href = `/request-detail.html?id=${encodeURIComponent(req.id)}`;
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        window.location.href = `/request-detail.html?id=${encodeURIComponent(req.id)}`;
      }
    });
    tableBody.appendChild(tr);
  }
}

function bindDashboardPage() {
  const tbody = document.getElementById("requests-body");
  if (!tbody) return;

  const filter = document.getElementById("status-filter");
  const load = () => loadRequests(tbody, filter?.value || "").catch(showError);

  filter?.addEventListener("change", load);
  load();
}

function formatDetailDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderDetailSwatch(finish) {
  const url = finish.image_url || finish.asset_swatch_url;
  if (url) {
    return `<img class="detail-swatch" src="${escapeHtml(url)}" alt="" />`;
  }
  const hex = finish.hex_color || "#ccc";
  return `<span class="detail-swatch detail-swatch--hex" style="background:${escapeHtml(hex)}"></span>`;
}

function zoneLabel(zone) {
  const labels = { body: "Body", logo: "Logo", accent: "Accent" };
  return labels[zone] ?? zone ?? "—";
}

async function bindDetailPage() {
  const root = document.getElementById("request-detail-root");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    root.innerHTML = '<p class="empty-state">Missing request ID.</p>';
    return;
  }

  const banner = document.getElementById("detail-banner");
  const exportBtn = document.getElementById("export-pdf-btn");

  let detail = null;

  try {
    detail = await fetchRequestDetail(id);
  } catch (err) {
    root.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    return;
  }

  const requester = detail.requested_by;
  const requesterLabel = requester
    ? `${requester.full_name || requester.email} (${requester.team})`
    : "—";

  const finishRows = (detail.finishes ?? [])
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(zoneLabel(f.zone))}</td>
        <td>${renderDetailSwatch(f)}</td>
        <td><strong>${escapeHtml(f.name)}</strong><br /><span class="detail-muted">${escapeHtml(f.category || "")}</span></td>
        <td>${escapeHtml(f.durability_score ?? "—")}</td>
        <td>${escapeHtml(f.cost_tier ?? f.price_band ?? "—")}</td>
        <td>${escapeHtml(f.finish_process || "—")}</td>
      </tr>`,
    )
    .join("");

  const renderRows = (detail.renders ?? [])
    .map(
      (r) => `
      <tr>
        <td>v${escapeHtml(r.version)}</td>
        <td>${escapeHtml(r.file_url || "—")}</td>
        <td>${escapeHtml(r.uploaded_by_name || "—")}</td>
        <td>${escapeHtml(formatDetailDate(r.created_at))}</td>
      </tr>`,
    )
    .join("");

  root.innerHTML = `
    <header class="detail-header">
      <div>
        <p class="detail-eyebrow">Render request</p>
        <h1>${escapeHtml(detail.title)}</h1>
        <p class="detail-id">ID: ${escapeHtml(detail.id)}</p>
      </div>
      <span class="status-pill ${String(detail.status).toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(detail.status)}</span>
    </header>

    <div class="detail-grid">
      <section class="detail-card">
        <h2>Overview</h2>
        <dl class="detail-dl">
          <dt>Product type</dt><dd>${escapeHtml(detail.product_type || "—")}</dd>
          <dt>Material</dt><dd>${escapeHtml(detail.material_label || detail.material_slug || "—")}</dd>
          <dt>Requested by</dt><dd>${escapeHtml(requesterLabel)}</dd>
          <dt>Deadline</dt><dd>${escapeHtml(detail.deadline || "—")}</dd>
          <dt>Created</dt><dd>${escapeHtml(formatDetailDate(detail.created_at))}</dd>
          <dt>Updated</dt><dd>${escapeHtml(formatDetailDate(detail.updated_at))}</dd>
          <dt>Source</dt><dd>${escapeHtml(detail.source || "—")}</dd>
        </dl>
      </section>

      ${
        detail.graphic
          ? `<section class="detail-card">
        <h2>Graphic application</h2>
        <p><strong>${escapeHtml(detail.graphic.label)}</strong></p>
        <p class="detail-muted">${escapeHtml(detail.graphic.template_key || "")}</p>
      </section>`
          : ""
      }

      ${
        detail.notes
          ? `<section class="detail-card detail-card--wide">
        <h2>Notes for ID</h2>
        <p class="detail-notes">${escapeHtml(detail.notes)}</p>
      </section>`
          : ""
      }
    </div>

    <section class="detail-card detail-card--wide">
      <h2>Finish selections</h2>
      <table class="request-table detail-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Swatch</th>
            <th>Finish</th>
            <th>Durability</th>
            <th>Cost</th>
            <th>Process</th>
          </tr>
        </thead>
        <tbody>${finishRows || '<tr><td colspan="6" class="empty-state">No finishes.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="detail-card detail-card--wide">
      <h2>Deliverables</h2>
      <table class="request-table detail-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>File</th>
            <th>Uploaded by</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${renderRows || '<tr><td colspan="4" class="empty-state">No renders uploaded yet.</td></tr>'}</tbody>
      </table>
    </section>
  `;

  exportBtn?.addEventListener("click", async () => {
    if (!detail) return;
    exportBtn.disabled = true;
    setBanner(banner, "Generating PDF…");
    try {
      await generateRequestPdf(detail);
      setBanner(banner, "PDF downloaded.", "success");
    } catch (err) {
      setBanner(banner, err.message, "error");
    } finally {
      exportBtn.disabled = false;
    }
  });
}

function renderSelections(listEl, selections) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!selections.size) {
    listEl.innerHTML =
      "<li class='empty-state'>Tap finishes to build your spec (body, logo, accents).</li>";
    return;
  }
  const zones = ["body", "logo", "accent"];
  let i = 0;
  for (const finish of selections.values()) {
    const zone = zones[i] ?? `zone ${i + 1}`;
    const li = document.createElement("li");
    li.innerHTML = `<span>${finish.name} <em class="detail-muted">(${zone})</em></span><span class="badge">${finish.category || "finish"}</span>`;
    listEl.appendChild(li);
    i += 1;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setBanner(el, message, type = "") {
  if (!el) return;
  el.innerHTML = message;
  el.className = `status-banner${type ? ` ${type}` : ""}`;
  el.hidden = !message;
}

function showError(err) {
  const banner = document.getElementById("page-banner");
  setBanner(banner, err.message || "Something went wrong.", "error");
}

document.addEventListener("DOMContentLoaded", () => {
  bindRequestPage();
  bindDashboardPage();
  bindDetailPage();
});
