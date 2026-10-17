import type { WorldData } from './types';

const SIZE = 132;

/** North-up overview of the whole test area with the walker's position and direction. */
export class Minimap {
  canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private k: number;
  private x0: number;
  private z0: number;

  constructor(private world: WorldData) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const [x0, z0, x1, z1] = world.bounds;
    this.x0 = x0;
    this.z0 = z0;
    this.k = (SIZE * dpr) / Math.max(x1 - x0, z1 - z0);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
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

  private px(x: number, z: number): [number, number] {
    return [(x - this.x0) * this.k, (z - this.z0) * this.k];
  }

  draw(x: number, z: number, heading: number, showMarks: boolean): void {
    const g = this.g;
    const dpr = this.canvas.width / SIZE;
    g.drawImage(this.base, 0, 0);
    if (showMarks)
      for (const m of this.world.landmarks) {
        const [mx, mz] = this.px(m.x, m.z);
        g.fillStyle = m.kind === 'gate' ? '#7a2e1c' : '#a9573c';
        g.fillRect(mx - 2 * dpr, mz - 2 * dpr, 4 * dpr, 4 * dpr);
      }
    const [px, pz] = this.px(x, z);
    g.save();
    g.translate(px, pz);
    g.rotate(-heading);
    g.beginPath();
    g.moveTo(0, -7 * dpr);
    g.lineTo(5 * dpr, 5 * dpr);
    g.lineTo(0, 2 * dpr);
    g.lineTo(-5 * dpr, 5 * dpr);
    g.closePath();
    g.fillStyle = '#e0773a';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5 * dpr;
    g.fill();
    g.stroke();
    g.restore();
  }
}
