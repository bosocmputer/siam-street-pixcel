import * as THREE from 'three';
import { counterClockwise, ribbon } from './geo';
import { BUILDING_HISTORIC, BUILDING_TEMPLE, type WorldData } from './types';

// Each flat layer sits a little higher than the one below and also gets a depth offset, so roads,
// water and lawns don't flicker into each other when seen from far away.
const LAYER = {
  green: 0.05,
  temple: 0.08,
  water: 0.11,
  road: [0.23, 0.2, 0.17, 0.14],
  bridge: 0.3,
};

const COLOR = {
  ground: 0xd9d2c0,
  green: 0x9cc58a,
  temple: 0xe9d9a8,
  water: 0x4f8fbf,
  road: [0x6d7178, 0x83868b, 0x96989b, 0xbdb3a1],
  bridge: 0x9a8f80,
  brick: 0xa9573c,
  wall: [0xefe6d6, 0xe6dccb, 0xf2ece2, 0xd9cfbf, 0xe8e2d8],
  roof: [0x8d867f, 0x9c6b52, 0x6f7479, 0xa3796a, 0x7f8a8c],
  templeWall: 0xf6f1e6,
  templeRoof: 0xc2862f,
};

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  private c = new THREE.Color();

  private push(x: number, y: number, z: number, n: THREE.Vector3, color: number): void {
    this.c.setHex(color);
    this.pos.push(x, y, z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(this.c.r, this.c.g, this.c.b);
  }

  /** A triangle, flipped if needed so it faces `want` (up for floors and roofs). */
  tri(a: number[], b: number[], c: number[], color: number, want = new THREE.Vector3(0, 1, 0)) {
    const ab = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
    const ac = new THREE.Vector3(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!);
    const n = ab.cross(ac).normalize();
    if (n.dot(want) < 0) {
      [b, c] = [c, b];
      n.negate();
    }
    this.push(a[0]!, a[1]!, a[2]!, n, color);
    this.push(b[0]!, b[1]!, b[2]!, n, color);
    this.push(c[0]!, c[1]!, c[2]!, n, color);
  }

  /** A flat polygon at height y. */
  area(poly: readonly number[], y: number, color: number): void {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < poly.length; i += 2) pts.push(new THREE.Vector2(poly[i]!, poly[i + 1]!));
    if (pts.length < 3) return;
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts, [])) {
      const a = pts[i!]!,
        b = pts[j!]!,
        c = pts[k!]!;
      this.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], color);
    }
  }

  /** Walls and a flat roof for a footprint. */
  prism(footprint: readonly number[], base: number, top: number, wall: number, roof: number): void {
    const poly = counterClockwise(footprint);
    const n = poly.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = poly[i * 2]!,
        az = poly[i * 2 + 1]!,
        bx = poly[j * 2]!,
        bz = poly[j * 2 + 1]!;
      const out = new THREE.Vector3(bz - az, 0, -(bx - ax)).normalize();
      this.tri([ax, base, az], [bx, base, bz], [bx, top, bz], wall, out);
      this.tri([ax, base, az], [bx, top, bz], [ax, top, az], wall, out);
    }
    this.area(poly, top, roof);
  }

  mesh(material: THREE.Material): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

function flatMaterial(offset: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -offset,
    polygonOffsetUnits: -offset * 4,
  });
}

/** Two brick towers with a gap, standing across the line from the gate to the city centre. */
export function gateTowers(x: number, z: number): number[][] {
  const alongZ = Math.abs(x) > Math.abs(z); // gates on the east and west sides face east-west
  const half = 3.5,
    len = 8,
    depth = 3;
  return [-1, 1].map((side) => {
    const lo = Math.min(side * half, side * (half + len));
    const hi = Math.max(side * half, side * (half + len));
    return alongZ
      ? [x - depth / 2, z + lo, x + depth / 2, z + lo, x + depth / 2, z + hi, x - depth / 2, z + hi]
      : [
          x + lo,
          z - depth / 2,
          x + hi,
          z - depth / 2,
          x + hi,
          z + depth / 2,
          x + lo,
          z + depth / 2,
        ];
  });
}

export function buildWorld(world: WorldData): THREE.Group {
  const root = new THREE.Group();
  const [x0, z0, x1, z1] = world.bounds;
  const pad = 400;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0 + pad * 2, z1 - z0 + pad * 2),
    new THREE.MeshLambertMaterial({ color: COLOR.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  root.add(ground);

  const layers: [number[][], number, number, number][] = [
    [world.green, LAYER.green, COLOR.green, 1],
    [world.temples, LAYER.temple, COLOR.temple, 2],
    [world.water, LAYER.water, COLOR.water, 3],
  ];
  for (const [polys, y, color, off] of layers) {
    const b = new Builder();
    for (const p of polys) b.area(p, y, color);
    root.add(b.mesh(flatMaterial(off)));
  }

  const roads = new Builder();
  for (const r of world.roads) {
    const cls = r[1]!;
    const bridge = r[2] === 1;
    const y = bridge ? LAYER.bridge : LAYER.road[cls]!;
    const color = bridge ? COLOR.bridge : COLOR.road[cls]!;
    const tris = ribbon(r.slice(3), r[0]!);
    for (let i = 0; i < tris.length; i += 6)
      roads.tri(
        [tris[i]!, y, tris[i + 1]!],
        [tris[i + 2]!, y, tris[i + 3]!],
        [tris[i + 4]!, y, tris[i + 5]!],
        color,
      );
  }
  root.add(roads.mesh(flatMaterial(5)));

  // dashed centre lines on the bigger roads, so you can see yourself moving along a street
  const marks = new Builder();
  for (const r of world.roads) {
    if (r[1]! > 1 || r[2] === 1 || r[0]! < 6) continue;
    const y = LAYER.road[r[1]!]! + 0.03;
    const line = r.slice(3);
    let carry = 0;
    for (let i = 0; i + 3 < line.length; i += 2) {
      const ax = line[i]!,
        az = line[i + 1]!,
        bx = line[i + 2]!,
        bz = line[i + 3]!;
      const len = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / len,
        uz = (bz - az) / len;
      for (let t = carry; t + 3 <= len; t += 8) {
        const tris = ribbon([ax + ux * t, az + uz * t, ax + ux * (t + 3), az + uz * (t + 3)], 0.25);
        for (let k = 0; k < tris.length; k += 6)
          marks.tri(
            [tris[k]!, y, tris[k + 1]!],
            [tris[k + 2]!, y, tris[k + 3]!],
            [tris[k + 4]!, y, tris[k + 5]!],
            0xf4f1e8,
          );
        carry = t + 8 - len;
      }
      if (len < 3) carry = Math.max(0, carry - len);
    }
  }
  root.add(marks.mesh(flatMaterial(6)));

  const solid = new Builder();
  world.buildings.forEach((bd, i) => {
    const h = bd[0]!;
    const kind = bd[1]!;
    const fp = bd.slice(2);
    const k = hash(i);
    if (kind === BUILDING_TEMPLE) solid.prism(fp, 0, h, COLOR.templeWall, COLOR.templeRoof);
    else if (kind === BUILDING_HISTORIC) solid.prism(fp, 0, h, COLOR.brick, 0x8e4630);
    else
      solid.prism(
        fp,
        0,
        h,
        COLOR.wall[k % COLOR.wall.length]!,
        COLOR.roof[(k >>> 8) % COLOR.roof.length]!,
      );
  });
  for (const f of world.forts) solid.prism(f, 0, 4.5, COLOR.brick, 0x8e4630);
  for (const w of world.walls) {
    const tris = ribbon(w, 2.5);
    for (let i = 0; i + 5 < tris.length; i += 6)
      solid.prism(
        [tris[i]!, tris[i + 1]!, tris[i + 2]!, tris[i + 3]!, tris[i + 4]!, tris[i + 5]!],
        0,
        4.5,
        COLOR.brick,
        0x8e4630,
      );
  }
  for (const m of world.landmarks)
    if (m.kind === 'gate')
      for (const fp of gateTowers(m.x, m.z)) solid.prism(fp, 0, 6.5, COLOR.brick, 0x8e4630);
  root.add(solid.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));

  return root;
}
