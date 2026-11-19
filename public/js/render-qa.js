/**
 * Render QA: each finish's image beside its 3D render, captured one at a time from a single
 * off-screen WebGL stage (browsers cap live WebGL contexts, so no canvas per card).
 *
 * ?shells=1 — export neutral product shells (front/back, transparent) for the 2D preview.
 */
import { createProductStage } from "./product-stage-3d.js";

const IMAGE_LABEL = { factory_photo: "Factory photo", ai_render: "AI sample" };
const SHELL_MODE = new URLSearchParams(location.search).has("shells");
const MATERIALS = ["ceramic", "glass", "stainless_steel", "plastic"];
const NEUTRAL = {
  name: "Neutral shell",
  slug: "neutral-shell",
  hexColor: "#d8dde3",
  finishProcess: "Paint",
};

/** Shells are exported at 2× the on-screen size so they stay sharp on retina displays. */
if (SHELL_MODE) Object.assign(document.getElementById("qa-stage").style, { width: "720px", height: "960px" });

const grid = document.getElementById("qa-grid");
const status = document.getElementById("qa-status");
const select = document.getElementById("qa-material");
const stage = createProductStage(document.getElementById("qa-stage"), {
  interactive: false,
  preserveDrawingBuffer: true,
  alpha: SHELL_MODE,
  showEnvironment: !SHELL_MODE,
  fit: SHELL_MODE ? 1.05 : 1.25,
});

let runToken = 0;
let aiPhotos = { photos: {} };

async function loadAiPhotos() {
  try {
    aiPhotos = await (await fetch("/data/ai-photos.json")).json();
  } catch {
    aiPhotos = { photos: {} };
  }
}

/** @type {Record<string, { front: string, back: string }>} */
window.__shells = {};

async function fetchCatalog(materialSlug) {
  const res = await fetch(`/api/catalog?material=${encodeURIComponent(materialSlug)}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

function imageLabel(finish) {
  const source =
    finish.imageSource ??
    (finish.imageUrl ? (finish.imageUrl.startsWith("/assets/renders/") ? "ai_render" : "factory_photo") : null);
  return IMAGE_LABEL[source] ?? "No image";
}

function card(finish) {
  const label = imageLabel(finish);
  const fig = document.createElement("figure");
  fig.className = "render-qa-card";
  fig.dataset.slug = finish.slug;
  const pair = document.createElement("div");
  pair.className = "render-qa-pair";
  if (finish.imageUrl) {
    const photo = document.createElement("img");
    photo.src = finish.imageUrl;
    photo.alt = `${finish.name} — ${label}`;
    photo.loading = "lazy";
    pair.appendChild(photo);
  } else {
    const empty = document.createElement("div");
    empty.className = "render-qa-empty";
    empty.textContent = "No image";
    pair.appendChild(empty);
  }
  const render = document.createElement("img");
  render.alt = `${finish.name} — 3D render`;
  pair.appendChild(render);
  const caption = document.createElement("figcaption");
  caption.innerHTML = `<strong></strong><span></span>`;
  caption.querySelector("strong").textContent = finish.name;
  const review = aiPhotos.photos?.[`${finish.materialSlug}/${finish.slug}`]?.reviewStatus;
  caption.querySelector("span").textContent = review
    ? `${label} · ${finish.slug} · AI ${review}`
    : `${label} · ${finish.slug}`;
  fig.append(pair, caption);
  return { fig, render };
}

async function renderMaterial(materialSlug) {
  const token = ++runToken;
  grid.innerHTML = "";
  status.textContent = "Loading catalog…";
  const catalog = await fetchCatalog(materialSlug);
  if (token !== runToken) return;
  const finishes = catalog.finishes.filter((f) => f.materialSlug === materialSlug && f.availability !== "not_offered");
  stage.setProduct(materialSlug);
  const cards = finishes.map((f) => {
    const c = card(f);
    grid.appendChild(c.fig);
    return c;
  });
  for (let i = 0; i < finishes.length; i++) {
    if (token !== runToken) return;
    status.textContent = `Rendering ${i + 1} of ${finishes.length}…`;
    await stage.setFinishes({ body: finishes[i] });
    stage.render();
    cards[i].render.src = stage.renderer.domElement.toDataURL("image/png");
  }
  status.textContent = `${finishes.length} finishes rendered.`;
}

/** Linear light value (0–4) → 8 bits, square-root encoded for precision in the shadows. */
const encLight = (x) => Math.round(Math.sqrt(Math.min(Math.max(x / 4, 0), 1)) * 255);

/**
 * Grow the finishable area by a couple of pixels into the background, so the anti-aliased edge of
 * the shell picks up the finish instead of the neutral grey.
 */
function dilatePasses(p, iterations = 2) {
  const { width: w, height: h } = p;
  for (let it = 0; it < iterations; it++) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = p.uv[i * 4 + 2] > 0.5 ? 1 : p.uv[i * 4 + 3] > 0.5 ? 2 : 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (mask[i]) continue;
        const nb = [i - 1, i + 1, i - w, i + w].find((j) => mask[j] === 1);
        if (nb === undefined) continue;
        for (const key of ["uv", "light", "metal"]) p[key].copyWithin(i * 4, nb * 4, nb * 4 + 4);
      }
    }
  }
}

/** Pack the float passes into three PNGs (see public/js/finish-composite-2d.js for decoding). */
function encodePasses(p) {
  dilatePasses(p);
  const { width: w, height: h } = p;
  const images = {};
  for (const key of ["uv", "light", "metal"]) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const src = p[key];
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (key === "uv") {
        const finishable = src[o + 2] > 0.5;
        const u = Math.round(Math.min(Math.max(src[o], 0), 1) * 4095);
        const v = Math.round(Math.min(Math.max(src[o + 1], 0), 1) * 4095);
        d[o] = u >> 4;
        d[o + 1] = v >> 4;
        d[o + 2] = ((u & 15) << 4) | (v & 15);
        d[o + 3] = finishable ? 255 : 0;
      } else if (key === "light") {
        d[o] = encLight(src[o]);
        d[o + 1] = encLight(src[o + 1]);
        d[o + 2] = encLight(src[o + 2]);
        d[o + 3] = 255;
      } else {
        d[o] = encLight(src[o]);
        d[o + 1] = encLight(src[o + 1]);
        d[o + 2] = Math.round(Math.min(Math.max(src[o + 2], 0), 1) * 255);
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    images[key] = c.toDataURL("image/png");
  }
  return images;
}

async function exportShells() {
  status.textContent = "Exporting product shells…";
  select.disabled = true;
  grid.innerHTML = "";
  for (const material of MATERIALS) {
    stage.setProduct(material);
    await stage.setFinishes({ body: { ...NEUTRAL, materialSlug: material } });
    stage.setView("front");
    stage.render();
    const front = stage.renderer.domElement.toDataURL("image/png");
    const frontPasses = encodePasses(stage.capturePasses());
    stage.setView("back");
    stage.render();
    const back = stage.renderer.domElement.toDataURL("image/png");
    const backPasses = encodePasses(stage.capturePasses());
    window.__shells[material] = {
      front,
      back,
      ...Object.fromEntries(Object.entries(frontPasses).map(([k, v]) => [`front-${k}`, v])),
      ...Object.fromEntries(Object.entries(backPasses).map(([k, v]) => [`back-${k}`, v])),
    };

    const fig = document.createElement("figure");
    fig.className = "render-qa-card";
    fig.innerHTML = `<div class="render-qa-pair"><img alt="${material} front" /><img alt="${material} back" /></div><figcaption><strong>${material}</strong><span>front · back</span></figcaption>`;
    const imgs = fig.querySelectorAll("img");
    imgs[0].src = front;
    imgs[1].src = back;
    const links = document.createElement("p");
    links.innerHTML = `<a download="${material}-front.png" href="${front}">Download front</a> · <a download="${material}-back.png" href="${back}">Download back</a>`;
    fig.appendChild(links);
    grid.appendChild(fig);
  }
  status.textContent = "Shells ready. Downloads are available under each card.";
  document.documentElement.dataset.shellsReady = "1";
}

async function main() {
  await loadAiPhotos();
  if (SHELL_MODE) {
    document.querySelector(".render-qa-header h1").textContent = "Product shell export";
    select.hidden = true;
    await exportShells();
    return;
  }

  const fromUrl = new URLSearchParams(location.search).get("material");
  const catalog = await fetchCatalog(fromUrl || "stainless_steel");
  for (const m of catalog.materials ?? []) {
    const opt = document.createElement("option");
    opt.value = m.slug;
    opt.textContent = m.label;
    select.appendChild(opt);
  }
  if (fromUrl) select.value = fromUrl;
  const run = () => renderMaterial(select.value).catch(showError);
  select.addEventListener("change", () => {
    history.replaceState(null, "", `?material=${select.value}`);
    run();
  });
  run();
}

function showError(err) {
  status.textContent = `Could not load catalog: ${err.message}`;
}

main().catch(showError);
