function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function slugifyFilename(title) {
  return String(title ?? "request")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "request";
}

function swatchMarkup(finish) {
  const url = finish.image_url || finish.asset_swatch_url;
  if (url) {
    return `<img class="pdf-swatch-img" src="${escapeHtml(url)}" alt="" crossorigin="anonymous" />`;
  }
  const hex = finish.hex_color || "#cccccc";
  return `<span class="pdf-swatch-hex" style="background:${escapeHtml(hex)}"></span>`;
}

function zoneLabel(zone) {
  const labels = { body: "Body", logo: "Logo", accent: "Accent" };
  return labels[zone] ?? zone ?? "—";
}

/**
 * Build off-screen DOM for PDF export from API request detail.
 * @param {Record<string, unknown>} detail
 */
export function buildPdfDom(detail) {
  const root = document.createElement("div");
  root.className = "render-request-pdf-root";

  const requester = detail.requested_by;
  const requesterLabel = requester
    ? `${requester.full_name || requester.email} (${requester.team})`
    : "—";

  const finishRows = (detail.finishes ?? [])
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(zoneLabel(f.zone))}</td>
        <td class="pdf-swatch-cell">${swatchMarkup(f)}</td>
        <td><strong>${escapeHtml(f.name)}</strong><br /><span class="pdf-muted">${escapeHtml(f.category || "")}</span></td>
        <td>${escapeHtml(f.durability_score ?? "—")}${f.durability_notes ? `<br /><span class="pdf-muted">${escapeHtml(f.durability_notes)}</span>` : ""}</td>
        <td>${escapeHtml(f.cost_tier ?? f.price_band ?? "—")}</td>
        <td>${escapeHtml(f.finish_process || "—")}</td>
      </tr>`,
    )
    .join("");

  const graphic = detail.graphic;
  const materialLabel =
    detail.material_label ||
    detail.material_slug?.replace(/_/g, " ") ||
    "—";

  root.innerHTML = `
    <header class="pdf-header">
      <p class="pdf-brand">Core Home — Render Request</p>
      <h1 class="pdf-title">${escapeHtml(detail.title)}</h1>
      <p class="pdf-meta-line">
        <span>Status: ${escapeHtml(detail.status)}</span>
        <span>Deadline: ${escapeHtml(formatDate(detail.deadline))}</span>
      </p>
    </header>

    <section class="pdf-section">
      <h2>Request details</h2>
      <table class="pdf-kv">
        <tr><th>Request ID</th><td>${escapeHtml(detail.id)}</td></tr>
        <tr><th>Product type</th><td>${escapeHtml(detail.product_type || "—")}</td></tr>
        <tr><th>Material</th><td>${escapeHtml(materialLabel)}</td></tr>
        <tr><th>Submitted by</th><td>${escapeHtml(requesterLabel)}</td></tr>
        <tr><th>Created</th><td>${escapeHtml(formatDate(detail.created_at))}</td></tr>
        <tr><th>Last updated</th><td>${escapeHtml(formatDate(detail.updated_at))}</td></tr>
      </table>
    </section>

    <section class="pdf-section">
      <h2>Finish selections</h2>
      <table class="pdf-table">
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
        <tbody>
          ${finishRows || '<tr><td colspan="6">No finishes selected.</td></tr>'}
        </tbody>
      </table>
    </section>

    ${
      graphic
        ? `<section class="pdf-section">
      <h2>Graphic application</h2>
      <p><strong>${escapeHtml(graphic.label)}</strong>${graphic.template_key ? ` <span class="pdf-muted">(${escapeHtml(graphic.template_key)})</span>` : ""}</p>
    </section>`
        : ""
    }

    ${
      detail.notes
        ? `<section class="pdf-section">
      <h2>Notes for ID</h2>
      <p class="pdf-notes">${escapeHtml(detail.notes)}</p>
    </section>`
        : ""
    }

    <footer class="pdf-footer">
      <p>Generated from Core Home Render Portal — ${escapeHtml(new Date().toLocaleString())}</p>
    </footer>
  `;

  return root;
}

/**
 * @param {Record<string, unknown>} detail
 */
export async function generateRequestPdf(detail) {
  if (!globalThis.html2pdf) {
    throw new Error("PDF library failed to load. Refresh and try again.");
  }

  const container = document.createElement("div");
  container.className = "render-request-pdf-container";
  container.setAttribute("aria-hidden", "true");
  const el = buildPdfDom(detail);
  container.appendChild(el);
  document.body.appendChild(container);

  const filename = `render-request-${slugifyFilename(detail.title)}.pdf`;

  try {
    await globalThis.html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(el)
      .save();
  } finally {
    container.remove();
  }
}
