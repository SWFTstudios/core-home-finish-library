import { costDots } from "./finish-swatch.js";
import {
  buildItemTitle,
  buildRequestDraftFromFolder,
  configuratorDeepLink,
  getFolder,
  getSelectedItems,
  removeItem,
  REQUEST_DRAFT_KEY,
  refreshFolderBadges,
  updateItem,
} from "./folder-store.js";

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function setBanner(message, type = "") {
  const el = document.getElementById("folder-banner");
  if (!el) return;
  el.textContent = message;
  el.className = `status-banner${type ? ` ${type}` : ""}`;
  el.hidden = !message;
}

function durabilityDots(score, max = 5) {
  const n = score == null ? 0 : Math.min(max, Math.max(0, Math.round(Number(score))));
  return "●".repeat(n) + "○".repeat(max - n);
}

function previewImgUrl(item, side) {
  if (item.combo_image_url) return item.combo_image_url;
  return side === "back" ? item.preview_back_url : item.preview_front_url;
}

function renderCard(item, onChange) {
  const card = document.createElement("article");
  card.className = `folder-card${item.selected_for_review ? " is-selected" : ""}`;
  card.dataset.id = item.id;
  card.setAttribute("role", "listitem");

  const title = buildItemTitle(item);

  card.innerHTML = `
    <div class="folder-card-head">
      <input type="checkbox" class="folder-card-select" aria-label="Select ${title} for review" ${
        item.selected_for_review ? "checked" : ""
      } />
      <h2 class="folder-card-title">${escapeHtml(title)}</h2>
      <button type="button" class="folder-card-remove" aria-label="Remove ${title}">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
    <a class="folder-card-previews" href="${configuratorDeepLink(item)}" title="Open in library">
      <div class="folder-preview-frame">
        <img src="${escapeHtml(previewImgUrl(item, "front") || "")}" alt="" loading="lazy" />
        <span class="folder-preview-label">front</span>
      </div>
      <div class="folder-preview-frame">
        <img src="${escapeHtml(previewImgUrl(item, "back") || "")}" alt="" loading="lazy" />
        <span class="folder-preview-label">back</span>
      </div>
    </a>
    <div class="folder-card-meta">
      <div class="folder-rating-block">
        <span class="folder-rating-label">Durability</span>
        <span class="folder-rating-dots" aria-label="Durability ${item.durability_score ?? 0} of 5">${durabilityDots(item.durability_score)}</span>
      </div>
      <div class="folder-rating-block">
        <span class="folder-rating-label">Cost</span>
        <span class="folder-rating-dots" aria-label="Cost ${item.cost_tier ?? 0} of 5">${costDots(item.cost_tier)}</span>
      </div>
    </div>
    <div class="folder-card-notes">
      <label for="notes-${item.id}">Notes</label>
      <textarea id="notes-${item.id}" placeholder="Include how it is applied, pros and cons, and other important notes…">${escapeHtml(item.notes || "")}</textarea>
    </div>
  `;

  const checkbox = card.querySelector(".folder-card-select");
  checkbox.addEventListener("change", async () => {
    const selected = checkbox.checked;
    card.classList.toggle("is-selected", selected);
    await updateItem(item.id, { selected_for_review: selected });
    onChange();
  });

  const saveNotes = debounce(async (notes) => {
    await updateItem(item.id, { notes });
  }, 400);

  card.querySelector("textarea")?.addEventListener("input", (e) => {
    saveNotes(e.target.value);
  });

  card.querySelector(".folder-card-remove")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remove "${title}" from your folder?`)) return;
    await removeItem(item.id);
    onChange(true);
  });

  return card;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function refreshPage(reload = false) {
  const grid = document.getElementById("folder-grid");
  const empty = document.getElementById("folder-empty");
  const createBtn = document.getElementById("btn-folder-create-request");
  if (!grid) return;

  const { items } = await getFolder();
  const count = items.length;
  const selectedCount = items.filter((i) => i.selected_for_review).length;

  refreshFolderBadges(count, ["folder-page-count", "navbar-folder-count"]);

  const pageBadge = document.getElementById("folder-page-count");
  if (pageBadge) {
    pageBadge.textContent = String(count);
    pageBadge.hidden = count <= 0;
  }

  if (empty) empty.hidden = count > 0;
  grid.hidden = count === 0;

  if (reload || !grid.childElementCount) {
    grid.innerHTML = "";
    for (const item of items) {
      grid.appendChild(renderCard(item, () => refreshPage(false)));
    }
  }

  if (createBtn) {
    createBtn.disabled = selectedCount === 0;
  }
}

function bindCreateRequest() {
  const btn = document.getElementById("btn-folder-create-request");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const selected = await getSelectedItems();
    if (!selected.length) {
      setBanner("Select at least one item for review.", "error");
      return;
    }

    const draft = buildRequestDraftFromFolder(selected);
    if (!draft) return;

    if (draft.mixed_materials) {
      setBanner(
        "Selected items use different materials. The request will use the first item's material.",
        "error",
      );
    }

    sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(draft));
    window.location.href = "/request.html?from=folder";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindCreateRequest();
  refreshPage(true).catch((err) => setBanner(err.message, "error"));
});
