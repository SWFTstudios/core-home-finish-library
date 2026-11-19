/**
 * Hero product per material, built in code from side profiles (no CAD / GLB yet).
 *
 * Each body is a lathe: a half-section profile in millimetres (radius, height) spun around Y.
 * Profiles were traced from the Figma product images (public/assets/<material>/front.png on the
 * 2d-version branch) at typical sizes; PROFILES live in product-profiles.js (shared with 2D).
 *
 * Mesh names double as zones (see docs/13-3d-preview-pipeline.md, Stage 3):
 *   body   — takes the selected finish (mug handle included)
 *   logo   — front patch on the body; takes the logo finish when one is chosen
 *   lid, straw, liner — fixed parts, not finishable
 */
import * as THREE from "three";
import { PROFILES } from "./product-profiles.js";

const MM = 0.01;
const SEGMENTS = 128;
/** Body seam faces away from the default camera. */
const SEAM_PHI = Math.PI;
/** Logo patch centre, roughly toward the default camera position. */
const LOGO_PHI = 0.6;
const LOGO_SPAN = 1.2;

const v2 = ([r, y]) => new THREE.Vector2(r * MM, y * MM);

/** Radius of the outer profile at height y (linear between profile points). */
function radiusAt(outer, y) {
  for (let i = 1; i < outer.length; i++) {
    const [r0, y0] = outer[i - 1];
    const [r1, y1] = outer[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(y1 - y0, 1e-6);
  }
  return outer[outer.length - 1][0];
}

/** Closed vessel section: base centre → outer wall → lip → inner wall → inner floor centre. */
function vesselSection(outer, wall, innerBottom) {
  const top = outer[outer.length - 1];
  const inner = outer
    .filter(([, y]) => y > innerBottom)
    .map(([r, y]) => [Math.max(r - wall, 1), y])
    .reverse();
  const innerFloorR = Math.max(radiusAt(outer, innerBottom) - wall, 1);
  return [
    [0, 0],
    ...outer,
    [top[0] - wall / 2, top[1] + 0.6],
    ...inner,
    [innerFloorR, innerBottom],
    [0, innerBottom],
  ];
}

/**
 * Shared surface coordinates (3D materials and the 2D shell passes use the same rule):
 *   u = angle around the Y axis, 0 at the seam (back of the product), 1 after a full turn
 *   v = height, 0 at the base and 1 at the lip
 * The handle sits near u = 0.75; it is mapped by a side projection measured in body
 * circumferences so a pattern keeps the same scale on the handle as on the body.
 */
export function surfaceUV(x, y, z, { height, circumference, handle = false }) {
  const v = y / Math.max(height, 1e-6);
  if (handle) return [0.75 + (z + x) / Math.max(circumference, 1e-6), v];
  const phi = Math.atan2(x, z) - SEAM_PHI;
  const u = phi / (Math.PI * 2);
  return [u - Math.floor(u), v];
}

/** Lathe UVs: u around the product, v = height (0 at base, 1 at lip) so gradients follow the body. */
function heightUVs(geometry, minY, maxY) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setY(i, (pos.getY(i) - minY) / Math.max(maxY - minY, 1e-6));
  }
  uv.needsUpdate = true;
}

function lathe(section, { phiStart = SEAM_PHI, phiLength = Math.PI * 2, segments = SEGMENTS } = {}) {
  const geometry = new THREE.LatheGeometry(section.map(v2), segments, phiStart, phiLength);
  geometry.computeVertexNormals();
  return geometry;
}

function lidGeometry({ radius, height, top }) {
  const section = [
    [0, 0],
    [radius - 1.5, 0],
    [radius, 1.5],
    [radius, height - 3],
    [radius - 2, height],
    [top, height],
    [top - 1, height + 1.2],
    [0, height + 1.6],
  ];
  return lathe(section, { segments: 96 });
}

function logoGeometry(profile) {
  const height = profile.outer[profile.outer.length - 1][1];
  const [a, b] = profile.logoBand;
  const steps = 16;
  const section = [];
  for (let i = 0; i <= steps; i++) {
    const y = height * (a + ((b - a) * i) / steps);
    section.push([radiusAt(profile.outer, y) + 0.35, y]);
  }
  const geometry = lathe(section, { phiStart: LOGO_PHI - LOGO_SPAN / 2, phiLength: LOGO_SPAN, segments: 48 });
  // Patch-local UVs (0–1 both ways) so a future decal maps straight on.
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const y0 = height * a * MM;
  const y1 = height * b * MM;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0));
  uv.needsUpdate = true;
  return geometry;
}

const LID_MATERIAL = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xe4e7eb, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.2 });
const STRAW_MATERIAL = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xf3f5f7, roughness: 0.18, transmission: 0.55, thickness: 0.02 });
const LINER_MATERIAL = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, roughness: 0.08, transmission: 0.9, thickness: 0.02, ior: 1.49 });

function mesh(geometry, material, name) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * @param {string} materialSlug
 * @returns {{ group: THREE.Group, zones: { body: THREE.Mesh[], logo: THREE.Mesh[] }, height: number, label: string }}
 */
export function buildProduct(materialSlug) {
  const profile = PROFILES[materialSlug] ?? PROFILES.stainless_steel;
  const group = new THREE.Group();
  group.name = `product-${materialSlug}`;
  const height = profile.outer[profile.outer.length - 1][1];
  const placeholder = () => new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0 });

  const bodyGeometry = lathe(vesselSection(profile.outer, profile.wall, profile.innerBottom));
  heightUVs(bodyGeometry, 0, height * MM);
  const body = mesh(bodyGeometry, placeholder(), "body");
  group.add(body);
  const bodyZone = [body];

  if (profile.handle) {
    const { tube, path } = profile.handle;
    const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x * MM, y * MM, 0)));
    const handleGeometry = new THREE.TubeGeometry(curve, 64, tube * MM, 24, false);
    const circumference = 2 * Math.PI * Math.max(...profile.outer.map(([r]) => r)) * MM;
    const pos = handleGeometry.attributes.position;
    const uv = handleGeometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = surfaceUV(pos.getX(i), pos.getY(i), pos.getZ(i), { height: height * MM, circumference, handle: true });
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
    const handle = mesh(handleGeometry, body.material, "handle");
    group.add(handle);
    bodyZone.push(handle);
  }

  if (profile.liner) {
    const { gap, bottom } = profile.liner;
    const linerOuter = profile.outer
      .filter(([, y]) => y >= bottom)
      .map(([r, y]) => [Math.max(r - gap, 1), y]);
    linerOuter.unshift([Math.max(radiusAt(profile.outer, bottom) - gap - 2, 1), bottom]);
    const liner = mesh(lathe(vesselSection(linerOuter, 1.2, bottom + 2)), LINER_MATERIAL(), "liner");
    group.add(liner);
  }

  if (profile.lid) {
    const lid = mesh(lidGeometry(profile.lid), LID_MATERIAL(), "lid");
    lid.position.y = (height - 2) * MM;
    group.add(lid);
  }

  if (profile.straw) {
    const length = profile.straw.top - 30;
    const straw = mesh(
      new THREE.CylinderGeometry(profile.straw.radius * MM, profile.straw.radius * MM, length * MM, 24, 1, true),
      STRAW_MATERIAL(),
      "straw",
    );
    straw.position.y = (30 + length / 2) * MM;
    group.add(straw);
  }

  const logo = mesh(logoGeometry(profile), placeholder(), "logo");
  logo.visible = false;
  group.add(logo);

  const circumference = 2 * Math.PI * Math.max(...profile.outer.map(([r]) => r)) * MM;
  return {
    group,
    zones: { body: bodyZone, logo: [logo] },
    height: height * MM,
    circumference,
    label: profile.label,
  };
}
