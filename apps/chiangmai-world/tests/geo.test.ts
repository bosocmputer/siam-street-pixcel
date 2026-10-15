import { describe, expect, it } from 'vitest';
import {
  CityCollision,
  buildingHeight,
  closestOnSegment,
  inside,
  inFeature,
  project,
  unproject,
  roadWidth,
  type CityData,
  type Feature,
} from '../src/geo';

const block: Feature = {
  id: 'building',
  points: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
  tags: { building: 'yes' },
};
const empty: CityData = {
  buildings: [],
  roads: [],
  water: [],
  land: [],
  barriers: [],
  points: [],
  meta: {
    origin: [98.985, 18.7895],
    bbox: [18.77, 98.97, 18.81, 99],
    osmTimestamp: '',
    importedAt: '',
    counts: {},
  },
};
describe('geographic walking invariants', () => {
  it('projects east to +X and north to -Z with reversible metre scale', () => {
    const p = project(98.993, 18.79, empty.meta.origin);
    expect(p[0]).toBeGreaterThan(800);
    expect(p[1]).toBeLessThan(0);
    const ll = unproject(...p, empty.meta.origin);
    expect(ll[0]).toBeCloseTo(98.993, 8);
    expect(ll[1]).toBeCloseTo(18.79, 8);
  });
  it('keeps courtyards open and prevents walking through building edges', () => {
    const f = {
      ...block,
      holes: [
        [
          [3, 3],
          [7, 3],
          [7, 7],
          [3, 7],
          [3, 3],
        ],
      ] as [number, number][][],
    };
    expect(inside([5, 5], block.points)).toBe(true);
    expect(inFeature([5, 5], f)).toBe(false);
    const c = new CityCollision({ ...empty, buildings: [f] });
    expect(c.blocked([1, 5])).toBe(true);
    expect(c.blocked([-0.2, 5])).toBe(true);
    expect(c.blocked([5, 5])).toBe(false);
  });
  it('blocks the moat while allowing a mapped crossing', () => {
    const water = { ...block, tags: { natural: 'water' } };
    const road: Feature = {
      id: 'bridge',
      tags: { highway: 'footway', bridge: 'yes' },
      points: [
        [-5, 5],
        [15, 5],
      ],
    };
    const c = new CityCollision({ ...empty, water: [water], roads: [road] });
    expect(c.blocked([5, 2])).toBe(true);
    expect(c.blocked([5, 5])).toBe(false);
  });
  it('finds a safe spawn outside an occupied footprint', () => {
    const c = new CityCollision({ ...empty, buildings: [block] });
    const p = c.nearestWalkable([5, 5]);
    expect(c.blocked(p, 0.7)).toBe(false);
  });
  it('supports walls and short segments without NaN', () => {
    expect(closestOnSegment([2, 2], [0, 0], [0, 0])).toEqual([0, 0]);
    const c = new CityCollision({
      ...empty,
      barriers: [
        {
          id: 'wall',
          tags: { barrier: 'wall' },
          points: [
            [-5, 0],
            [5, 0],
          ],
        },
      ],
    });
    expect(c.blocked([0, 0.5])).toBe(true);
    expect(c.blocked([0, 2])).toBe(false);
  });
  it('marks inferred heights and respects mapped heights and narrow footways', () => {
    expect(buildingHeight(block).measured).toBe(false);
    expect(buildingHeight({ ...block, tags: { height: '16 m' } })).toEqual({
      height: 16,
      measured: true,
    });
    expect(roadWidth({ highway: 'footway' })).toBeLessThan(roadWidth({ highway: 'residential' }));
  });
});
