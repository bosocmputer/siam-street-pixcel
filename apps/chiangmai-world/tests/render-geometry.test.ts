import { describe, expect, it } from 'vitest';
import { buildingWalls, ribbon } from '../src/world';
import type { Feature } from '../src/geo';

describe('surfaces remain stable while the map camera moves', () => {
  it('does not duplicate a building roof with an extrusion cap immediately underneath', () => {
    const feature: Feature = {
      id: 'roof-flicker-reproduction',
      tags: { building: 'yes' },
      points: [
        [0, 0],
        [10, 0],
        [10, 8],
        [0, 8],
        [0, 0],
      ],
    };
    const geometry = buildingWalls(feature, 8);
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) expect(Math.abs(normals.getY(i))).toBeLessThan(0.001);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(8);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0);
    geometry.dispose();
  });
  it('samples the same ground texture at every world point regardless of road-segment origin', () => {
    for (const points of [
      [
        [10, 20],
        [20, 20],
      ],
      [
        [20, 20],
        [10, 20],
      ],
      [
        [15, 10],
        [15, 30],
      ],
    ] as [number, number][][]) {
      const geometry = ribbon(points, 5, 0.18);
      const position = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < position.count; i++) {
        expect(uv.getX(i)).toBeCloseTo(position.getX(i) / 4);
        expect(uv.getY(i)).toBeCloseTo(position.getZ(i) / 4);
      }
      geometry.dispose();
    }
  });
});
