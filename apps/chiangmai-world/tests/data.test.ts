import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CityCollision, project, type CityData } from '../src/geo';
import { landmarksFromData } from '../src/world';

const city: CityData = JSON.parse(
  readFileSync(new URL('../public/data/old-city.json', import.meta.url), 'utf8'),
);
describe('real Old City snapshot', () => {
  it('contains attributed source geometry, including all four moat sides', () => {
    expect(city.meta.counts.buildings).toBe(city.buildings.length);
    expect(city.buildings.length).toBeGreaterThan(5000);
    expect(city.roads.length).toBeGreaterThan(1000);
    const moat = city.water.filter((f) => f.tags.water === 'moat');
    expect(moat.length).toBeGreaterThan(10);
    const points = moat.flatMap((f) => f.points);
    expect(Math.min(...points.map((p) => p[0]))).toBeLessThan(-650);
    expect(Math.max(...points.map((p) => p[0]))).toBeGreaterThan(800);
    expect(Math.min(...points.map((p) => p[1]))).toBeLessThan(-620);
    expect(Math.max(...points.map((p) => p[1]))).toBeGreaterThan(850);
  });
  it('has mapped Rajdamnoen, Singharat, and Phra Pok Klao streets', () => {
    for (const word of ['ราชดำเนิน', 'สิงหราช', 'พระปกเกล้า']) {
      expect(
        city.roads.some((road) => Object.values(road.tags).some((value) => value.includes(word))),
      ).toBe(true);
    }
  });
  it('finds safe spawns for all nine mapped landmarks', () => {
    const collision = new CityCollision(city);
    const landmarks = landmarksFromData(city);
    expect(landmarks).toHaveLength(9);
    const min = project(city.meta.bbox[1], city.meta.bbox[2], city.meta.origin);
    const max = project(city.meta.bbox[3], city.meta.bbox[0], city.meta.origin);
    for (const landmark of landmarks) {
      const spawn = collision.nearestWalkable(landmark.spawn);
      expect(collision.blocked(spawn, 0.7), landmark.name).toBe(false);
      expect(spawn[0]).toBeGreaterThan(min[0]);
      expect(spawn[0]).toBeLessThan(max[0]);
      expect(spawn[1]).toBeGreaterThan(min[1]);
      expect(spawn[1]).toBeLessThan(max[1]);
    }
  });
  it('leaves the real Tha Phae pedestrian gate opening passable', () => {
    const collision = new CityCollision(city);
    for (let x = 858; x <= 893; x += 0.5)
      expect(collision.blocked([x, 193]), `${x},193`).toBe(false);
  });
});
