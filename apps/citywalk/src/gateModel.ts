import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clipHalfPlane } from './geo';
import type { Landmark } from './types';

// The creator's model of Tha Phae Gate (public/models/thaphae_gate.glb). We only move, turn and
// scale it to fit the map; its shapes and materials are kept as they are.

/** gap between the gate pillars when the model does not tell us, in model metres */
const DEFAULT_OPENING = 4.0;
/** names of the model parts the walker should bump into */
const SOLID_PARTS = /^(Main_Pillar|Pillar_Base1|Wall_Body|Wall_Base)_/;

export interface PlacedModel {
  object: THREE.Object3D;
  /** footprints of the solid parts, in map metres */
  solids: number[][];
  /** the map's own wall pieces, cut back where the model now stands */
  forts: number[][];
  scale: number;
}

/**
 * Load the model and draw it with far fewer draw calls: parts that share a texture are merged into
 * one mesh, with each part's texture tiling baked into its UVs. It looks the same, only lighter.
 */
export async function loadModel(bytes: ArrayBuffer): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const groups = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[] }>();
  // a box with six materials arrives as a group of six meshes; keep the group once
  const solids = new Set<THREE.Object3D>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mat = o.material as THREE.MeshStandardMaterial;
    let geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    const map = mat.map;
    let key = `${mat.type}:${mat.color?.getHexString()}`;
    if (map && map.rotation === 0) {
      key = `tex:${map.source.uuid}`;
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          uv.getX(i) * map.repeat.x + map.offset.x,
          uv.getY(i) * map.repeat.y + map.offset.y,
        );
    } else if (map) {
      key = `own:${mat.uuid}`;
    }
    for (const name of Object.keys(geo.attributes))
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    let g = groups.get(key);
    if (!g) {
      const material = mat.clone();
      for (const slot of ['map', 'bumpMap'] as const) {
        const t = material[slot];
        if (t && key.startsWith('tex:')) {
          const tiled = t.clone();
          tiled.repeat.set(1, 1);
          tiled.offset.set(0, 0);
          tiled.wrapS = tiled.wrapT = THREE.RepeatWrapping;
          tiled.needsUpdate = true;
          material[slot] = tiled;
        }
      }
      g = { material, parts: [] };
      groups.set(key, g);
    }
    g.parts.push(geo);
    if (SOLID_PARTS.test(o.name)) solids.add(o);
    else if (o.parent && SOLID_PARTS.test(o.parent.name)) solids.add(o.parent);
  });

  const out = new THREE.Group();
  out.name = 'ThaPhae_Gate_Model';
  for (const { material, parts } of groups.values()) {
    const merged = mergeGeometries(parts);
    if (merged) out.add(new THREE.Mesh(merged, material));
  }
  // keep the solid parts' boxes (in model space) for collision
  out.userData.solidBoxes = [...solids].map((m) => {
    const box = new THREE.Box3().setFromObject(m);
    return [box.min.x, box.min.z, box.max.x, box.max.z];
  });
  // the opening is the space between the inner faces of the two main pillars
  const left = root.getObjectByName('Main_Pillar_Left');
  const right = root.getObjectByName('Main_Pillar_Right');
  out.userData.opening =
    left && right
      ? new THREE.Box3().setFromObject(right).min.x - new THREE.Box3().setFromObject(left).max.x
      : DEFAULT_OPENING;
  return out;
}

/** Long axis of a set of wall pieces (principal direction of their corners). */
function wallAxis(polys: number[][]): { cx: number; cz: number; ax: number; az: number } {
  const pts: [number, number][] = [];
  for (const p of polys) for (let i = 0; i < p.length; i += 2) pts.push([p[i]!, p[i + 1]!]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0,
    szz = 0,
    sxz = 0;
  for (const [x, z] of pts) {
    sxx += (x - cx) ** 2;
    szz += (z - cz) ** 2;
    sxz += (x - cx) * (z - cz);
  }
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  return { cx, cz, ax: Math.cos(angle), az: Math.sin(angle) };
}

/**
 * The frame the gate model is built in: origin in the middle of the gap in the gate's wall, on the
 * wall's centre line; +X along the wall, +Z out of the city (away from the map origin).
 */
export interface GateFrame {
  px: number;
  pz: number;
  ax: number;
  az: number;
  ox: number;
  oz: number;
  /** width of the gap between the map's wall pieces, in metres */
  gap: number;
  /** the map's wall pieces that belong to this gate */
  near: number[][];
}

export function gateFrame(gate: Landmark, forts: number[][]): GateFrame | null {
  const near = forts.filter((f) => {
    for (let i = 0; i < f.length; i += 2)
      if (Math.hypot(f[i]! - gate.x, f[i + 1]! - gate.z) < 40) return true;
    return false;
  });
  if (near.length === 0) return null;
  const { cx, cz } = wallAxis(near);
  let { ax, az } = wallAxis(near);
  let ox = -az,
    oz = ax;
  if (ox * gate.x + oz * gate.z < 0) {
    ax = -ax;
    az = -az;
    ox = -ox;
    oz = -oz;
  }
  // centre of the gap: where the wall line passes the gate, between the nearest wall ends
  const t = (x: number, z: number) => (x - cx) * ax + (z - cz) * az;
  const tGate = t(gate.x, gate.z);
  let before = -Infinity,
    after = Infinity;
  for (const f of near)
    for (let i = 0; i < f.length; i += 2) {
      const v = t(f[i]!, f[i + 1]!);
      if (v <= tGate) before = Math.max(before, v);
      else after = Math.min(after, v);
    }
  const known = Number.isFinite(before) && Number.isFinite(after);
  const tMid = known ? (before + after) / 2 : tGate;
  return {
    px: cx + ax * tMid,
    pz: cz + az * tMid,
    ax,
    az,
    ox,
    oz,
    gap: known ? after - before : 0,
    near,
  };
}

/** Map position of a point given in the gate frame. */
export function frameToMap(f: GateFrame, x: number, z: number): [number, number] {
  return [f.px + f.ax * x + f.ox * z, f.pz + f.az * x + f.oz * z];
}

/** Gate-frame position of a map point. */
export function mapToFrame(f: GateFrame, x: number, z: number): [number, number] {
  return [(x - f.px) * f.ax + (z - f.pz) * f.az, (x - f.px) * f.ox + (z - f.pz) * f.oz];
}

/**
 * Stand the model in the gap of the gate's wall, along the wall, with its front (+Z, the side with
 * the name plaque) facing out of the city. The scale makes the model's opening as wide as the gap
 * in the map's wall. Map wall pieces under the model are cut away so the two don't overlap.
 */
export function placeModel(model: THREE.Group, frame: GateFrame, forts: number[][]): PlacedModel {
  const { px, pz, ax, az, ox, oz, near } = frame;
  const opening = (model.userData.opening as number | undefined) ?? DEFAULT_OPENING;
  const gap = frame.gap || opening;
  // a model built to the map's size stays at its true size; others are scaled to fit the gap
  const fit = gap / opening;
  const scale = Math.abs(fit - 1) < 0.05 ? 1 : Math.min(1.3, Math.max(0.8, fit));
  const local = new THREE.Box3().setFromObject(model);
  // how far the model reaches along the wall on each side, in map metres
  const reach = { pos: local.max.x * scale, neg: -local.min.x * scale };

  const object = new THREE.Group();
  object.add(model);
  object.position.set(px, 0, pz);
  // local +X along the wall, local +Z outwards
  object.rotation.y = Math.atan2(ox, oz);
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  const solids = (model.userData.solidBoxes as number[][]).map(([x0, z0, x1, z1]) => {
    const pts: number[] = [];
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ] as const) {
      const v = new THREE.Vector3(x, 0, z).applyMatrix4(object.matrixWorld);
      pts.push(v.x, v.z);
    }
    return pts;
  });

  const along = (x: number, z: number) => (x - px) * ax + (z - pz) * az;
  const trimmed: number[][] = [];
  for (const f of forts) {
    if (!near.includes(f)) {
      trimmed.push(f);
      continue;
    }
    let sum = 0;
    for (let i = 0; i < f.length; i += 2) sum += along(f[i]!, f[i + 1]!);
    const side = sum >= 0 ? 1 : -1;
    // keep the part of the wall piece beyond the model's end on its own side
    const half = side > 0 ? reach.pos : reach.neg;
    const cut = clipHalfPlane(f, side * ax, side * az, side * (ax * px + az * pz) + half);
    if (cut.length) trimmed.push(cut);
  }
  return { object, solids, forts: trimmed, scale };
}
