// Where monsters may not go (config/spawns.json): round a temple's grounds, which stay background
// only, and round the rest points, where a player is left alone. Also which rest point is nearest.

import { bbox, distToSegment, pointInPolygon } from './geo';

/** Is (x, z) at least `clear` metres from the polygon and outside it? */
function clearOf(x: number, z: number, poly: readonly number[], clear: number): boolean {
  if (pointInPolygon(x, z, poly)) return false;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (distToSegment(x, z, poly[i * 2]!, poly[i * 2 + 1]!, poly[j * 2]!, poly[j * 2 + 1]!) < clear)
      return false;
  }
  return true;
}

/**
 * A test for where a monster may stand: not within `templeClear` of a temple's grounds and not
 * within `restRadius` of a rest point (map metres).
 */
export function monsterGround(
  temples: readonly (readonly number[])[],
  rest: readonly [number, number][],
  templeClear: number,
  restRadius: number,
): (x: number, z: number) => boolean {
  const boxed = temples.map((poly) => {
    const [x0, z0, x1, z1] = bbox(poly);
    return { poly, box: [x0 - templeClear, z0 - templeClear, x1 + templeClear, z1 + templeClear] };
  });
  return (x, z) => {
    for (const [rx, rz] of rest) if (Math.hypot(x - rx, z - rz) < restRadius) return false;
    for (const { poly, box } of boxed) {
      if (x < box[0]! || z < box[1]! || x > box[2]! || z > box[3]!) continue;
      if (!clearOf(x, z, poly, templeClear)) return false;
    }
    return true;
  };
}

/** The rest point nearest to (x, z), and whether (x, z) is inside its safe circle. */
export function nearestRest(
  rest: readonly [number, number][],
  x: number,
  z: number,
  radius: number,
): { at: [number, number]; inside: boolean } {
  let best = rest[0]!,
    bd = Infinity;
  for (const r of rest) {
    const d = Math.hypot(x - r[0], z - r[1]);
    if (d < bd) [best, bd] = [r, d];
  }
  return { at: best, inside: bd <= radius };
}
