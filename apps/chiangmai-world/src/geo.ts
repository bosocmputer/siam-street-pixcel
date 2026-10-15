export type Point = [number, number];
export type Tags = Record<string, string>;
export interface Feature {
  id: string;
  points: Point[];
  holes?: Point[][];
  tags: Tags;
}
export interface MapPoint {
  id: string;
  p: Point;
  tags: Tags;
}
export interface CityData {
  meta: {
    origin: Point;
    bbox: [number, number, number, number];
    osmTimestamp: string;
    importedAt: string;
    counts: Record<string, number>;
  };
  buildings: Feature[];
  roads: Feature[];
  water: Feature[];
  land: Feature[];
  barriers: Feature[];
  points: MapPoint[];
}

export function project(lon: number, lat: number, origin: Point): Point {
  return [
    (lon - origin[0]) * 111_320 * Math.cos((origin[1] * Math.PI) / 180),
    (origin[1] - lat) * 111_320,
  ];
}
export function unproject(x: number, z: number, origin: Point): Point {
  return [
    origin[0] + x / (111_320 * Math.cos((origin[1] * Math.PI) / 180)),
    origin[1] - z / 111_320,
  ];
}
export function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function inside(p: Point, ring: Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function inFeature(p: Point, f: Feature): boolean {
  return inside(p, f.points) && !(f.holes || []).some((hole) => inside(p, hole));
}
export function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const d = dx * dx + dz * dz;
  const t = d === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d));
  return [a[0] + t * dx, a[1] + t * dz];
}
export function distanceToLine(p: Point, points: Point[]): number {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const q = closestOnSegment(p, points[i - 1], points[i]);
    distance = Math.min(distance, Math.hypot(p[0] - q[0], p[1] - q[1]));
  }
  return distance;
}
export function centroid(points: Point[]): Point {
  const ring =
    points.length > 1 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1]
      ? points.slice(0, -1)
      : points;
  return [
    ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
    ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
  ];
}
export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  return Math.abs(sum / 2);
}
export function roadWidth(tags: Tags): number {
  const explicit = parseFloat(tags.width);
  if (Number.isFinite(explicit)) return Math.max(1, Math.min(26, explicit));
  const widths: Record<string, number> = {
    trunk: 13,
    primary: 11,
    secondary: 9,
    tertiary: 7,
    residential: 5.2,
    unclassified: 5,
    service: 3.6,
    living_street: 4,
    pedestrian: 6,
    footway: 2,
    path: 1.7,
    steps: 1.6,
    cycleway: 2.4,
  };
  return widths[tags.highway] || 4;
}
export function buildingHeight(feature: Feature): { height: number; measured: boolean } {
  const height = parseFloat(feature.tags.height);
  const levels = parseFloat(feature.tags['building:levels']);
  return {
    height: Number.isFinite(height)
      ? Math.max(2, Math.min(55, height))
      : Number.isFinite(levels)
        ? Math.max(2.8, Math.min(40, levels * 3.2))
        : 3.5 + (hash(feature.id) % 3) * 3.1,
    measured: Number.isFinite(height) || Number.isFinite(levels),
  };
}
export function displayName(tags: Tags): string {
  return tags['name:th'] || tags.name || tags['name:en'] || '';
}

export class SpatialIndex<T> {
  private cells = new Map<string, Set<T>>();
  constructor(private size = 32) {}
  add(item: T, points: Point[], padding = 0): void {
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    for (
      let x = Math.floor((Math.min(...xs) - padding) / this.size);
      x <= Math.floor((Math.max(...xs) + padding) / this.size);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(...zs) - padding) / this.size);
        z <= Math.floor((Math.max(...zs) + padding) / this.size);
        z++
      ) {
        const key = `${x},${z}`;
        if (!this.cells.has(key)) this.cells.set(key, new Set());
        this.cells.get(key)!.add(item);
      }
    }
  }
  near(p: Point, radius = 1): T[] {
    const result = new Set<T>();
    for (
      let x = Math.floor((p[0] - radius) / this.size);
      x <= Math.floor((p[0] + radius) / this.size);
      x++
    ) {
      for (
        let z = Math.floor((p[1] - radius) / this.size);
        z <= Math.floor((p[1] + radius) / this.size);
        z++
      ) {
        for (const item of this.cells.get(`${x},${z}`) || []) result.add(item);
      }
    }
    return [...result];
  }
}

export class CityCollision {
  private buildings = new SpatialIndex<Feature>();
  private water = new SpatialIndex<Feature>();
  private roads = new SpatialIndex<Feature>();
  private walls = new SpatialIndex<Feature>();
  constructor(data: CityData) {
    data.buildings.forEach((f) => this.buildings.add(f, f.points, 1));
    data.water
      .filter((f) => f.tags.natural === 'water')
      .forEach((f) => this.water.add(f, f.points, 1));
    data.roads.forEach((f) => this.roads.add(f, f.points, roadWidth(f.tags)));
    data.barriers
      .filter(
        (f) =>
          ['wall', 'city_wall', 'fence'].includes(f.tags.barrier) ||
          f.tags.historic === 'citywalls',
      )
      .forEach((f) => this.walls.add(f, f.points, 1));
  }
  blocked(p: Point, radius = 0.38): boolean {
    if (this.buildings.near(p).some((f) => inFeature(p, f) || distanceToLine(p, f.points) < radius))
      return true;
    if (this.walls.near(p).some((f) => distanceToLine(p, f.points) < radius + 0.3)) return true;
    if (this.water.near(p).some((f) => inFeature(p, f) || distanceToLine(p, f.points) < radius)) {
      return !this.roads
        .near(p)
        .some((f) => distanceToLine(p, f.points) < roadWidth(f.tags) * 0.47);
    }
    return false;
  }
  nearestWalkable(p: Point): Point {
    if (!this.blocked(p, 0.7)) return [...p];
    for (let r = 1; r < 85; r += 1.5) {
      for (let a = 0; a < 24; a++) {
        const q: Point = [
          p[0] + Math.cos((a * Math.PI) / 12) * r,
          p[1] + Math.sin((a * Math.PI) / 12) * r,
        ];
        if (!this.blocked(q, 0.7)) return q;
      }
    }
    throw new Error('ไม่พบทางเดินใกล้จุดนี้');
  }
}
