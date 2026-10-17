import { Grid, bbox, distToSegment, pointInPolygon } from './geo';
import type { WorldData } from './types';

const CELL = 24;

/**
 * Keeps the walker out of buildings and the moat. Water can be crossed only where a road runs over
 * it (the bridges at the gates). All positions are map metres, before the city scale is applied.
 */
export class Collider {
  private solids: number[][] = [];
  private solidGrid = new Grid(CELL);
  private water: number[][] = [];
  private waterGrid = new Grid(CELL);
  /** road segments as [ax, az, bx, bz, halfWidth] */
  private segs: number[][] = [];
  private segGrid = new Grid(CELL);

  constructor(
    world: Pick<WorldData, 'buildings' | 'forts' | 'water' | 'roads'>,
    extraSolids: number[][] = [],
  ) {
    for (const b of world.buildings) this.addSolid(b.slice(2));
    for (const f of world.forts) this.addSolid(f);
    for (const s of extraSolids) this.addSolid(s);
    for (const w of world.water) {
      this.waterGrid.insert(this.water.length, bbox(w));
      this.water.push(w);
    }
    for (const r of world.roads) {
      const half = r[0]! / 2;
      for (let i = 3; i + 3 < r.length; i += 2) {
        const seg = [r[i]!, r[i + 1]!, r[i + 2]!, r[i + 3]!, half];
        const box = bbox(seg.slice(0, 4));
        this.segGrid.insert(this.segs.length, [
          box[0] - half,
          box[1] - half,
          box[2] + half,
          box[3] + half,
        ]);
        this.segs.push(seg);
      }
    }
  }

  private addSolid(poly: number[]): void {
    this.solidGrid.insert(this.solids.length, bbox(poly));
    this.solids.push(poly);
  }

  onRoad(x: number, z: number): boolean {
    for (const id of this.segGrid.at(x, z)) {
      const s = this.segs[id]!;
      if (distToSegment(x, z, s[0]!, s[1]!, s[2]!, s[3]!) <= s[4]! + 0.5) return true;
    }
    return false;
  }

  /** True inside a building, fort or gate tower (water does not count). */
  solid(x: number, z: number): boolean {
    for (const id of this.solidGrid.at(x, z))
      if (pointInPolygon(x, z, this.solids[id]!)) return true;
    return false;
  }

  private pointBlocked(x: number, z: number): boolean {
    if (this.solid(x, z)) return true;
    for (const id of this.waterGrid.at(x, z))
      if (pointInPolygon(x, z, this.water[id]!)) return !this.onRoad(x, z);
    return false;
  }

  /** True when a body of the given radius standing at (x, z) would overlap a wall or water. */
  blocked(x: number, z: number, radius: number): boolean {
    if (this.pointBlocked(x, z)) return true;
    return (
      this.pointBlocked(x + radius, z) ||
      this.pointBlocked(x - radius, z) ||
      this.pointBlocked(x, z + radius) ||
      this.pointBlocked(x, z - radius)
    );
  }

  /**
   * Where a body ends up after trying to move by (dx, dz): the full step if it is free, otherwise
   * sliding along one axis. A body that is already stuck (after changing the city scale, say) may
   * move anywhere so it can walk out.
   */
  move(x: number, z: number, dx: number, dz: number, radius: number): [number, number] {
    if (this.blocked(x, z, radius)) return [x + dx, z + dz];
    if (!this.blocked(x + dx, z + dz, radius)) return [x + dx, z + dz];
    if (!this.blocked(x + dx, z, radius)) return [x + dx, z];
    if (!this.blocked(x, z + dz, radius)) return [x, z + dz];
    return [x, z];
  }
}
