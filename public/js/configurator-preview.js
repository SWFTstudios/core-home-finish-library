/**
 * Configurator preview facade — 2D / 3D view switch with lazy Three.js and WebGL fallback.
 */
const VIEW_KEY = "corehome:preview-view";

let activeView = null;
let module2d = null;
let module3d = null;
let containerEl = null;
let lastOpts = {};
let ready = false;
let callbacks = {};

function preferredView() {
  const fromUrl = new URLSearchParams(location.search).get("view");
  if (fromUrl === "2d" || fromUrl === "3d") return fromUrl;
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "2d" || stored === "3d") return stored;
  } catch {
    /* ignore */
  }
  return "3d";
}

function rememberView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

function mountTarget(view) {
  if (!containerEl) return null;
  let el = containerEl.querySelector(view === "2d" ? "#preview-2d" : "#preview-3d");
  if (!el) {
    el = document.createElement("div");
    el.id = view === "2d" ? "preview-2d" : "preview-3d";
    el.className = view === "2d" ? "preview-2d" : "preview-3d";
    el.setAttribute("role", "img");
    containerEl.appendChild(el);
  }
  return el;
}

function showOnly(view) {
  if (!containerEl) return;
  const el2d = containerEl.querySelector("#preview-2d");
  const el3d = containerEl.querySelector("#preview-3d");
  if (el2d) el2d.hidden = view !== "2d";
  if (el3d) el3d.hidden = view !== "3d";
  document.querySelectorAll(".preview-view-btn").forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.dataset.view === view));
  });
  document.querySelector(".preview-zone")?.classList.toggle("is-hidden", view === "2d");
}

async function loadModule(view) {
  if (view === "2d") {
    module2d ??= await import("./configurator-preview-2d.js");
    return module2d;
  }
  module3d ??= await import("./configurator-preview-3d.js");
  return module3d;
}

function disposeActive() {
  if (!activeView) return;
  if (activeView === "2d") module2d?.disposePreview2d();
  else module3d?.disposePreview3d();
  activeView = null;
  ready = false;
}

async function startView(view) {
  const mod = await loadModule(view);
  const el = mountTarget(view);
  showOnly(view);
  const init = view === "2d" ? mod.initPreview2d : mod.initPreview3d;
  // Set before init: the 3D module calls onReady synchronously, and updatePreview() ignores
  // calls while no view is active (the first finish would otherwise never reach the stage).
  activeView = view;
  const ok = init(el, {
    onReady: () => {
      ready = true;
      callbacks.onReady?.();
      updatePreview(lastOpts);
    },
    onError: (msg) => callbacks.onError?.(msg),
  });
  if (ok === false) {
    ready = false;
    activeView = null;
    return false;
  }
  rememberView(view);
  return true;
}

/**
 * @param {HTMLElement} container
 * @param {{ onReady?: () => void, onError?: (msg: string) => void }} [cb]
 */
export async function initPreview(container, cb = {}) {
  containerEl = container;
  callbacks = cb;
  const wanted = preferredView();
  let ok = await startView(wanted);
  if (!ok && wanted === "3d") {
    callbacks.onError?.("3D preview unavailable — showing 2D.");
    ok = await startView("2d");
  }
  return ok;
}

export function updatePreview(opts = {}) {
  lastOpts = { ...lastOpts, ...opts };
  if (!ready || !activeView) return;
  if (activeView === "2d") {
    module2d?.updatePreview2d(lastOpts);
  } else {
    module3d?.updatePreview3d(lastOpts);
  }
}

export function zoomPreview(delta) {
  if (activeView === "2d") module2d?.zoomPreview(delta);
  else module3d?.zoomPreview(delta);
}

export function setPreviewAutoRotate(enabled) {
  if (activeView === "2d") module2d?.setPreviewAutoRotate(enabled);
  else module3d?.setPreviewAutoRotate(enabled);
}

export function getPreviewView() {
  return activeView ?? preferredView();
}

export async function setPreviewView(view) {
  if (view !== "2d" && view !== "3d") return false;
  if (view === activeView) return true;
  disposeActive();
  let ok = await startView(view);
  if (!ok && view === "3d") {
    callbacks.onError?.("3D preview unavailable — showing 2D.");
    ok = await startView("2d");
  }
  return ok;
}

export function disposePreview() {
  disposeActive();
  if (containerEl) containerEl.innerHTML = "";
  containerEl = null;
  ready = false;
}
