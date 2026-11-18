/**
 * Configurator viewport — real-time 3D product preview (WebGL).
 * Driven by material tab, finish wheel (body / logo zones), and theme.
 * Scene, models and materials live in product-stage-3d.js.
 */
import { createProductStage } from "./product-stage-3d.js";
import { loadRenderData } from "./finish-render-data.js";

let stage = null;
let containerEl = null;
let animationId = null;
let resizeObserver = null;
let autoRotate = false;
let disposed = false;
let appliedKey = "";

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animate() {
  if (disposed) return;
  animationId = requestAnimationFrame(animate);
  stage?.render();
}

function showErrorMessage(container, message) {
  container.classList.add("is-error");
  container.innerHTML = `<p class="preview-3d-fallback">${message}</p>`;
}

/**
 * @param {HTMLElement} container
 * @param {{ onReady?: () => void, onError?: (msg: string) => void }} [callbacks]
 */
export function initPreview3d(container, { onReady, onError } = {}) {
  if (!container) {
    onError?.("Preview container not found.");
    return false;
  }

  disposed = false;
  appliedKey = "";
  containerEl = container;
  containerEl.classList.remove("is-error");
  containerEl.innerHTML = "";

  try {
    stage = createProductStage(container, { fit: 2.1, lift: 0.12 });
  } catch (err) {
    console.error(err);
    const msg = "3D preview unavailable — WebGL could not start.";
    showErrorMessage(container, msg);
    onError?.(msg);
    return false;
  }

  stage.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (animationId) cancelAnimationFrame(animationId);
    showErrorMessage(containerEl, "3D preview paused — reload the page to restore.");
    onError?.("WebGL context lost.");
  });

  resizeObserver = new ResizeObserver(() => stage?.resize());
  resizeObserver.observe(container);

  loadRenderData();
  animate();
  onReady?.();
  return true;
}

/**
 * @param {{ materialSlug?: string, finish?: object, logoFinish?: object | null, graphic?: object, theme?: string }} opts
 */
export function updatePreview3d({ materialSlug, finish, logoFinish = null, theme }) {
  if (!stage || disposed) return;
  if (theme) stage.setTheme(theme);
  const slug = materialSlug ?? "stainless_steel";
  const key = [slug, finish?.id, logoFinish?.id].join("|");
  if (key === appliedKey) return;
  appliedKey = key;
  stage.setProduct(slug);
  containerEl?.setAttribute("aria-label", `3D preview: ${stage.productLabel}${finish ? ` in ${finish.name}` : ""}`);
  stage.setFinishes({ body: finish, logo: logoFinish }).catch((err) => console.error("3D finish", err));
}

export function setPreviewAutoRotate(enabled) {
  autoRotate = Boolean(enabled) && !reducedMotion;
  stage?.setAutoRotate(autoRotate);
}

export function zoomPreview(delta) {
  stage?.zoom(delta);
}

export function disposePreview3d() {
  disposed = true;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  stage?.dispose();
  stage = null;
  if (containerEl) {
    containerEl.innerHTML = "";
    containerEl.classList.remove("is-error");
  }
  containerEl = null;
}
