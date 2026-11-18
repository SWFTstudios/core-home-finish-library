/**
 * Folder store — save configurator selections for review.
 * Uses Worker API when available; falls back to localStorage on static Pages.
 */
import { resolveFinishPreviewUrl } from "./finish-asset-resolve.js";

export const FOLDER_STORAGE_KEY = "corehome:my-folder";
export const REQUEST_DRAFT_KEY = "corehome:request-draft";

const API = "/api";

const MATERIAL_PREVIEW_SHELLS = {
  ceramic: {
    front: "/assets/ceramic/front.png",
    back: "/assets/ceramic/back.png",
  },
  glass: {
    front: "/assets/glass/front.png",
    back: "/assets/glass/back.png",
  },
  stainless_steel: {
    front: "/assets/stainless_steel/front.png",
    back: "/assets/stainless_steel/back.png",
  },
  plastic: {
    front: "/assets/plastic/front.png",
    back: "/assets/plastic/back.png",
  },
};

let useApi = null;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function detectApi() {
  if (useApi !== null) return useApi;
  try {
    await api("/folder");
    useApi = true;
  } catch {
    useApi = false;
  }
  return useApi;
}

function readLocalItems() {
  try {
    const raw = localStorage.getItem(FOLDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalItems(items) {
  localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(items));
}

function normalizeItem(item) {
  const snap = item.spec_snapshot ?? item;
  return {
    id: item.id,
    material_slug: item.material_slug ?? snap.material_slug,
    material_label: snap.material_label ?? item.material_label,
    finish_id: item.finish_id ?? snap.finish_id,
    finish_name: snap.finish_name ?? item.finish_name,
    finish_slug: snap.finish_slug ?? item.finish_slug,
    graphic_application_id: item.graphic_application_id ?? snap.graphic_application_id ?? null,
    graphic_label: snap.graphic_label ?? item.graphic_label ?? null,
    durability_score: snap.durability_score ?? null,
    cost_tier: snap.cost_tier ?? null,
    preview_front_url: snap.preview_front_url ?? null,
    preview_back_url: snap.preview_back_url ?? null,
    combo_image_url: snap.combo_image_url ?? null,
    notes: item.notes ?? snap.notes ?? "",
    selected_for_review:
      item.selected_for_review === 0 || item.selected_for_review === false ? false : true,
    created_at: item.created_at ?? snap.created_at ?? new Date().toISOString(),
    spec_snapshot: snap,
  };
}

function itemKey(item) {
  return `${item.finish_id}::${item.graphic_application_id ?? ""}`;
}

/**
 * Build a folder item snapshot from configurator state.
 * @param {{ material: string, catalog: object, graphicId: string|null }} configState
 * @param {object} finish
 * @param {object|null} graphic
 */
export function buildFolderItemFromConfigurator(configState, finish, graphic) {
  const materialMeta = configState.catalog?.materials?.find((m) => m.slug === configState.material);
  const shells = MATERIAL_PREVIEW_SHELLS[configState.material] ?? MATERIAL_PREVIEW_SHELLS.stainless_steel;
  const comboUrl = resolveFinishPreviewUrl(finish, graphic);

  return {
    id: crypto.randomUUID(),
    material_slug: configState.material,
    material_label: materialMeta?.label ?? configState.material,
    finish_id: finish.id,
    finish_name: finish.name,
    finish_slug: finish.slug,
    graphic_application_id: graphic?.id ?? null,
    graphic_label: graphic?.uiLabel ?? graphic?.label ?? null,
    durability_score: finish.durabilityScore ?? finish.durability_score ?? null,
    cost_tier: finish.costTier ?? finish.cost_tier ?? null,
    preview_front_url: shells.front,
    preview_back_url: shells.back,
    combo_image_url: comboUrl,
    notes: "",
    selected_for_review: true,
    created_at: new Date().toISOString(),
  };
}

export function buildItemTitle(item) {
  const parts = [item.finish_name || "Finish"];
  if (item.graphic_label) parts.push(item.graphic_label);
  return parts.join(" + ");
}

export function configuratorDeepLink(item) {
  const params = new URLSearchParams();
  if (item.finish_slug) params.set("finish", item.finish_slug);
  if (item.material_slug) params.set("material", item.material_slug);
  if (item.graphic_application_id) params.set("graphic", item.graphic_application_id);
  const qs = params.toString();
  return `/configurator/${qs ? `?${qs}` : ""}`;
}

export async function getFolder() {
  if (await detectApi()) {
    const data = await api("/folder");
    return {
      id: data.folder?.id ?? null,
      name: data.folder?.name ?? "My folder",
      items: (data.items ?? []).map(normalizeItem),
    };
  }
  return {
    id: null,
    name: "My folder",
    items: readLocalItems().map(normalizeItem),
  };
}

export async function getCount() {
  const { items } = await getFolder();
  return items.length;
}

export async function getSelectedItems() {
  const { items } = await getFolder();
  return items.filter((i) => i.selected_for_review);
}

export async function addItem(snapshot) {
  const normalized = normalizeItem({ ...snapshot, spec_snapshot: snapshot });

  if (await detectApi()) {
    try {
      const data = await api("/folder/items", {
        method: "POST",
        body: JSON.stringify({ spec_snapshot: snapshot }),
      });
      return normalizeItem(data.item);
    } catch (e) {
      if (e?.status === 409) {
        const err = new Error("This finish and graphic combo is already in your folder.");
        err.code = "duplicate";
        throw err;
      }
      throw e;
    }
  }

  const items = readLocalItems().map(normalizeItem);
  if (items.some((i) => itemKey(i) === itemKey(normalized))) {
    const err = new Error("This finish and graphic combo is already in your folder.");
    err.code = "duplicate";
    throw err;
  }
  items.unshift(normalized);
  writeLocalItems(items);
  return normalized;
}

export async function updateItem(id, patch) {
  if (await detectApi()) {
    const data = await api(`/folder/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return normalizeItem(data.item);
  }

  const items = readLocalItems().map(normalizeItem);
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error("Item not found");
  const updated = { ...items[idx], ...patch };
  if (patch.selected_for_review !== undefined) {
    updated.selected_for_review = Boolean(patch.selected_for_review);
  }
  items[idx] = normalizeItem(updated);
  writeLocalItems(items);
  return items[idx];
}

export async function removeItem(id) {
  if (await detectApi()) {
    await api(`/folder/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }

  const items = readLocalItems().filter((i) => i.id !== id);
  writeLocalItems(items);
}

export function buildRequestDraftFromFolder(selectedItems) {
  if (!selectedItems.length) return null;

  const first = selectedItems[0];
  const materials = new Set(selectedItems.map((i) => i.material_slug));

  const folderNotes = selectedItems
    .filter((i) => i.notes?.trim())
    .map((i) => `${buildItemTitle(i)}: ${i.notes.trim()}`)
    .join("\n\n");

  return {
    source: "folder",
    material_slug: first.material_slug,
    material_label: first.material_label,
    graphic_application_id: first.graphic_application_id,
    graphic_label: first.graphic_label,
    finish_name: first.finish_name,
    finishes: selectedItems.map((i, idx) => ({
      finish_id: i.finish_id,
      zone: idx === 0 ? "body" : idx === 1 ? "logo" : idx === 2 ? "accent" : `zone-${idx + 1}`,
    })),
    folder_notes: folderNotes || null,
    mixed_materials: materials.size > 1,
    folder_item_count: selectedItems.length,
  };
}

/**
 * Update folder badge elements in the DOM.
 * @param {string|number} count
 * @param {string[]} badgeIds
 */
export function refreshFolderBadges(count, badgeIds = ["folder-count", "navbar-folder-count"]) {
  for (const id of badgeIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    const n = Number(count) || 0;
    el.textContent = String(n);
    el.hidden = n <= 0;
  }
}

export async function syncFolderBadges() {
  const count = await getCount();
  refreshFolderBadges(count);
  return count;
}
