/**
 * Configurator viewport — 2D front/back PNG preview with finish tint.
 * Driven by material tab, finish wheel, and theme (parity with 3D module API).
 */
import { getStoredTheme } from "./components/core-home-navbar.js";
import { resolveFinishPreviewUrl, resolveGraphicComboUrl } from "./finish-asset-resolve.js";

const DEFAULT_COLOR = "#c3c6d7";
const FALLBACK_SRC = "/assets/ss/hero/default-tumbler.svg";
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.45;
const DEFAULT_SCALE = 1;
/** Product shell PNG aspect (width / height) — shared across material shells today. */
const SHELL_ASPECT = 165 / 486;
const RENDER_FIT_MAX = 2.5;
const RENDER_FIT_EPSILON = 0.01;

const MATERIAL_ASSETS = {
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

let containerEl = null;
let stageEl = null;
let frontImg = null;
let backImg = null;
let frontTint = null;
let backTint = null;
let scale = DEFAULT_SCALE;
let disposed = false;
let currentMaterial = "stainless_steel";
let currentFinishName = "";
let resizeFitTimer = null;

function containDisplayHeight(boxW, boxH, imgAspect) {
  const boxAspect = boxW / boxH;
  if (imgAspect > boxAspect) return boxW / imgAspect;
  return boxH;
}

function fitRenderImage(img, stackEl) {
  if (!img || !stackEl || !img.naturalWidth || !img.naturalHeight) return;
  const boxW = stackEl.clientWidth;
  const boxH = stackEl.clientHeight;
  if (!boxW || !boxH) return;
  const shellDisplayH = containDisplayHeight(boxW, boxH, SHELL_ASPECT);
  const renderAspect = img.naturalWidth / img.naturalHeight;
  const renderDisplayH = containDisplayHeight(boxW, boxH, renderAspect);
  if (!renderDisplayH) return;
  const rawScale = shellDisplayH / renderDisplayH;
  const fitScale =
    rawScale <= 1 + RENDER_FIT_EPSILON
      ? 1
      : Math.min(RENDER_FIT_MAX, rawScale);
  stackEl.style.setProperty("--render-fit-scale", String(fitScale));
}

function clearRenderFit() {
  for (const img of [frontImg, backImg]) {
    img?.closest(".mug-stack")?.style.removeProperty("--render-fit-scale");
  }
}

function syncRenderFit() {
  if (!containerEl?.classList.contains("preview-2d--has-render")) return;
  const frontStack = frontImg?.closest(".mug-stack");
  const backStack = backImg?.closest(".mug-stack");
  const refImg =
    frontImg?.naturalWidth > 0
      ? frontImg
      : backImg?.naturalWidth > 0
        ? backImg
        : null;
  if (!refImg || !frontStack) return;
  fitRenderImage(refImg, frontStack);
  const scale = frontStack.style.getPropertyValue("--render-fit-scale");
  if (backStack && scale) backStack.style.setProperty("--render-fit-scale", scale);
}

function scheduleRenderFit() {
  clearTimeout(resizeFitTimer);
  resizeFitTimer = setTimeout(syncRenderFit, 100);
}

function bindRenderFit(img) {
  if (!img) return;
  const onLoad = () => syncRenderFit();
  if (img.complete && img.naturalWidth > 0) onLoad();
  else img.addEventListener("load", onLoad, { once: true });
}

/** Finish name/process heuristics → CSS filter on tint layer. */
export function inferFinishAppearance(finish) {
  const name = String(finish?.name || "").toLowerCase();
  const process = String(finish?.finishProcess || finish?.category || "").toLowerCase();
  let brightness = 1;
  let contrast = 1;
  let saturate = 1;
  let opacity = 0.72;

  if (/metallic|electroplating|powder-metallic/i.test(name)) {
    contrast = 1.12;
    saturate = 1.15;
    opacity = 0.78;
  }
  if (/gloss|glossy/i.test(name)) {
    brightness = 1.08;
    contrast = 1.06;
    opacity = 0.68;
  }
  if (/matte|semi-matte|buff/i.test(name)) {
    brightness = 0.94;
    contrast = 0.92;
    saturate = 0.88;
    opacity = 0.82;
  }
  if (/powder/i.test(process) || /powder/i.test(name)) {
    brightness = 0.96;
    saturate = 0.9;
    opacity = 0.8;
  }
  if (/\buv\b/i.test(name)) {
    brightness = 1.12;
    saturate = 1.25;
    opacity = 0.75;
  }
  if (/glitter|iridescent|chameleon|speckle/i.test(name)) {
    saturate = 1.2;
    contrast = 1.08;
  }

  return { brightness, contrast, saturate, opacity };
}

function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") return DEFAULT_COLOR;
  const t = hex.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return t;
  if (/^hsl\(/i.test(t)) return t;
  return DEFAULT_COLOR;
}

function assetUrls(materialSlug) {
  return MATERIAL_ASSETS[materialSlug] ?? MATERIAL_ASSETS.stainless_steel;
}

function applyTintLayer(tintEl, src, finish) {
  if (!tintEl) return;
  const color = normalizeHex(finish?.hexColor);
  const { brightness, contrast, saturate, opacity } = finish
    ? inferFinishAppearance(finish)
    : { brightness: 1, contrast: 1, saturate: 1, opacity: 0 };

  tintEl.style.setProperty("--finish-tint", color);
  tintEl.style.setProperty("--mug-src", `url("${src}")`);
  tintEl.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
  tintEl.style.opacity = finish ? String(opacity) : "0";
}

function applyScale() {
  if (!stageEl) return;
  stageEl.style.setProperty("--preview-scale", String(scale));
}

function showErrorMessage(container, message) {
  container.classList.add("is-error");
  container.innerHTML = `<p class="preview-2d-fallback">${message}</p>`;
}

function buildDom(container) {
  container.innerHTML = `
    <div class="preview-2d-stage">
      <figure class="preview-2d-figure" data-view="front">
        <div class="mug-stack">
          <img class="mug-base mug-base--front" alt="" decoding="async" />
          <div class="mug-tint mug-tint--front" aria-hidden="true"></div>
        </div>
        <figcaption class="preview-2d-label">front</figcaption>
      </figure>
      <figure class="preview-2d-figure" data-view="back">
        <div class="mug-stack">
          <img class="mug-base mug-base--back" alt="" decoding="async" />
          <div class="mug-tint mug-tint--back" aria-hidden="true"></div>
        </div>
        <figcaption class="preview-2d-label">back</figcaption>
      </figure>
    </div>
  `;

  stageEl = container.querySelector(".preview-2d-stage");
  frontImg = container.querySelector(".mug-base--front");
  backImg = container.querySelector(".mug-base--back");
  frontTint = container.querySelector(".mug-tint--front");
  backTint = container.querySelector(".mug-tint--back");
}

function setImageSrc(img, src, onFail) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = FALLBACK_SRC;
    onFail?.();
  };
  img.src = src;
}

/**
 * @param {HTMLElement} container
 * @param {{ onReady?: () => void, onError?: (msg: string) => void }} [callbacks]
 */
export function initPreview2d(container, { onReady, onError } = {}) {
  if (!container) {
    onError?.("Preview container not found.");
    return false;
  }

  disposed = false;
  containerEl = container;
  containerEl.classList.remove("is-error");
  scale = DEFAULT_SCALE;
  buildDom(container);
  applyScale();
  applySceneTheme(getStoredTheme());

  const urls = assetUrls(currentMaterial);
  let failed = false;
  const onAssetFail = () => {
    failed = true;
  };

  setImageSrc(frontImg, urls.front, onAssetFail);
  setImageSrc(backImg, urls.back, onAssetFail);

  const maybeReady = () => {
    if (disposed) return;
    if (failed) {
      onError?.("Some product images could not load — using fallback.");
    }
    onReady?.();
  };

  let loaded = 0;
  const onOneLoad = () => {
    loaded += 1;
    if (loaded >= 2) maybeReady();
  };

  for (const img of [frontImg, backImg]) {
    if (img.complete && img.naturalWidth > 0) onOneLoad();
    else img.addEventListener("load", onOneLoad, { once: true });
  }

  window.addEventListener("resize", scheduleRenderFit);

  return true;
}

/**
 * @param {{ materialSlug?: string, finish?: object, graphic?: object, theme?: string }} opts
 */
export function updatePreview2d({ materialSlug, finish, graphic, theme }) {
  if (!containerEl || disposed) return;

  const slug = materialSlug ?? currentMaterial;
  const shellUrls = assetUrls(slug);
  const finishName = finish?.name ?? "";
  const materialLabel = slug.replace(/_/g, " ");
  const renderUrl = resolveFinishPreviewUrl(finish, graphic);

  if (slug !== currentMaterial) {
    currentMaterial = slug;
  }

  currentFinishName = finishName;
  const frontAlt = finishName
    ? `${materialLabel} ${finishName} front view`
    : `${materialLabel} product front view`;
  const backAlt = finishName
    ? `${materialLabel} ${finishName} back view`
    : `${materialLabel} product back view`;

  if (frontImg) frontImg.alt = frontAlt;
  if (backImg) backImg.alt = backAlt;

  const graphicLabel = graphic?.uiLabel;
  const comboActive = Boolean(resolveGraphicComboUrl(finish, graphic));
  const ariaLabel = comboActive && graphicLabel
    ? `${finishName} with ${graphicLabel} preview`
    : finishName
      ? `${finishName} finish preview`
      : "Product finish preview";
  containerEl.setAttribute("aria-label", ariaLabel);

  if (renderUrl) {
    containerEl.classList.add("preview-2d--has-render");
    setImageSrc(frontImg, renderUrl);
    setImageSrc(backImg, renderUrl);
    bindRenderFit(frontImg);
    bindRenderFit(backImg);
    if (frontTint) frontTint.style.opacity = "0";
    if (backTint) backTint.style.opacity = "0";
  } else {
    containerEl.classList.remove("preview-2d--has-render");
    clearRenderFit();
    setImageSrc(frontImg, shellUrls.front);
    setImageSrc(backImg, shellUrls.back);
    applyTintLayer(frontTint, shellUrls.front, finish);
    applyTintLayer(backTint, shellUrls.back, finish);
  }

  if (theme) applySceneTheme(theme);
}

export function setPreviewAutoRotate(_enabled) {
  /* 2D preview: reset zoom instead of rotate (API parity with 3D). */
  scale = DEFAULT_SCALE;
  applyScale();
}

export function zoomPreview(delta) {
  scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 - delta)));
  applyScale();
}

export function disposePreview2d() {
  disposed = true;
  clearTimeout(resizeFitTimer);
  window.removeEventListener("resize", scheduleRenderFit);
  if (containerEl) {
    containerEl.innerHTML = "";
    containerEl.classList.remove("is-error");
  }
  containerEl = null;
  stageEl = null;
  frontImg = null;
  backImg = null;
  frontTint = null;
  backTint = null;
}

function applySceneTheme(theme) {
  if (!containerEl) return;
  containerEl.dataset.theme = theme === "dark" ? "dark" : "light";
}
