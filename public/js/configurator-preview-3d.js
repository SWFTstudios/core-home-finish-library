/**
 * Configurator viewport — Three.js cube preview (WebGL).
 * Driven by material tab, finish wheel, and graphic selection.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getStoredTheme } from "./components/core-home-navbar.js";

const DEFAULT_COLOR = "#c3c6d7";

const MATERIAL_PRESETS = {
  stainless_steel: { metalness: 0.85, roughness: 0.25 },
  glass: { metalness: 0.12, roughness: 0.06 },
  ceramic: { metalness: 0.05, roughness: 0.45 },
  plastic: { metalness: 0.02, roughness: 0.55 },
};

let containerEl = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let cube = null;
let floor = null;
let grid = null;
let keyLight = null;
let hemiLight = null;
let animationId = null;
let resizeObserver = null;
let autoRotate = false;
let disposed = false;

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function parseHex(hex) {
  try {
    if (!hex) return new THREE.Color(DEFAULT_COLOR);
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color(DEFAULT_COLOR);
  }
}

/** Finish name/process heuristics layered on material preset. */
export function inferFinishAppearance(finish) {
  const name = String(finish?.name || "").toLowerCase();
  const process = String(finish?.finishProcess || finish?.category || "").toLowerCase();
  let metalnessDelta = 0;
  let roughnessDelta = 0;
  let emissive = null;
  let emissiveIntensity = 0;

  if (/metallic|electroplating|powder-metallic/i.test(name)) {
    metalnessDelta = 0.12;
    roughnessDelta = -0.12;
  }
  if (/gloss|glossy/i.test(name)) roughnessDelta -= 0.18;
  if (/matte|semi-matte|buff/i.test(name)) roughnessDelta += 0.18;
  if (/powder/i.test(process) || /powder/i.test(name)) {
    roughnessDelta += 0.12;
    metalnessDelta -= 0.08;
  }
  if (/\buv\b/i.test(name)) {
    emissive = parseHex(finish?.hexColor);
    emissiveIntensity = 0.4;
  }
  if (/glitter|iridescent|chameleon|speckle/i.test(name)) {
    roughnessDelta += 0.14;
    metalnessDelta += 0.04;
  }
  if (/ombr/i.test(name)) roughnessDelta += 0.06;

  return { metalnessDelta, roughnessDelta, emissive, emissiveIntensity };
}

function buildMaterialParams(materialSlug, finish) {
  const preset = MATERIAL_PRESETS[materialSlug] ?? MATERIAL_PRESETS.stainless_steel;
  const mods = finish
    ? inferFinishAppearance(finish)
    : { metalnessDelta: 0, roughnessDelta: 0, emissive: null, emissiveIntensity: 0 };

  const metalness = THREE.MathUtils.clamp(preset.metalness + mods.metalnessDelta, 0, 1);
  const roughness = THREE.MathUtils.clamp(preset.roughness + mods.roughnessDelta, 0.04, 1);
  const color = finish ? parseHex(finish.hexColor) : parseHex(null);

  return {
    color,
    metalness,
    roughness,
    emissive: mods.emissive ?? new THREE.Color(0x000000),
    emissiveIntensity: mods.emissiveIntensity,
  };
}

/** Match `--lumina-background` in lumina-finish.css */
function themeBackground(theme) {
  return theme === "dark" ? 0x051424 : 0xe8edf2;
}

function applySceneTheme(theme) {
  if (!scene) return;
  const isDark = theme === "dark";
  const bg = themeBackground(theme);
  const bgColor = new THREE.Color(bg);

  scene.background = bgColor;
  scene.fog = new THREE.Fog(bg, isDark ? 5 : 6, isDark ? 20 : 22);
  if (renderer) renderer.setClearColor(bgColor, 1);

  if (hemiLight) {
    hemiLight.color.setHex(isDark ? 0x8eb4d4 : 0xf0f6fc);
    hemiLight.groundColor.setHex(isDark ? 0x0a1520 : 0x9aa8b8);
    hemiLight.intensity = isDark ? 0.55 : 0.65;
  }

  if (keyLight) {
    keyLight.intensity = isDark ? 1.25 : 1.05;
    keyLight.color.setHex(isDark ? 0xe8f2ff : 0xffffff);
  }

  if (floor?.material) {
    floor.material.color.setHex(isDark ? 0x081c2e : 0xd8e2eb);
  }

  if (scene && grid) {
    scene.remove(grid);
    grid.geometry?.dispose();
    grid.material?.dispose();
    addGrid(scene, isDark);
  }
}

function addGrid(sceneRef, isDark) {
  const center = isDark ? 0x3d6a8a : 0x7a9ab8;
  const lines = isDark ? 0x1e3348 : 0xa8b8c8;
  grid = new THREE.GridHelper(28, 56, center, lines);
  grid.position.y = -0.499;
  const mat = grid.material;
  if (Array.isArray(mat)) {
    for (const m of mat) {
      m.transparent = true;
      m.opacity = isDark ? 0.28 : 0.42;
      m.depthWrite = false;
    }
  } else if (mat) {
    mat.transparent = true;
    mat.opacity = isDark ? 0.28 : 0.42;
    mat.depthWrite = false;
  }
  sceneRef.add(grid);
}

function buildEnvironment(sceneRef) {
  const floorGeo = new THREE.PlaneGeometry(28, 28);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xd8e2eb,
    roughness: 0.88,
    metalness: 0.06,
  });
  floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  sceneRef.add(floor);

  addGrid(sceneRef, false);
}

function resize() {
  if (!containerEl || !renderer || !camera) return;
  const w = containerEl.clientWidth;
  const h = containerEl.clientHeight;
  if (w < 1 || h < 1) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function animate() {
  if (disposed) return;
  animationId = requestAnimationFrame(animate);
  if (controls) {
    controls.autoRotate = autoRotate && !reducedMotion;
    controls.autoRotateSpeed = 1.15;
    controls.update();
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
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
  containerEl = container;
  containerEl.classList.remove("is-error");
  containerEl.innerHTML = "";

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (err) {
    const msg = "3D preview unavailable — WebGL could not start.";
    showErrorMessage(container, msg);
    onError?.(msg);
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  applySceneTheme(getStoredTheme());

  const aspect = Math.max(container.clientWidth / Math.max(container.clientHeight, 1), 0.5);
  camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 80);
  camera.position.set(2.6, 1.35, 2.8);

  hemiLight = new THREE.HemisphereLight(0xf0f6fc, 0x9aa8b8, 0.65);
  scene.add(hemiLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(ambient);

  keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
  keyLight.position.set(5, 8, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.00015;
  keyLight.shadow.normalBias = 0.02;
  const shCam = keyLight.shadow.camera;
  shCam.near = 0.5;
  shCam.far = 24;
  shCam.left = -6;
  shCam.right = 6;
  shCam.top = 6;
  shCam.bottom = -6;
  scene.add(keyLight);

  const fill = new THREE.DirectionalLight(0xb8c8e8, 0.28);
  fill.position.set(-4, 3, -3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x88b8e8, 0.35);
  rim.position.set(-2, 2, 5);
  scene.add(rim);

  buildEnvironment(scene);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: parseHex(null),
    metalness: 0.85,
    roughness: 0.25,
  });
  cube = new THREE.Mesh(geometry, material);
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.6;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 0.05, 0);
  controls.update();

  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (animationId) cancelAnimationFrame(animationId);
    showErrorMessage(containerEl, "3D preview paused — reload the page to restore.");
    onError?.("WebGL context lost.");
  });

  resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);
  resize();

  animate();
  onReady?.();
  return true;
}

/**
 * @param {{ materialSlug?: string, finish?: object, graphic?: object, theme?: string }} opts
 */
export function updatePreview3d({ materialSlug, finish, theme }) {
  if (!cube?.material || disposed) return;

  const p = buildMaterialParams(materialSlug ?? "stainless_steel", finish);
  cube.material.color.copy(p.color);
  cube.material.metalness = p.metalness;
  cube.material.roughness = p.roughness;
  cube.material.emissive.copy(p.emissive);
  cube.material.emissiveIntensity = p.emissiveIntensity;
  cube.material.needsUpdate = true;

  if (theme) applySceneTheme(theme);
}

export function setPreviewAutoRotate(enabled) {
  autoRotate = Boolean(enabled) && !reducedMotion;
  if (controls) controls.autoRotate = autoRotate;
}

export function zoomPreview(delta) {
  if (!camera || !controls) return;
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const dist = offset.length();
  const next = THREE.MathUtils.clamp(dist * (1 - delta), controls.minDistance, controls.maxDistance);
  offset.setLength(next);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

export function disposePreview3d() {
  disposed = true;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  controls?.dispose();
  controls = null;
  cube?.geometry?.dispose();
  cube?.material?.dispose();
  cube = null;
  floor?.geometry?.dispose();
  floor?.material?.dispose();
  floor = null;
  if (grid) {
    grid.geometry?.dispose();
    const gridMat = grid.material;
    if (Array.isArray(gridMat)) gridMat.forEach((m) => m.dispose());
    else gridMat?.dispose();
    grid = null;
  }
  keyLight = null;
  hemiLight = null;
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  if (containerEl) {
    containerEl.innerHTML = "";
    containerEl.classList.remove("is-error");
  }
  containerEl = null;
}
