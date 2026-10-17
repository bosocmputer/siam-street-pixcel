import { describe, expect, it } from 'vitest';
import { signedArea } from './geo';
import { openStretch, plazaOutline, roadEdgeAt, type RoadPiece } from './plazaShape';

// a straight road 30 m in front of the wall, 10 m wide, bending away to z = 50 on the left
const roads: RoadPiece[] = [
  { x0: -60, z0: 50, x1: -20, z1: 30, half: 5 },
  { x0: -20, z0: 30, x1: 60, z1: 30, half: 5 },
];

describe('plaza shape', () => {
  it('finds the nearest road edge in front of the wall', () => {
    expect(roadEdgeAt(roads, 10, 3)).toBe(25);
    expect(roadEdgeAt(roads, -40, 3)).toBe(35);
    expect(roadEdgeAt(roads, 80, 3)).toBeNull();
    // a road behind the line is ignored
    expect(roadEdgeAt([{ x0: -5, z0: 2, x1: 5, z1: 2, half: 1 }], 0, 3)).toBeNull();
  });

  it('finds the last dry spot before the water on each side of the gate', () => {
    const water = [
      [-80, 4, -50.5, 4, -50.5, 20, -80, 20],
      [40.5, 4, 90, 4, 90, 20, 40.5, 20],
    ];
    expect(openStretch(water, 10, 200)).toEqual([-50, 40]);
    expect(openStretch([], 10, 30)).toEqual([-30, 30]);
  });

  it('follows the road edge, keeps depth limits and closes back along the wall', () => {
    const o = { x0: -50, x1: 40, zFace: 2, minDepth: 4, maxDepth: 40, step: 10, margin: 0.5 };
    const p = plazaOutline(roads, o);
    expect(p.slice(0, 4)).toEqual([-50, 2, 40, 2]);
    // at x = 40 the road edge is 25, less the margin
    expect(p[4]).toBe(40);
    expect(p[5]).toBe(24.5);
    // ends at x0 along the bent part of the road, deeper
    expect(p[p.length - 2]).toBe(-50);
    expect(p[p.length - 1]).toBeCloseTo(39.5);
    // the outline runs one way round, so it has a non-zero area
    expect(Math.abs(signedArea(p))).toBeGreaterThan(90 * 20);
    // without roads the square keeps its minimum depth
    const flat = plazaOutline([], o);
    expect(
      flat
        .slice(4)
        .filter((_, i) => i % 2 === 1)
        .every((z) => z === 6),
    ).toBe(true);
  });
});
