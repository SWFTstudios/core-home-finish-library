/**
 * Studio stage for the 3D product preview: renderer, image-based lighting, floor, camera,
 * product model and per-zone finishes. Shared by the configurator and the render QA page.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildProduct } from "./product-models-3d.js";
import { finishRenderSpec, renderDataFor } from "./finish-render-spec.js";
import { createFinishMaterial, disposeFinishMaterial } from "./finish-material-3d.js";

/** Default view direction (front-right, slightly above), matching the old cube framing. */
const VIEW_DIR = new THREE.Vector3(0.62, 0.3, 0.72).normalize();

let renderDataPromise = null;

/** Sampled colours + hand overrides; both optional, the preview falls back to name rules. */
export function loadRenderData() {
  renderDataPromise ??= Promise.all(
    ["/data/finish-render.json", "/data/finish-render-overrides.json"].map((url) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  ).then(([renderData, overrides]) => ({ renderData, overrides }));
  return renderDataPromise;
}

/** Match `--lumina-background` in lumina-finish.css */
function themeBackground(theme) {
  return theme === "dark" ? 0x051424 : 0xf9f9ff;
}

/**
 * @param {HTMLElement} container
 * @param {{ interactive?: boolean, preserveDrawingBuffer?: boolean, fit?: number, lift?: number }} [options]
 */
export function createProductStage(
  container,
  { interactive = true, preserveDrawingBuffer = false, fit = 1.25, lift = 0 } = {},
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(2.5, 6, 3.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.01;
  keyLight.shadow.radius = 6;
  Object.assign(keyLight.shadow.camera, { near: 1, far: 14, left: -2, right: 2, top: 2, bottom: -2 });
  scene.add(keyLight);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.94, metalness: 0.02 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);

  const platformMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.45, 0.1, 96), platformMat);
  platform.position.y = -0.05;
  platform.receiveShadow = true;
  scene.add(platform);

  let grid = null;
  let controls = null;
  if (interactive) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.49;
  }

  let product = null;
  let materialSlug = null;
  let finishToken = 0;
  let theme = "light";

  function setTheme(next) {
    theme = next === "dark" ? "dark" : "light";
    const isDark = theme === "dark";
    const bg = new THREE.Color(themeBackground(theme));
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, isDark ? 6 : 7, isDark ? 22 : 24);
    floorMat.color.setHex(isDark ? 0x081c2e : 0xf4f6fa);
    platformMat.color.setHex(isDark ? 0x1c2b3c : 0xffffff);
    keyLight.intensity = isDark ? 1.2 : 1.4;
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      [grid.material].flat().forEach((m) => m.dispose());
    }
    grid = new THREE.GridHelper(24, 48, isDark ? 0x3d6a8a : 0xd0d8e4, isDark ? 0x1e3348 : 0xe2e8f0);
    grid.position.y = -0.095;
    for (const m of [grid.material].flat()) {
      m.transparent = true;
      m.opacity = isDark ? 0.22 : 0.18;
      m.depthWrite = false;
    }
    scene.add(grid);
  }

  /**
   * Fit camera distance to the product so a mug and a tall tumbler both fill the frame.
   * `fit` > 1 leaves room for HUD panels; `lift` raises the product above the bottom shelf.
   */
  function frame() {
    if (!product) return;
    const box = new THREE.Box3().setFromObject(product.group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    center.y -= size.y * lift;
    const fitHeight = size.y * fit;
    const fitWidth = (Math.max(size.x, size.z) * fit) / Math.max(camera.aspect, 0.4);
    const dist = Math.max(fitHeight, fitWidth) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.copy(center).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(center);
    if (controls) {
      controls.target.copy(center);
      controls.minDistance = dist * 0.4;
      controls.maxDistance = dist * 2.4;
      controls.update();
    }
  }

  function disposeProduct() {
    if (!product) return;
    scene.remove(product.group);
    product.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      disposeFinishMaterial(o.material);
    });
    product = null;
  }

  function setProduct(slug) {
    if (slug === materialSlug && product) return;
    disposeProduct();
    materialSlug = slug;
    product = buildProduct(slug);
    scene.add(product.group);
    frame();
  }

  async function materialFor(finish, data) {
    const { sampled, override } = renderDataFor(data.renderData, data.overrides, materialSlug, finish?.slug);
    const spec = finishRenderSpec(finish, materialSlug, sampled, override);
    const outer = product.zones.body[0].geometry;
    outer.computeBoundingBox();
    const bb = outer.boundingBox;
    const radius = (bb.max.x - bb.min.x) / 2;
    const aspect = (2 * Math.PI * radius) / Math.max(product.height, 1e-3);
    return createFinishMaterial(spec, { photoUrl: finish?.imageUrl ?? null, aspect });
  }

  function assign(zone, material) {
    const meshes = product.zones[zone];
    const previous = new Set(meshes.map((m) => m.material));
    for (const m of meshes) m.material = material;
    previous.forEach((m) => m !== material && disposeFinishMaterial(m));
  }

  /**
   * Apply finishes; logo === null hides the logo patch (it follows the body).
   * Resolves once textures are loaded, so callers can capture a finished frame.
   */
  async function setFinishes({ body, logo = null }) {
    if (!product) return;
    const token = ++finishToken;
    const data = await loadRenderData();
    const [bodyMat, logoMat] = await Promise.all([
      body ? materialFor(body, data) : null,
      logo ? materialFor(logo, data) : null,
    ]);
    if (token !== finishToken || !product) {
      disposeFinishMaterial(bodyMat);
      disposeFinishMaterial(logoMat);
      return;
    }
    if (bodyMat) assign("body", bodyMat);
    product.zones.logo[0].visible = Boolean(logoMat);
    if (logoMat) assign("logo", logoMat);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < 1 || h < 1) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    frame();
  }

  function render() {
    controls?.update();
    renderer.render(scene, camera);
  }

  function zoom(delta) {
    if (!controls) return;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const next = THREE.MathUtils.clamp(offset.length() * (1 - delta), controls.minDistance, controls.maxDistance);
    offset.setLength(next);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  function setAutoRotate(enabled) {
    if (!controls) return;
    controls.autoRotate = enabled;
    controls.autoRotateSpeed = 1.15;
  }

  function dispose() {
    disposeProduct();
    controls?.dispose();
    envTexture.dispose();
    pmrem.dispose();
    floor.geometry.dispose();
    floorMat.dispose();
    platform.geometry.dispose();
    platformMat.dispose();
    if (grid) {
      grid.geometry.dispose();
      [grid.material].flat().forEach((m) => m.dispose());
    }
    renderer.dispose();
    renderer.domElement.remove();
  }

  setTheme(theme);
  resize();

  return {
    renderer,
    setProduct,
    setFinishes,
    setTheme,
    resize,
    render,
    zoom,
    setAutoRotate,
    dispose,
    get productLabel() {
      return product?.label ?? "";
    },
  };
}
