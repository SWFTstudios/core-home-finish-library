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
    stage.setView("back");
    stage.render();
    const back = stage.renderer.domElement.toDataURL("image/png");
    window.__shells[material] = { front, back };

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
