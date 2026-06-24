/**
 * Configurator viewport — 2D front/back PNG preview with finish tint.
 * Driven by material tab, finish wheel, and theme (parity with 3D module API).
 */
import { getStoredTheme } from "./components/core-home-navbar.js";

const DEFAULT_COLOR = "#c3c6d7";
const FALLBACK_SRC = "/assets/ss/hero/default-tumbler.svg";
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.45;
const DEFAULT_SCALE = 1;

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

  return true;
}

/**
 * @param {{ materialSlug?: string, finish?: object, graphic?: object, theme?: string }} opts
 */
export function updatePreview2d({ materialSlug, finish, theme }) {
  if (!containerEl || disposed) return;

  const slug = materialSlug ?? currentMaterial;
  const urls = assetUrls(slug);
  const finishName = finish?.name ?? "";
  const materialLabel = slug.replace(/_/g, " ");

  if (slug !== currentMaterial) {
    currentMaterial = slug;
    setImageSrc(frontImg, urls.front);
    setImageSrc(backImg, urls.back);
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

  containerEl.setAttribute(
    "aria-label",
    finishName ? `${finishName} finish preview` : "Product finish preview",
  );

  applyTintLayer(frontTint, urls.front, finish);
  applyTintLayer(backTint, urls.back, finish);

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
