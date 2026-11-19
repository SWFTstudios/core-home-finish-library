/**
 * Configurator viewport — 2D preview with the finish painted onto front/back product shells.
 * Driven by material tab, finish wheel, and theme (parity with 3D module API).
 *
 * The finish is lit with the shell passes from the 3D studio (finish-composite-2d.js), so the 2D
 * front and back show the real surface: the photo pattern wrapped around the body, gloss and
 * metal reflections, glitter, see-through glass. If the passes are missing, a flat CSS tint over
 * the shell is used instead.
 */
import { getStoredTheme } from "./components/core-home-navbar.js";
import { resolveFinishPreviewUrl, resolveGraphicComboUrl } from "./finish-asset-resolve.js";
import { loadRenderData } from "./finish-render-data.js";
import { finishRenderSpec, renderDataFor } from "./finish-render-spec.js";
import { loadShellPasses, paintFinish } from "./finish-composite-2d.js";
import { badgePlacement, surfaceAspect } from "./product-profiles.js";
import { graphicRenderSpec } from "./graphic-application-spec.js";

const DEFAULT_COLOR = "#c3c6d7";
const FALLBACK_SRC = "/assets/ss/hero/default-tumbler.svg";
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.45;
const DEFAULT_SCALE = 1;

const MATERIAL_ASSETS = Object.fromEntries(
  ["ceramic", "glass", "stainless_steel", "plastic"].map((m) => [
    m,
    { base: `/assets/${m}`, front: `/assets/${m}/front.png`, back: `/assets/${m}/back.png` },
  ]),
);

const IMAGE_LABEL = { factory_photo: "Factory photo", ai_render: "AI sample" };

let containerEl = null;
let stageEl = null;
let sourceEl = null;
let frontImg = null;
let backImg = null;
let frontTint = null;
let backTint = null;
let frontCanvas = null;
let backCanvas = null;
let scale = DEFAULT_SCALE;
let disposed = false;
let currentMaterial = "stainless_steel";
let applyToken = 0;

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

/**
 * Fallback when the shell passes are unavailable: flat colour (or gradient) multiplied over the
 * shell silhouette via CSS mask. Photos are never stretched over the shell.
 *
 * @param {HTMLElement|null} tintEl
 * @param {string} shellSrc
 * @param {object|null} finish
 * @param {object|null} spec
 */
export function applyFinishOverlay(tintEl, shellSrc, finish, spec) {
  if (!tintEl) return;

  tintEl.style.setProperty("--mug-src", `url("${shellSrc}")`);

  if (!finish) {
    tintEl.style.removeProperty("--finish-tint");
    tintEl.style.filter = "";
    tintEl.style.opacity = "0";
    return;
  }

  const color = normalizeHex(spec?.color ?? finish?.hexColor);
  const { brightness, contrast, saturate, opacity } = spec
    ? tintFromSpec(spec)
    : { brightness: 1, contrast: 1, saturate: 1, opacity: 0.72 };

  let fill = color;
  if (spec?.gradient?.stops?.length >= 2) {
    const [a, b] = spec.gradient.stops;
    fill = `linear-gradient(${spec.gradient.type === "diagonal" ? "135deg" : "to bottom"}, ${a}, ${b})`;
  }

  tintEl.style.setProperty("--finish-tint", fill);
  tintEl.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
  tintEl.style.opacity = String(opacity);
}

function applyScale() {
  if (!stageEl) return;
  stageEl.style.setProperty("--preview-scale", String(scale));
}

function buildDom(container) {
  container.innerHTML = `
    <div class="preview-2d-stage">
      <figure class="preview-2d-figure" data-view="front">
        <div class="mug-stack">
          <img class="mug-base mug-base--front" alt="" decoding="async" />
          <canvas class="mug-base mug-render mug-render--front" role="img" hidden></canvas>
          <div class="mug-tint mug-tint--front" aria-hidden="true"></div>
        </div>
        <figcaption class="preview-2d-label">front</figcaption>
      </figure>
      <figure class="preview-2d-figure" data-view="back">
        <div class="mug-stack">
          <img class="mug-base mug-base--back" alt="" decoding="async" />
          <canvas class="mug-base mug-render mug-render--back" role="img" hidden></canvas>
          <div class="mug-tint mug-tint--back" aria-hidden="true"></div>
        </div>
        <figcaption class="preview-2d-label">back</figcaption>
      </figure>
    </div>
    <p class="preview-2d-source" hidden></p>
  `;

  stageEl = container.querySelector(".preview-2d-stage");
  sourceEl = container.querySelector(".preview-2d-source");
  frontImg = container.querySelector(".mug-base--front");
  backImg = container.querySelector(".mug-base--back");
  frontTint = container.querySelector(".mug-tint--front");
  backTint = container.querySelector(".mug-tint--back");
  frontCanvas = container.querySelector(".mug-render--front");
  backCanvas = container.querySelector(".mug-render--back");
}

/** Swap between the lit canvas render and the shell image + CSS tint fallback. */
function showRendered(rendered) {
  for (const [img, canvas, tint] of [
    [frontImg, frontCanvas, frontTint],
    [backImg, backCanvas, backTint],
  ]) {
    if (canvas) canvas.hidden = !rendered;
    if (img) img.hidden = rendered;
    if (tint) tint.hidden = rendered;
  }
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
  containerEl.classList.remove("is-error", "preview-2d--has-render", "preview-2d--photo");
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
  loadRenderData().then(async (data) => {
    if (token !== applyToken || disposed) return;
    const { sampled, override } = renderDataFor(data.renderData, data.overrides, slug, finish?.slug);
    const spec = finish ? finishRenderSpec(finish, slug, sampled, override) : null;

    if (frontImg) frontImg.alt = `${materialLabel} ${finishName || "product"} front view`;
    if (backImg) backImg.alt = `${materialLabel} ${finishName || "product"} back view`;
    if (frontCanvas) frontCanvas.setAttribute("aria-label", frontImg?.alt ?? "");
    if (backCanvas) backCanvas.setAttribute("aria-label", backImg?.alt ?? "");

    if (sourceEl) {
      // The finish map is taken from this image; say where it came from.
      const label = spec?.photo && renderUrl ? imageSourceLabel(finish) : null;
      sourceEl.hidden = !label;
      sourceEl.textContent = label ? `Texture from ${label.toLowerCase()}` : "";
    }

    if (spec) {
      try {
        const [front, back] = await Promise.all([
          loadShellPasses(shellUrls.base, "front"),
          loadShellPasses(shellUrls.base, "back"),
        ]);
        if (token !== applyToken || disposed) return;
        // Paint into fresh canvases, then swap, so the old finish stays until the new one is ready.
        const next = [document.createElement("canvas"), document.createElement("canvas")];
        await paintFinish({
          spec,
          photoUrl: finish.imageUrl ?? null,
          aspect: surfaceAspect(slug),
          sides: [
            { passes: front, canvas: next[0] },
            // The logo sits on the front; the back shows the other side of the product.
            { passes: back, canvas: next[1], logo: false },
          ],
          graphic: graphic ? { gspec: graphicRenderSpec(graphic, spec), placement: badgePlacement(slug) } : null,
        });
        if (token !== applyToken || disposed) return;
        copyCanvas(next[0], frontCanvas);
        copyCanvas(next[1], backCanvas);
        showRendered(true);
        return;
      } catch (err) {
        console.warn(`2D finish render unavailable, using flat tint: ${err.message}`);
      }
    }

    showRendered(false);
    setImageSrc(frontImg, shellUrls.front);
    setImageSrc(backImg, shellUrls.back);
    applyFinishOverlay(frontTint, shellUrls.front, finish, spec);
    applyFinishOverlay(backTint, shellUrls.back, finish, spec);
  });
}

function copyCanvas(from, to) {
  if (!to) return;
  to.width = from.width;
  to.height = from.height;
  to.getContext("2d").drawImage(from, 0, 0);
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
  if (containerEl) {
    containerEl.innerHTML = "";
    containerEl.classList.remove("is-error", "preview-2d--has-render", "preview-2d--photo");
  }
  containerEl = null;
  stageEl = null;
  sourceEl = null;
  frontImg = null;
  backImg = null;
  frontTint = null;
  backTint = null;
  frontCanvas = null;
  backCanvas = null;
}

function applySceneTheme(theme) {
  if (!containerEl) return;
  containerEl.dataset.theme = theme === "dark" ? "dark" : "light";
}
