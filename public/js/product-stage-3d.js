/**
 * Studio stage for the 3D product preview: renderer, image-based lighting, floor, camera,
 * product model and per-zone finishes. Shared by the configurator and the render QA page.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildProduct } from "./product-models-3d.js";
import { finishRenderSpec, renderDataFor } from "./finish-render-spec.js";
import { createFinishMaterial, createGraphicMaterial, disposeFinishMaterial } from "./finish-material-3d.js";
import { graphicRenderSpec } from "./graphic-application-spec.js";
import { loadRenderData } from "./finish-render-data.js";

export { loadRenderData };

/** Default view direction (front-right, slightly above), matching the old cube framing. */
const VIEW_DIR = new THREE.Vector3(0.62, 0.3, 0.72).normalize();

/** Match `--lumina-background` in lumina-finish.css */
function themeBackground(theme) {
  return theme === "dark" ? 0x051424 : 0xf9f9ff;
}

/**
 * @param {HTMLElement} container
 * @param {{ interactive?: boolean, preserveDrawingBuffer?: boolean, fit?: number, lift?: number, alpha?: boolean, showEnvironment?: boolean }} [options]
 */
export function createProductStage(
  container,
  {
    interactive = true,
    preserveDrawingBuffer = false,
    fit = 1.25,
    lift = 0,
    alpha = false,
    showEnvironment = true,
  } = {},
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = showEnvironment;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (alpha) renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(2.5, 6, 3.5);
  keyLight.castShadow = showEnvironment;
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
  floor.visible = showEnvironment;
  scene.add(floor);

  const platformMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.45, 0.1, 96), platformMat);
  platform.position.y = -0.05;
  platform.receiveShadow = true;
  platform.visible = showEnvironment;
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
    if (alpha || !showEnvironment) {
      scene.background = null;
      scene.fog = null;
    } else {
      const bg = new THREE.Color(themeBackground(theme));
      scene.background = bg;
      scene.fog = new THREE.Fog(bg, isDark ? 6 : 7, isDark ? 22 : 24);
    }
    floorMat.color.setHex(isDark ? 0x081c2e : 0xf4f6fa);
    platformMat.color.setHex(isDark ? 0x1c2b3c : 0xffffff);
    keyLight.intensity = isDark ? 1.2 : 1.4;
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      [grid.material].flat().forEach((m) => m.dispose());
      grid = null;
    }
    if (showEnvironment) {
      grid = new THREE.GridHelper(24, 48, isDark ? 0x3d6a8a : 0xd0d8e4, isDark ? 0x1e3348 : 0xe2e8f0);
      grid.position.y = -0.095;
      for (const m of [grid.material].flat()) {
        m.transparent = true;
        m.opacity = isDark ? 0.22 : 0.18;
        m.depthWrite = false;
      }
      scene.add(grid);
    }
  }

  /**
   * Front / back view for shell exports (Y-up, looking at product centre). The back is shown by
   * turning the product around, not by moving the camera, so both sides get the same studio
   * lighting and a finish reads as the same colour front and back.
   */
  function setView(side = "front") {
    if (!product) return;
    product.group.rotation.y = side === "back" ? Math.PI : 0;
    product.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(product.group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const dist = Math.max(size.y * 1.05, Math.max(size.x, size.z) * 1.4) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const dir = new THREE.Vector3(0, 0.08, 1);
    camera.position.copy(center).addScaledVector(dir.normalize(), dist);
    camera.lookAt(center);
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }

  /**
   * Fit camera distance to the product so a mug and a tall tumbler both fill the frame.
   * `fit` > 1 leaves room for HUD panels; `lift` raises the product above the bottom shelf.
   */
  function frame() {
    if (!product) return;
    product.group.rotation.y = 0;
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
    const aspect = product.circumference / Math.max(product.height, 1e-3);
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
  async function graphicMaterialFor(graphic, body, data) {
    const { sampled, override } = renderDataFor(data.renderData, data.overrides, materialSlug, body?.slug);
    const finishSpec = body ? finishRenderSpec(body, materialSlug, sampled, override) : null;
    return createGraphicMaterial(graphicRenderSpec(graphic, finishSpec));
  }

  /**
   * Apply finishes; logo === null hides the logo patch (it follows the body); graphic === null
   * hides the graphic application badge.
   */
  async function setFinishes({ body, logo = null, graphic = null }) {
    if (!product) return;
    const token = ++finishToken;
    const data = await loadRenderData();
    const [bodyMat, logoMat, graphicMat] = await Promise.all([
      body ? materialFor(body, data) : null,
      logo ? materialFor(logo, data) : null,
      graphic ? graphicMaterialFor(graphic, body, data).catch((err) => (console.warn(err.message), null)) : null,
    ]);
    if (token !== finishToken || !product) {
      disposeFinishMaterial(bodyMat);
      disposeFinishMaterial(logoMat);
      disposeFinishMaterial(graphicMat);
      return;
    }
    if (bodyMat) assign("body", bodyMat);
    product.zones.logo[0].visible = Boolean(logoMat);
    if (logoMat) assign("logo", logoMat);
    product.zones.graphic[0].visible = Boolean(graphicMat);
    if (graphicMat) assign("graphic", graphicMat);
  }

  /**
   * Render the lighting and surface-coordinate passes the 2D view uses to paint a finish onto a
   * flat product image (deferred shading). Values are linear floats, one RGBA quad per pixel:
   *   uv      u, v (surfaceUV), finishable mask, 0
   *   light   diffuse (white matte), gloss reflection, satin reflection, 0
   *   metal   mirror metal, brushed metal, facing ratio (N·V), 0
   * Call after setView(); the passes match the current camera and canvas size.
   */
  function capturePasses() {
    if (!product) return null;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.FloatType });
    const finishable = new Set([...product.zones.body]);
    const meshes = [];
    product.group.traverse((o) => o.isMesh && o.visible && meshes.push(o));
    const original = new Map(meshes.map((m) => [m, m.material]));
    const shadows = keyLight.castShadow;
    keyLight.castShadow = false;

    const uvMaterial = (handle, mask) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHeight: { value: product.height },
          uCirc: { value: product.circumference },
          uHandle: { value: handle ? 1 : 0 },
          uMask: { value: mask },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float uHeight; uniform float uCirc; uniform float uHandle; uniform float uMask;
          varying vec3 vPos;
          void main() {
            float v = vPos.y / uHeight;
            float u;
            if (uHandle > 0.5) u = 0.75 + (vPos.z + vPos.x) / uCirc;
            else { u = (atan(vPos.x, vPos.z) - 3.14159265) / 6.28318531; u = u - floor(u); }
            gl_FragColor = vec4(u, v, uMask, 1.0);
          }`,
      });
    const facingMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vV;
        void main() { gl_FragColor = vec4(abs(dot(normalize(vN), normalize(vV))), 0.0, 0.0, 1.0); }`,
    });
    const lit = {
      diffuse: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }),
      gloss: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.06, metalness: 0 }),
      satin: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.42, metalness: 0 }),
      mirror: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 1 }),
      brushed: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 1 }),
    };
    const uvBody = uvMaterial(false, 1);
    const uvHandle = uvMaterial(true, 1);
    const uvFixed = uvMaterial(false, 0);
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);

    const read = (pick) => {
      for (const m of meshes) m.material = pick(m);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      const out = new Float32Array(size.x * size.y * 4);
      renderer.readRenderTargetPixels(target, 0, 0, size.x, size.y, out);
      return out;
    };
    const fixedOr = (mat) => (m) => (finishable.has(m) ? mat : uvFixed);
    const uv = read((m) => (finishable.has(m) ? (m.name === "handle" ? uvHandle : uvBody) : uvFixed));
    const passes = {};
    for (const key of Object.keys(lit)) passes[key] = read(fixedOr(lit[key]));
    const facing = read(fixedOr(facingMaterial));

    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevAlpha);
    keyLight.castShadow = shadows;
    for (const [m, mat] of original) m.material = mat;
    for (const mat of [...Object.values(lit), uvBody, uvHandle, uvFixed, facingMaterial]) mat.dispose();
    target.dispose();

    // readRenderTargetPixels rows run bottom-up; flip to image order while packing.
    const n = size.x * size.y;
    const pack = () => new Float32Array(n * 4);
    const out = { width: size.x, height: size.y, uv: pack(), light: pack(), metal: pack() };
    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const src = ((size.y - 1 - y) * size.x + x) * 4;
        const dst = (y * size.x + x) * 4;
        out.uv.set([uv[src], uv[src + 1], uv[src + 2] * uv[src + 3], uv[src + 3]], dst);
        out.light.set([passes.diffuse[src], passes.gloss[src], passes.satin[src], 0], dst);
        out.metal.set([passes.mirror[src], passes.brushed[src], facing[src], 0], dst);
      }
    }
    return out;
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
    setView,
    capturePasses,
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
