import type { WorldData } from './types';

const SIZE = 132;
/** the map is drawn at half size and shown doubled, so it reads as pixels like the rest */
const PIXEL = 0.5;

/** North-up overview of the whole test area with the walker's position and direction. */
export class Minimap {
  canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private k: number;
  private x0: number;
  private z0: number;

  constructor(private world: WorldData) {
    const dpr = PIXEL;
    const [x0, z0, x1, z1] = world.bounds;
    this.x0 = x0;
    this.z0 = z0;
    this.k = (SIZE * dpr) / Math.max(x1 - x0, z1 - z0);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap px';
    this.canvas.width = this.canvas.height = SIZE * dpr;
    this.g = this.canvas.getContext('2d')!;

    this.base = document.createElement('canvas');
    this.base.width = this.base.height = SIZE * dpr;
    const b = this.base.getContext('2d')!;
    b.fillStyle = '#e6dfcd';
    b.fillRect(0, 0, this.base.width, this.base.height);
    const poly = (p: number[], fill: string) => {
      b.beginPath();
      for (let i = 0; i < p.length; i += 2) b.lineTo(...this.px(p[i]!, p[i + 1]!));
      b.closePath();
      b.fillStyle = fill;
      b.fill();
    };
    for (const p of world.green) poly(p, '#a9cf97');
    for (const p of world.temples) poly(p, '#ecd8a0');
    for (const r of world.roads) {
      if (r[1]! > 1) continue;
      b.beginPath();
      for (let i = 3; i < r.length; i += 2) b.lineTo(...this.px(r[i]!, r[i + 1]!));
      b.strokeStyle = r[1] === 0 ? '#6b6f76' : '#a3a5a8';
      b.lineWidth = r[1] === 0 ? 1.6 * dpr : 0.8 * dpr;
      b.stroke();
    }
    for (const p of world.water) poly(p, '#4f8fbf');
    for (const p of world.forts) poly(p, '#a9573c');
  }

  /** Paint an extra area (map metres) onto the background, under the walker. */
  addArea(poly: readonly number[], fill: string): void {
    const b = this.base.getContext('2d')!;
    b.beginPath();
    for (let i = 0; i < poly.length; i += 2) b.lineTo(...this.px(poly[i]!, poly[i + 1]!));
    b.closePath();
    b.fillStyle = fill;
    b.fill();
  }

  private px(x: number, z: number): [number, number] {
    return [(x - this.x0) * this.k, (z - this.z0) * this.k];
  }

  draw(
    x: number,
    z: number,
    heading: number,
    showMarks: boolean,
    dots: readonly number[] = [],
  ): void {
    const g = this.g;
    g.drawImage(this.base, 0, 0);
    const dot = (x: number, z: number, n: number, c: string) => {
      const [mx, mz] = this.px(x, z);
      g.fillStyle = c;
      g.fillRect(Math.round(mx - n / 2), Math.round(mz - n / 2), n, n);
    };
    // monsters
    for (let i = 0; i < dots.length; i += 2) dot(dots[i]!, dots[i + 1]!, 1, '#2ce8f5');
    if (showMarks)
      for (const m of this.world.landmarks)
        dot(m.x, m.z, 2, m.kind === 'gate' ? '#7a2e1c' : '#a9573c');
    // the walker: a dark-edged square with a dot on the side it faces
    const [px, pz] = this.px(x, z).map(Math.round) as [number, number];
    g.fillStyle = '#181425';
    g.fillRect(px - 2, pz - 2, 5, 5);
    g.fillStyle = '#f77622';
    g.fillRect(px - 1, pz - 1, 3, 3);
    g.fillStyle = '#fee761';
    g.fillRect(
      px + Math.round(-Math.sin(heading) * 3),
      pz + Math.round(-Math.cos(heading) * 3),
      1,
      1,
    );
  }
}
