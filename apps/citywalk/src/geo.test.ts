import { describe, expect, it } from 'vitest';
import { Collider } from './collide';
import {
  Grid,
  bbox,
  counterClockwise,
  distToSegment,
  pointInPolygon,
  ribbon,
  signedArea,
} from './geo';

const square = [0, 0, 10, 0, 10, 10, 0, 10];

describe('geo', () => {
  it('measures signed area and fixes winding', () => {
    expect(signedArea(square)).toBe(100);
    const reversed = [0, 10, 10, 10, 10, 0, 0, 0];
    expect(signedArea(reversed)).toBe(-100);
    expect(signedArea(counterClockwise(reversed))).toBe(100);
    expect(counterClockwise(square)).toEqual(square);
  });

  it('tests points against a polygon', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(11, 5, square)).toBe(false);
    expect(pointInPolygon(-0.1, 9.9, square)).toBe(false);
  });

  it('measures distance to a segment, including past its ends', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2);
  });

  it('computes bounding boxes', () => {
    expect(bbox([3, -2, -1, 5, 4, 1])).toEqual([-1, -2, 4, 5]);
  });

  it('turns a line into two triangles per segment that cover its width and ends', () => {
    const tris = ribbon([0, 0, 10, 0], 4);
    expect(tris.length).toBe(12);
    const xs = tris.filter((_, i) => i % 2 === 0);
    const zs = tris.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(-2);
    expect(Math.max(...xs)).toBe(12);
    expect(Math.min(...zs)).toBe(-2);
    expect(Math.max(...zs)).toBe(2);
    expect(ribbon([1, 1, 1, 1], 4)).toEqual([]);
  });

  it('finds items through the grid', () => {
    const g = new Grid(10);
    g.insert(7, [0, 0, 25, 5]);
    expect(g.at(22, 3)).toEqual([7]);
    expect(g.at(-5, 3)).toEqual([]);
  });
});

describe('Collider', () => {
  const world = {
    buildings: [[8, 0, ...square]],
    forts: [],
    // a moat strip from x=20 to 30 with a road (bridge) crossing it at z=50
    water: [[20, 0, 30, 0, 30, 100, 20, 100]],
    roads: [[6, 0, 1, 0, 50, 60, 50]],
  };
  const c = new Collider(world);

  it('blocks buildings and water, but not bridges', () => {
    expect(c.blocked(5, 5, 0.4)).toBe(true);
    expect(c.blocked(10.2, 5, 0.4)).toBe(true);
    expect(c.blocked(15, 5, 0.4)).toBe(false);
    expect(c.blocked(25, 20, 0.4)).toBe(true);
    expect(c.blocked(25, 50, 0.4)).toBe(false);
  });

  it('slides along walls and frees a stuck walker', () => {
    expect(c.move(12, 5, -2, 1, 0.4)).toEqual([12, 6]);
    expect(c.move(15, 15, 1, 1, 0.4)).toEqual([16, 16]);
    expect(c.move(5, 5, 1, 0, 0.4)).toEqual([6, 5]);
    expect(c.move(18, 20, 4, 0, 0.4)).toEqual([18, 20]);
  });
});
