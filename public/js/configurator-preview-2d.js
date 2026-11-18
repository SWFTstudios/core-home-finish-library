/**
 * Configurator viewport — 2D preview with finish photo or tinted product shell.
 * Driven by material tab, finish wheel, and theme (parity with 3D module API).
 */
import { getStoredTheme } from "./components/core-home-navbar.js";
import { resolveFinishPreviewUrl, resolveGraphicComboUrl } from "./finish-asset-resolve.js";
import { loadRenderData } from "./finish-render-data.js";
import { finishRenderSpec, renderDataFor } from "./finish-render-spec.js";

const DEFAULT_COLOR = "#c3c6d7";
const FALLBACK_SRC = "/assets/ss/hero/default-tumbler.svg";
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.45;
const DEFAULT_SCALE = 1;
const SHELL_ASPECT = 165 / 486;
const RENDER_FIT_MAX = 2.5;
const RENDER_FIT_EPSILON = 0.01;

const MATERIAL_ASSETS = {
  ceramic: { front: "/assets/ceramic/front.png", back: "/assets/ceramic/back.png" },
  glass: { front: "/assets/glass/front.png", back: "/assets/glass/back.png" },
  stainless_steel: { front: "/assets/stainless_steel/front.png", back: "/assets/stainless_steel/back.png" },
  plastic: { front: "/assets/plastic/front.png", back: "/assets/plastic/back.png" },
};

const IMAGE_LABEL = { factory_photo: "Factory photo", ai_render: "AI sample" };

let containerEl = null;
let stageEl = null;
let photoEl = null;
let sourceEl = null;
let frontImg = null;
let backImg = null;
let frontTint = null;
let backTint = null;
let scale = DEFAULT_SCALE;
let disposed = false;
let currentMaterial = "stainless_steel";
let resizeFitTimer = null;
let applyToken = 0;

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
  const fitScale = rawScale <= 1 + RENDER_FIT_EPSILON ? 1 : Math.min(RENDER_FIT_MAX, rawScale);
  stackEl.style.setProperty("--render-fit-scale", String(fitScale));
}

function clearRenderFit() {
  for (const img of [frontImg, backImg, photoEl]) {
    img?.closest(".mug-stack")?.style.removeProperty("--render-fit-scale");
  }
}

function syncRenderFit() {
  if (!containerEl?.classList.contains("preview-2d--has-render")) return;
  const img =
    photoEl?.naturalWidth > 0
      ? photoEl
      : frontImg?.naturalWidth > 0
        ? frontImg
        : backImg?.naturalWidth > 0
          ? backImg
          : null;
  const stack = img?.closest(".mug-stack");
  if (!img || !stack) return;
  fitRenderImage(img, stack);
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

/** Map finishRenderSpec → CSS filter on the tint layer. */
export function tintFromSpec(spec) {
  let brightness = 1;
  let contrast = 1;
  let saturate = 1;
  let opacity = 0.72;
  if (spec.metalness > 0.7) {
    contrast = 1.12;
    saturate = 1.05;
    opacity = 0.78;
  } else if (spec.metalness > 0.4) {
    contrast = 1.08;
    saturate = 1.12;
    opacity = 0.76;
  }
  if (spec.roughness < 0.2) {
    brightness = 1.08;
    contrast = Math.max(contrast, 1.06);
    opacity = 0.68;
  } else if (spec.roughness > 0.7) {
    brightness = 0.94;
    contrast = 0.92;
    saturate = 0.88;
    opacity = 0.82;
  }
  if (spec.family === "powder") {
    brightness = 0.96;
    saturate = 0.9;
    opacity = 0.8;
  }
  if (spec.emissiveIntensity > 0) {
    brightness = 1.12;
    saturate = 1.25;
  }
  if (spec.flakes || spec.iridescence > 0.3) {
    saturate = Math.max(saturate, 1.2);
    contrast = Math.max(contrast, 1.08);
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

function imageSourceLabel(finish) {
  const source =
    finish?.imageSource ??
    (finish?.imageUrl
      ? finish.imageUrl.startsWith("/assets/renders/")
        ? "ai_render"
        : "factory_photo"
      : null);
  return IMAGE_LABEL[source] ?? null;
}

function applyTintLayer(tintEl, src, finish, spec) {
  if (!tintEl) return;
  const color = normalizeHex(spec?.color ?? finish?.hexColor);
  const { brightness, contrast, saturate, opacity } = spec
    ? tintFromSpec(spec)
    : { brightness: 1, contrast: 1, saturate: 1, opacity: 0 };

  tintEl.style.setProperty("--finish-tint", color);
  if (spec?.gradient?.stops?.length >= 2) {
    const [a, b] = spec.gradient.stops;
    tintEl.style.setProperty(
      "--finish-tint",
      `linear-gradient(${spec.gradient.type === "diagonal" ? "135deg" : "to bottom"}, ${a}, ${b})`,
    );
  }
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
      <figure class="preview-2d-figure preview-2d-figure--photo" data-view="photo" hidden>
        <div class="mug-stack mug-stack--photo">
          <img class="mug-base mug-base--photo" alt="" decoding="async" />
        </div>
      </figure>
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
    <p class="preview-2d-source" hidden></p>
  `;

  stageEl = container.querySelector(".preview-2d-stage");
  photoEl = container.querySelector(".mug-base--photo");
  sourceEl = container.querySelector(".preview-2d-source");
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

function setPhotoMode(enabled) {
  if (!containerEl) return;
  containerEl.classList.toggle("preview-2d--has-render", enabled);
  containerEl.classList.toggle("preview-2d--photo", enabled);
  const photoFigure = containerEl.querySelector('[data-view="photo"]');
  const frontFigure = containerEl.querySelector('[data-view="front"]');
  const backFigure = containerEl.querySelector('[data-view="back"]');
  if (photoFigure) photoFigure.hidden = !enabled;
  if (frontFigure) frontFigure.hidden = enabled;
  if (backFigure) backFigure.hidden = enabled;
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
  loadRenderData();

  const urls = assetUrls(currentMaterial);
  let failed = false;
  setImageSrc(frontImg, urls.front, () => {
    failed = true;
  });
  setImageSrc(backImg, urls.back, () => {
    failed = true;
  });

  let loaded = 0;
  const onOneLoad = () => {
    loaded += 1;
    if (loaded >= 2) {
      if (failed) onError?.("Some product images could not load — using fallback.");
      onReady?.();
    }
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
  currentMaterial = slug;

  const graphicLabel = graphic?.uiLabel;
  const comboActive = Boolean(resolveGraphicComboUrl(finish, graphic));
  containerEl.setAttribute(
    "aria-label",
    comboActive && graphicLabel
      ? `${finishName} with ${graphicLabel} preview`
      : finishName
        ? `${finishName} finish preview`
        : "Product finish preview",
  );

  if (theme) applySceneTheme(theme);

  const token = ++applyToken;
  loadRenderData().then((data) => {
    if (token !== applyToken || disposed) return;
    const { sampled, override } = renderDataFor(data.renderData, data.overrides, slug, finish?.slug);
    const spec = finish ? finishRenderSpec(finish, slug, sampled, override) : null;

    if (renderUrl) {
      setPhotoMode(true);
      clearRenderFit();
      setImageSrc(photoEl, renderUrl);
      bindRenderFit(photoEl);
      if (photoEl) {
        photoEl.alt = finishName
          ? `${materialLabel} ${finishName}`
          : `${materialLabel} product`;
      }
      if (sourceEl) {
        const label = imageSourceLabel(finish);
        sourceEl.hidden = !label;
        sourceEl.textContent = label ?? "";
      }
      if (frontTint) frontTint.style.opacity = "0";
      if (backTint) backTint.style.opacity = "0";
      return;
    }

    setPhotoMode(false);
    clearRenderFit();
    if (sourceEl) sourceEl.hidden = true;
    setImageSrc(frontImg, shellUrls.front);
    setImageSrc(backImg, shellUrls.back);
    if (frontImg) frontImg.alt = `${materialLabel} ${finishName || "product"} front view`;
    if (backImg) backImg.alt = `${materialLabel} ${finishName || "product"} back view`;
    applyTintLayer(frontTint, shellUrls.front, finish, spec);
    applyTintLayer(backTint, shellUrls.back, finish, spec);
  });
}

export function setPreviewAutoRotate(_enabled) {
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
    containerEl.classList.remove("is-error", "preview-2d--has-render", "preview-2d--photo");
  }
  containerEl = null;
  stageEl = null;
  photoEl = null;
  sourceEl = null;
  frontImg = null;
  backImg = null;
  frontTint = null;
  backTint = null;
}

function applySceneTheme(theme) {
  if (!containerEl) return;
  containerEl.dataset.theme = theme === "dark" ? "dark" : "light";
}
