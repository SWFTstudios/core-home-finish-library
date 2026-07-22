/** Shared swatch styling and cost-band display helpers. */

export function swatchStyle(finish) {
  if (finish.image_url) return {};
  if (finish.hexColor || finish.hex_color) {
    return { background: finish.hexColor || finish.hex_color };
  }
  return { background: "var(--lumina-surface-container-high)" };
}

export function formatRating(n, max = 5) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return `${Number(n)}/${max}`;
}

/** @deprecated Prefer costBandLabel / costBandBadge — kept for legacy $ tier fallback. */
export function costDots(tier, max = 5) {
  const n = tier == null ? 0 : Math.min(max, Math.max(0, Number(tier)));
  return "●".repeat(n) + "○".repeat(max - n);
}

export function finishCostBand(finish) {
  return finish?.costBand ?? finish?.cost_band ?? null;
}

export function finishVerifiedStatus(finish) {
  return finish?.verifiedStatus ?? finish?.verified_status ?? null;
}

export function formatBandRange(band) {
  if (!band) return "";
  const from = band.fromEur ?? band.from_eur;
  const to = band.toEur ?? band.to_eur;
  if (from == null) return "";
  const fmt = (n) =>
    Number.isInteger(n) ? `€${n}` : `€${Number(n).toFixed(2).replace(/\.?0+$/, "")}`;
  if (to == null) return `${fmt(from)}+`;
  return `${fmt(from)}–${fmt(to)}`;
}

export function bandsForMaterial(catalog, materialSlug) {
  const map = catalog?.costBands ?? catalog?.cost_bands ?? {};
  return map[materialSlug] ?? [];
}

export function bandRangeTitle(catalog, materialSlug, bandLetter) {
  if (!bandLetter) return "Cost band unverified";
  const bands = bandsForMaterial(catalog, materialSlug);
  const match = bands.find((b) => b.band === bandLetter);
  if (!match) return `Cost band ${bandLetter}`;
  const range = formatBandRange(match);
  return range ? `Cost band ${bandLetter} (${range} /pc)` : `Cost band ${bandLetter}`;
}

/**
 * Plain-text cost label for specs / PDF cells.
 * Shows letter when present; otherwise an unverified dash.
 */
export function costBandLabel(finish, { unverified = "—" } = {}) {
  const band = finishCostBand(finish);
  return band || unverified;
}

/**
 * HTML badge for cost band letter (+ optional verified mark).
 * Returns a string suitable for innerHTML (escaped).
 */
export function costBandBadgeHtml(finish, catalog, { showVerified = true } = {}) {
  const band = finishCostBand(finish);
  const material = finish?.materialSlug ?? finish?.material_slug ?? "";
  const title = escapeAttr(bandRangeTitle(catalog, material, band));
  const verified = finishVerifiedStatus(finish);
  if (!band) {
    return `<span class="cost-band cost-band--empty" title="Cost not yet factory-verified">—</span>`;
  }
  const verifiedMark =
    showVerified && verified === "yes"
      ? `<span class="cost-band-verified" title="Factory verified" aria-label="Verified">✓</span>`
      : showVerified && verified === "needs_review"
        ? `<span class="cost-band-verified cost-band-verified--review" title="Needs review" aria-label="Needs review">?</span>`
        : "";
  return `<span class="cost-band" title="${title}"><span class="cost-band-letter">${escapeHtml(band)}</span>${verifiedMark}</span>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** Build a compact band-key legend HTML for one material. */
export function costBandKeyHtml(catalog, materialSlug, materialMeta = null) {
  const bands = bandsForMaterial(catalog, materialSlug);
  if (!bands.length) {
    return `<p class="cost-band-key-empty">Band ranges will appear once thresholds are set for this material.</p>`;
  }
  const piece = materialMeta?.referencePiece ?? materialMeta?.reference_piece;
  const moq = materialMeta?.referenceMoq ?? materialMeta?.reference_moq;
  const refBits = [];
  if (piece) refBits.push(String(piece));
  if (moq) refBits.push(`MOQ ${moq}`);
  const refLine = refBits.length
    ? `<p class="cost-band-key-ref">Quoted on ${escapeHtml(refBits.join(" · "))}</p>`
    : "";
  const items = bands
    .map((b) => {
      const range = formatBandRange(b) || "—";
      return `<li><span class="cost-band-letter">${escapeHtml(b.band)}</span><span class="cost-band-range">${escapeHtml(range)}</span></li>`;
    })
    .join("");
  return `${refLine}<ul class="cost-band-key-list">${items}</ul>`;
}
