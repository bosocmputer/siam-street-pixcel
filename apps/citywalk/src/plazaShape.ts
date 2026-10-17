// Pure geometry for the paved square in front of a gate. Everything is in the gate frame (see
// gateModel.ts): x along the wall, z out of the city, metres.

import { pointInPolygon } from './geo';

/** A road centre-line piece with half its width. */
export interface RoadPiece {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  half: number;
}

/**
 * Nearest road edge in front of the wall at position x: the smallest z (beyond zMin) where a road
 * crossing x begins. Null when no road crosses x.
 */
export function roadEdgeAt(roads: readonly RoadPiece[], x: number, zMin: number): number | null {
  let best: number | null = null;
  for (const r of roads) {
    if (r.x0 === r.x1 || (r.x0 - x) * (r.x1 - x) > 0) continue;
    const z = r.z0 + ((r.z1 - r.z0) * (x - r.x0)) / (r.x1 - r.x0);
    const edge = z - r.half;
    if (z > zMin && (best === null || edge < best)) best = edge;
  }
  return best;
}

/**
 * The stretch of wall front with no water in it: walking out from x = 0 along a line at depth z in
 * steps, the last dry x on each side before a water polygon. Stops at `limit` if there is none.
 */
export function openStretch(
  water: readonly (readonly number[])[],
  z: number,
  limit: number,
  step = 1,
): [number, number] {
  const wet = (x: number) => water.some((w) => pointInPolygon(x, z, w));
  let lo = 0,
    hi = 0;
  while (lo > -limit && !wet(lo - step)) lo -= step;
  while (hi < limit && !wet(hi + step)) hi += step;
  return [lo, hi];
}

/**
 * Outline of the square: the wall front from x0 to x1 at depth zFace, then back along the road
 * edge (less a margin for the kerb), sampled every `step` metres. Where no road is found the last
 * depth carries on. Depth is kept between minDepth and maxDepth from the wall front.
 */
export function plazaOutline(
  roads: readonly RoadPiece[],
  o: {
    x0: number;
    x1: number;
    zFace: number;
    minDepth: number;
    maxDepth: number;
    step: number;
    margin: number;
  },
): number[] {
  const out = [o.x0, o.zFace, o.x1, o.zFace];
  const xs: number[] = [];
  for (let x = o.x1; x > o.x0; x -= o.step) xs.push(x);
  xs.push(o.x0);
  let last = o.zFace + o.minDepth;
  for (const x of xs) {
    const e = roadEdgeAt(roads, x, o.zFace + 1);
    if (e !== null) last = e - o.margin;
    const z = Math.min(o.zFace + o.maxDepth, Math.max(o.zFace + o.minDepth, last));
    out.push(x, z);
  }
  return out;
}
