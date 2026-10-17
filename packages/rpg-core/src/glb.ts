// Read the facts the rig check needs straight from a .glb file: node names, parents, where each
// node sits, whether anything is turned, size, triangles, materials. Only the JSON part is read,
// so this works anywhere (a test, a command line tool, the browser) without a 3D engine.

import type { FoundNode, ModelFacts, V3 } from './rig';

type M4 = number[]; // 4x4, column-major like glTF

interface GltfNode {
  name?: string;
  children?: number[];
  mesh?: number;
  skin?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}
interface Accessor {
  count: number;
  min?: number[];
  max?: number[];
}
interface Gltf {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: {
    primitives: { attributes: { POSITION?: number }; indices?: number; mode?: number }[];
  }[];
  accessors?: Accessor[];
  materials?: unknown[];
  animations?: unknown[];
  skins?: unknown[];
}

const I: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul(a: M4, b: M4): M4 {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return o;
}

function compose(t: number[], q: number[], s: number[]): M4 {
  const [x, y, z, w] = q as [number, number, number, number];
  const [sx, sy, sz] = s as [number, number, number];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    t[0]!,
    t[1]!,
    t[2]!,
    1,
  ];
}

const apply = (m: M4, p: V3): V3 => [
  m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
  m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
  m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
];

/** Does this matrix turn or stretch anything (more than a hair)? */
const turns = (m: M4): boolean =>
  [0, 1, 2, 4, 5, 6, 8, 9, 10].some((i) => Math.abs(m[i]! - I[i]!) > 1e-4);

export class GlbError extends Error {}

/** The JSON part of a .glb file. */
export function readGlbJson(bytes: Uint8Array): Gltf {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67)
    throw new GlbError('not a .glb file');
  if (view.getUint32(4, true) !== 2) throw new GlbError('only glTF 2.0 is supported');
  const len = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + len > bytes.byteLength)
    throw new GlbError('the .glb has no readable JSON part');
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len))) as Gltf;
}

export function glbFacts(bytes: Uint8Array): ModelFacts {
  const g = readGlbJson(bytes);
  const nodes = g.nodes ?? [];
  const roots = g.scenes?.[g.scene ?? 0]?.nodes ?? [];
  const found: FoundNode[] = [];
  let minY = Infinity,
    maxY = -Infinity,
    triangles = 0;
  const visit = (i: number, parent: string | null, world: M4, turned: boolean) => {
    const n = nodes[i];
    if (!n) return;
    const local =
      n.matrix ??
      compose(n.translation ?? [0, 0, 0], n.rotation ?? [0, 0, 0, 1], n.scale ?? [1, 1, 1]);
    const here = mul(world, local);
    const name = n.name ?? `node${i}`;
    const t = turned || turns(local);
    found.push({ name, parent, at: [here[12]!, here[13]!, here[14]!], turned: t });
    for (const p of n.mesh !== undefined ? (g.meshes?.[n.mesh]?.primitives ?? []) : []) {
      const pos =
        p.attributes.POSITION !== undefined ? g.accessors?.[p.attributes.POSITION] : undefined;
      const idx = p.indices !== undefined ? g.accessors?.[p.indices] : undefined;
      const count = idx?.count ?? pos?.count ?? 0;
      const mode = p.mode ?? 4;
      triangles +=
        mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
      if (pos?.min && pos.max)
        for (const cx of [pos.min[0]!, pos.max[0]!])
          for (const cy of [pos.min[1]!, pos.max[1]!])
            for (const cz of [pos.min[2]!, pos.max[2]!]) {
              const y = apply(here, [cx, cy, cz])[1];
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
    }
    for (const c of n.children ?? []) visit(c, name, here, t);
  };
  for (const r of roots) visit(r, null, I, false);
  return {
    nodes: found,
    minY: Number.isFinite(minY) ? minY : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0,
    triangles,
    materials: g.materials?.length ?? 0,
    fileKB: bytes.byteLength / 1024,
    animations: g.animations?.length ?? 0,
    skinned: (g.skins?.length ?? 0) > 0 || nodes.some((n) => n.skin !== undefined),
  };
}
