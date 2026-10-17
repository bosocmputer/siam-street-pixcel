import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { frameToMap, mapToFrame, type GateFrame } from './gateModel';
import { openStretch, plazaOutline, type RoadPiece } from './plazaShape';
import type { WorldData } from './types';

// The paved square in front of a gate, built from the map: it runs along the wall between the two
// ends of the moat and reaches out to the edge of the road, with a kerb along that edge, a strip of
// pavement between wall and water on each side, and a zebra crossing on the road in front.

/** outer face of the wall in the gate frame (the gate model's pillars reach to here) */
const FACE = 1.9;
const PLAZA_Y = 0.04;
const KERB = { width: 0.3, height: 0.12 };
const WALKWAY = { depth: 2.1, length: 20 };
/** paving pattern repeats every TILE metres */
const TILE = 4;

export interface Plaza {
  object: THREE.Group;
  /** outline in map metres, for the minimap */
  outline: number[];
  area: number;
  span: [number, number];
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Running-bond pavers of grey concrete and sandstone, with a brick band round each tile. Seamless. */
function pavingTexture(): THREE.CanvasTexture {
  const px = 512; // one tile of TILE metres
  const m = px / TILE;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7b756d';
  g.fillRect(0, 0, px, px);
  const pw = 0.5 * m,
    ph = 0.25 * m;
  let n = 0;
  for (let row = 0; row * ph < px; row++)
    for (let col = -1; col * pw < px; col++) {
      const x = col * pw + (row % 2 ? pw / 2 : 0);
      const r = hash(n++);
      const sand = r > 0.62;
      const shade = Math.round((hash(n++) - 0.5) * 16);
      const [cr, cg, cb] = sand
        ? [180 + shade, 147 + shade, 118 + shade]
        : [156 + shade, 150 + shade, 143 + shade];
      g.fillStyle = `rgb(${cr},${cg},${cb})`;
      g.fillRect(x + 1.5, row * ph + 1.5, pw - 3, ph - 3);
    }
  // a soft brick band along the edge of every tile, so the square reads as laid in panels
  const band = 0.2 * m;
  g.fillStyle = '#9a6650';
  g.fillRect(0, 0, px, band);
  g.fillRect(0, 0, band, px);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let k = 0; k < px; k += 0.25 * m) {
    g.fillRect(k, 0, 1.5, band);
    g.fillRect(0, k, band, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A flat polygon (gate frame) at height y, with UVs in metres / TILE so the paving lines up. */
function flat(poly: number[], frame: GateFrame, y: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < poly.length; i += 2) pts.push(new THREE.Vector2(poly[i]!, poly[i + 1]!));
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  for (const tri of THREE.ShapeUtils.triangulateShape(pts, [])) {
    const corners = tri.map((k) => pts[k]!);
    // keep every triangle facing up: in map space z grows southwards, so check the winding there
    const m = corners.map((p) => frameToMap(frame, p.x, p.y));
    const cross =
      (m[1]![0] - m[0]![0]) * (m[2]![1] - m[0]![1]) - (m[1]![1] - m[0]![1]) * (m[2]![0] - m[0]![0]);
    const order = cross < 0 ? [0, 1, 2] : [0, 2, 1];
    for (const k of order) {
      pos.push(m[k]![0], y, m[k]![1]);
      uv.push(corners[k]!.x / TILE, corners[k]!.y / TILE);
      nor.push(0, 1, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/** A low box laid along a line from a to b (gate frame), e.g. a kerb. */
function bar(
  frame: GateFrame,
  a: [number, number],
  b: [number, number],
  width: number,
  height: number,
  y = 0,
): THREE.BufferGeometry | null {
  const [ax, az] = frameToMap(frame, a[0], a[1]);
  const [bx, bz] = frameToMap(frame, b[0], b[1]);
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.05) return null;
  const geo = new THREE.BoxGeometry(len, height, width);
  geo.deleteAttribute('uv');
  geo.rotateY(Math.atan2(-(bz - az), bx - ax));
  geo.translate((ax + bx) / 2, y + height / 2, (az + bz) / 2);
  return geo;
}

function mesh(parts: (THREE.BufferGeometry | null)[], material: THREE.Material): THREE.Mesh | null {
  const list = parts.filter((p): p is THREE.BufferGeometry => p !== null);
  if (!list.length) return null;
  const merged = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
  return merged ? new THREE.Mesh(merged, material) : null;
}

export function buildPlaza(world: WorldData, frame: GateFrame): Plaza | null {
  const toFrame = (poly: readonly number[]) => {
    const out: number[] = [];
    for (let i = 0; i < poly.length; i += 2) out.push(...mapToFrame(frame, poly[i]!, poly[i + 1]!));
    return out;
  };
  // the square runs between the two ends of the moat, measured a little out from the wall
  const [x0, x1] = openStretch(world.water.map(toFrame), FACE + 4, 300);
  if (x1 - x0 < 10) return null;

  const roads: RoadPiece[] = [];
  for (const r of world.roads) {
    if (r[1]! > 1 || r[2] === 1) continue; // main and local roads, not paths or bridges
    const line = toFrame(r.slice(3));
    for (let i = 0; i + 3 < line.length; i += 2)
      roads.push({
        x0: line[i]!,
        z0: line[i + 1]!,
        x1: line[i + 2]!,
        z1: line[i + 3]!,
        half: r[0]! / 2,
      });
  }
  const outline = plazaOutline(roads, {
    x0,
    x1,
    zFace: FACE,
    minDepth: 6,
    maxDepth: 60,
    step: 2,
    margin: 0.5,
  });

  const group = new THREE.Group();
  group.name = 'ThaPhae_Plaza';
  const paving = new THREE.MeshLambertMaterial({
    map: pavingTexture(),
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  const floor = new THREE.Mesh(flat(outline, frame, PLAZA_Y), paving);
  floor.name = 'Plaza_Floor';
  group.add(floor);

  // kerb along the road edge and down both ends of the square
  const edge: [number, number][] = [];
  for (let i = 4; i < outline.length; i += 2) edge.push([outline[i]!, outline[i + 1]!]);
  const kerbParts: (THREE.BufferGeometry | null)[] = [];
  for (let i = 0; i + 1 < edge.length; i++)
    kerbParts.push(bar(frame, edge[i]!, edge[i + 1]!, KERB.width, KERB.height));
  kerbParts.push(bar(frame, [x1, FACE], edge[0]!, KERB.width, KERB.height));
  kerbParts.push(bar(frame, [x0, FACE], edge[edge.length - 1]!, KERB.width, KERB.height));
  // pavement between wall and water beyond each end, with a kerb on the water side
  const walk = (from: number, to: number) => {
    const z1 = FACE + WALKWAY.depth;
    kerbParts.push(bar(frame, [from, z1], [to, z1], KERB.width, KERB.height));
    return [from, FACE, to, FACE, to, z1, from, z1];
  };
  const walkways = [walk(x1, x1 + WALKWAY.length), walk(x0 - WALKWAY.length, x0)];
  const kerb = mesh(kerbParts, new THREE.MeshLambertMaterial({ color: 0xc9c3b8 }));
  if (kerb) {
    kerb.name = 'Plaza_Kerb';
    group.add(kerb);
  }
  const walkMesh = mesh(
    walkways.map((w) => flat(w, frame, PLAZA_Y)),
    new THREE.MeshLambertMaterial({
      color: 0xbdb6aa,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    }),
  );
  if (walkMesh) {
    walkMesh.name = 'Plaza_Walkways';
    group.add(walkMesh);
  }

  // zebra crossing on the road straight out from the gate
  let best: RoadPiece | null = null;
  let bestZ = Infinity;
  for (const r of roads) {
    if (r.x0 === r.x1 || (r.x0 - 0) * (r.x1 - 0) > 0 || r.half < 4) continue;
    const z = r.z0 + ((r.z1 - r.z0) * (0 - r.x0)) / (r.x1 - r.x0);
    if (z > FACE && z < bestZ) {
      bestZ = z;
      best = r;
    }
  }
  if (best) {
    const len = Math.hypot(best.x1 - best.x0, best.z1 - best.z0);
    const dx = (best.x1 - best.x0) / len,
      dz = (best.z1 - best.z0) / len;
    const nx = -dz,
      nz = dx;
    const stripes: (THREE.BufferGeometry | null)[] = [];
    for (let s = -best.half + 0.5; s <= best.half - 0.5; s += 1) {
      const cx = nx * s,
        cz = bestZ + nz * s;
      stripes.push(
        bar(frame, [cx - dx * 1.5, cz - dz * 1.5], [cx + dx * 1.5, cz + dz * 1.5], 0.5, 0.01, 0.28),
      );
    }
    const zebra = mesh(stripes, new THREE.MeshLambertMaterial({ color: 0xf2efe6 }));
    if (zebra) {
      zebra.name = 'Plaza_Crossing';
      group.add(zebra);
    }
  }

  const mapOutline: number[] = [];
  for (let i = 0; i < outline.length; i += 2)
    mapOutline.push(...frameToMap(frame, outline[i]!, outline[i + 1]!));
  let area = 0;
  for (let i = 0; i < outline.length; i += 2) {
    const j = (i + 2) % outline.length;
    area += outline[i]! * outline[j + 1]! - outline[j]! * outline[i + 1]!;
  }
  return { object: group, outline: mapOutline, area: Math.abs(area) / 2, span: [x0, x1] };
}
