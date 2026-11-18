/**
 * Render QA: each finish's image beside its 3D render, captured one at a time from a single
 * off-screen WebGL stage (browsers cap live WebGL contexts, so no canvas per card).
 */
import { createProductStage } from "./product-stage-3d.js";

const IMAGE_LABEL = { factory_photo: "Factory photo", ai_render: "AI sample" };

const grid = document.getElementById("qa-grid");
const status = document.getElementById("qa-status");
const select = document.getElementById("qa-material");
const stage = createProductStage(document.getElementById("qa-stage"), {
  interactive: false,
  preserveDrawingBuffer: true,
});

let runToken = 0;

/** Public catalog route: the Worker filters by material, the static Pages file returns all. */
async function fetchCatalog(materialSlug) {
  const res = await fetch(`/api/catalog?material=${encodeURIComponent(materialSlug)}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

/** The D1-backed catalog has no imageSource column; AI renders live under /assets/renders. */
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
  caption.querySelector("span").textContent = `${label} · ${finish.slug}`;
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

async function main() {
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
