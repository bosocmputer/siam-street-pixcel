// Shape of public/world.json, written by tools/osm_to_world.py.

export interface Landmark {
  name: string;
  en: string;
  kind: 'gate' | 'corner';
  x: number;
  z: number;
}

export interface WorldData {
  attribution: string;
  origin: [number, number];
  /** minX, minZ, maxX, maxZ in metres */
  bounds: [number, number, number, number];
  /** [height, kind (0 normal, 1 temple, 2 historic), x0, z0, x1, z1, ...] */
  buildings: number[][];
  /** [width, class (0 main .. 3 footpath), bridge (0/1), x0, z0, ...] */
  roads: number[][];
  water: number[][];
  green: number[][];
  temples: number[][];
  walls: number[][];
  forts: number[][];
  landmarks: Landmark[];
}

export const BUILDING_TEMPLE = 1;
export const BUILDING_HISTORIC = 2;
