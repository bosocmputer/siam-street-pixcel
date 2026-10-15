import { centroid, displayName, roadWidth, type CityData, type Point } from './geo';
import type { Landmark } from './world';

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private background = document.createElement('canvas');
  private size = 600;
  private minX = -950;
  private minZ = -850;
  private span = 2100;
  private landmarks: Landmark[];
  private mapOpen = false;
  onTeleport: (point: Point) => void = () => {};
  constructor(
    private canvas: HTMLCanvasElement,
    data: CityData,
    landmarks: Landmark[],
  ) {
    this.landmarks = landmarks;
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = canvas.getContext('2d')!;
    this.background.width = this.background.height = this.size;
    const c = this.background.getContext('2d')!;
    c.fillStyle = '#e8e7dd';
    c.fillRect(0, 0, this.size, this.size);
    const trace = (points: Point[]) => {
      c.beginPath();
      points.forEach((p, i) => {
        const [x, y] = this.toMap(p);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
    };
    for (const f of data.land) {
      trace(f.points);
      c.fillStyle = ['park', 'garden'].includes(f.tags.leisure)
        ? '#bac9a8'
        : f.tags.amenity === 'place_of_worship'
          ? '#ddd4b6'
          : '#e0dfd5';
      c.fill();
    }
    for (const f of data.water) {
      trace(f.points);
      c.fillStyle = '#75b5ad';
      c.strokeStyle = '#75b5ad';
      c.lineWidth = 2;
      if (f.tags.natural === 'water') c.fill();
      else c.stroke();
    }
    for (const f of data.buildings) {
      trace(f.points);
      c.fillStyle = '#c5c2b5';
      c.fill();
    }
    for (const f of data.roads) {
      trace(f.points);
      c.strokeStyle = '#faf9f3';
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = Math.max(0.65, (roadWidth(f.tags) * this.size) / this.span);
      c.stroke();
    }
    c.fillStyle = '#67736a';
    c.font = '13px system-ui';
    c.textAlign = 'center';
    const named = new Set<string>();
    for (const f of data.roads) {
      const name = displayName(f.tags);
      if (
        !name ||
        named.has(name) ||
        !['primary', 'secondary', 'tertiary'].includes(f.tags.highway)
      )
        continue;
      named.add(name);
      const [x, y] = this.toMap(centroid(f.points));
      c.save();
      c.strokeStyle = '#e8e7dd';
      c.lineWidth = 4;
      c.strokeText(name, x, y);
      c.fillText(name, x, y);
      c.restore();
    }
    this.canvas.addEventListener('click', (e) => {
      if (!this.mapOpen) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * this.size;
      const y = ((e.clientY - rect.top) / rect.height) * this.size;
      this.onTeleport([
        this.minX + (x / this.size) * this.span,
        this.minZ + (y / this.size) * this.span,
      ]);
    });
  }
  setExpanded(value: boolean): void {
    this.mapOpen = value;
  }
  private toMap([x, z]: Point): Point {
    return [((x - this.minX) / this.span) * this.size, ((z - this.minZ) / this.span) * this.size];
  }
  draw(p: Point, yaw: number): void {
    const c = this.ctx;
    c.drawImage(this.background, 0, 0);
    for (let i = 0; i < this.landmarks.length; i++) {
      const [x, y] = this.toMap(this.landmarks[i].position);
      c.fillStyle = '#4d625b';
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = 'bold 10px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), x, y);
      if (this.mapOpen) {
        c.font = '12px system-ui';
        c.textBaseline = 'alphabetic';
        c.lineWidth = 4;
        c.strokeStyle = '#e8e7dd';
        c.strokeText(this.landmarks[i].name, x, y - 12);
        c.fillStyle = '#253c38';
        c.fillText(this.landmarks[i].name, x, y - 12);
      }
    }
    const [x, y] = this.toMap(p);
    const scaleWidth = (200 / this.span) * this.size;
    c.strokeStyle = '#263e38';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(this.size - scaleWidth - 16, this.size - 18);
    c.lineTo(this.size - 16, this.size - 18);
    c.stroke();
    c.save();
    c.translate(x, y);
    c.rotate(-yaw);
    c.fillStyle = '#e88c49';
    c.strokeStyle = '#fff9ef';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(10, 10);
    c.lineTo(0, 5);
    c.lineTo(-10, 10);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
}
