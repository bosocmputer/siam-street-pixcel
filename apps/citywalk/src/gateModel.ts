import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clipHalfPlane } from './geo';
import type { Landmark } from './types';

// The creator's model of Tha Phae Gate (public/models/thaphae_gate.glb). We only move, turn and
// scale it to fit the map; its shapes and materials are kept as they are.

/** gap between the two gate pillars in the model, in model metres */
const MODEL_OPENING = 4.0;
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
export async function loadModel(url: string): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
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
 * Stand the model in the gap of the gate's wall, along the wall, with its front (+Z, the side with
 * the name plaque) facing out of the city. The scale makes the model's opening as wide as the gap
 * in the map's wall. Map wall pieces under the model are cut away so the two don't overlap.
 */
export function placeModel(
  model: THREE.Group,
  gate: Landmark,
  forts: number[][],
): PlacedModel | null {
  const near = forts.filter((f) => {
    for (let i = 0; i < f.length; i += 2)
      if (Math.hypot(f[i]! - gate.x, f[i + 1]! - gate.z) < 40) return true;
    return false;
  });
  if (near.length === 0) return null;
  const { cx, cz } = wallAxis(near);
  let { ax, az } = wallAxis(near);
  // the model's +Z must point away from the city centre (the map origin)
  let ox = -az,
    oz = ax;
  if (ox * gate.x + oz * gate.z < 0) {
    ax = -ax;
    az = -az;
    ox = -ox;
    oz = -oz;
  }
  // centre of the gap: where the wall line passes the gate, between the nearest wall ends
  const t = (p: [number, number]) => (p[0] - cx) * ax + (p[1] - cz) * az;
  const tGate = t([gate.x, gate.z]);
  let before = -Infinity,
    after = Infinity;
  for (const f of near)
    for (let i = 0; i < f.length; i += 2) {
      const v = t([f[i]!, f[i + 1]!]);
      if (v <= tGate) before = Math.max(before, v);
      else after = Math.min(after, v);
    }
  const gap = Number.isFinite(before) && Number.isFinite(after) ? after - before : MODEL_OPENING;
  const tMid = Number.isFinite(before) && Number.isFinite(after) ? (before + after) / 2 : tGate;
  const scale = Math.min(1.3, Math.max(0.9, gap / MODEL_OPENING));
  // on the middle line of the wall, at the middle of the gap
  const px = cx + ax * tMid;
  const pz = cz + az * tMid;
  // half the model's length along the wall, in map metres (measured before it is moved)
  const local = new THREE.Box3().setFromObject(model);
  const half = Math.max(Math.abs(local.min.x), Math.abs(local.max.x)) * scale;

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
    const cut = clipHalfPlane(f, side * ax, side * az, side * (ax * px + az * pz) + half);
    if (cut.length) trimmed.push(cut);
  }
  return { object, solids, forts: trimmed, scale };
}
