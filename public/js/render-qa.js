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

let catalog = null;
let runToken = 0;

function card(finish) {
  const fig = document.createElement("figure");
  fig.className = "render-qa-card";
  const pair = document.createElement("div");
  pair.className = "render-qa-pair";
  if (finish.imageUrl) {
    const photo = document.createElement("img");
    photo.src = finish.imageUrl;
    photo.alt = `${finish.name} — ${IMAGE_LABEL[finish.imageSource] ?? "image"}`;
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
  caption.querySelector("span").textContent = `${IMAGE_LABEL[finish.imageSource] ?? "No image"} · ${finish.slug}`;
  fig.append(pair, caption);
  return { fig, render };
}

async function renderMaterial(materialSlug) {
  const token = ++runToken;
  const finishes = catalog.finishes.filter((f) => f.materialSlug === materialSlug && f.availability !== "not_offered");
  grid.innerHTML = "";
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
  const res = await fetch("/api/catalog.json");
  catalog = await res.json();
  for (const m of catalog.materials ?? []) {
    const opt = document.createElement("option");
    opt.value = m.slug;
    opt.textContent = m.label;
    select.appendChild(opt);
  }
  const fromUrl = new URLSearchParams(location.search).get("material");
  if (fromUrl) select.value = fromUrl;
  select.addEventListener("change", () => {
    history.replaceState(null, "", `?material=${select.value}`);
    renderMaterial(select.value);
  });
  renderMaterial(select.value);
}

main().catch((err) => {
  status.textContent = `Could not load catalog: ${err.message}`;
});
