// Flat 2D helpers for the map. Points are stored as flat arrays [x0, z0, x1, z1, ...] in metres,
// x to the east and z to the south, the same layout world.json uses.

export function signedArea(poly: readonly number[]): number {
  let a = 0;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += poly[i * 2]! * poly[j * 2 + 1]! - poly[j * 2]! * poly[i * 2 + 1]!;
  }
  return a / 2;
}

/** Same polygon with a positive signed area, so outward wall normals are (dz, -dx). */
export function counterClockwise(poly: readonly number[]): number[] {
  if (signedArea(poly) >= 0) return [...poly];
  const out: number[] = [];
  for (let i = poly.length - 2; i >= 0; i -= 2) out.push(poly[i]!, poly[i + 1]!);
  return out;
}

export function pointInPolygon(x: number, z: number, poly: readonly number[]): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2]!,
      zi = poly[i * 2 + 1]!;
    const xj = poly[j * 2]!,
      zj = poly[j * 2 + 1]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax,
    dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

export function bbox(poly: readonly number[]): [number, number, number, number] {
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    x0 = Math.min(x0, poly[i]!);
    x1 = Math.max(x1, poly[i]!);
    z0 = Math.min(z0, poly[i + 1]!);
    z1 = Math.max(z1, poly[i + 1]!);
  }
  return [x0, z0, x1, z1];
}

/**
 * A line of given width as triangles (flat [x, z] per vertex, 3 vertices per triangle). Each segment
 * is a rectangle stretched by half the width at both ends so the corners of a bent road are covered.
 */
export function ribbon(line: readonly number[], width: number): number[] {
  const out: number[] = [];
  const h = width / 2;
  for (let i = 0; i + 3 < line.length; i += 2) {
    const ax = line[i]!,
      az = line[i + 1]!,
      bx = line[i + 2]!,
      bz = line[i + 3]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) continue;
    const ux = (bx - ax) / len,
      uz = (bz - az) / len;
    const px = -uz * h,
      pz = ux * h;
    const sx = ax - ux * h,
      sz = az - uz * h,
      ex = bx + ux * h,
      ez = bz + uz * h;
    out.push(sx + px, sz + pz, ex + px, ez + pz, ex - px, ez - pz);
    out.push(sx + px, sz + pz, ex - px, ez - pz, sx - px, sz - pz);
  }
  return out;
}

/** Buckets items by the grid cells their bounding boxes touch, for quick lookups near a point. */
export class Grid {
  private cells = new Map<string, number[]>();
  constructor(private readonly size: number) {}

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  insert(id: number, box: readonly [number, number, number, number]): void {
    const [x0, z0, x1, z1] = box;
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++)
      for (let cz = Math.floor(z0 / this.size); cz <= Math.floor(z1 / this.size); cz++) {
        const k = this.key(cx, cz);
        const list = this.cells.get(k);
        if (list) list.push(id);
        else this.cells.set(k, [id]);
      }
  }

  at(x: number, z: number): readonly number[] {
    return this.cells.get(this.key(Math.floor(x / this.size), Math.floor(z / this.size))) ?? [];
  }
}
