import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPAWNS } from '@newgame/rpg-core';
import { frameToMap, gateFrame } from './gateModel';
import type { Landmark } from './types';
import { monsterGround, nearestRest } from './zones';

const world = JSON.parse(
  readFileSync(new URL('../public/world.json', import.meta.url), 'utf8'),
) as {
  temples: number[][];
  water: number[][];
  forts: number[][];
  landmarks: Landmark[];
};
const thaPhae = world.landmarks.find((m) => m.name === 'ประตูท่าแพ')!;
const frame = gateFrame(thaPhae, world.forts)!;
const toMap = (f: 'gate' | 'map', at: [number, number]): [number, number] =>
  f === 'gate' ? frameToMap(frame, at[0], at[1]) : at;
const rest = SPAWNS.rest.map((r) => toMap(r.frame, r.at));

describe('where monsters live', () => {
  it('keeps every monster clear of temple grounds and of the rest points', () => {
    const ok = monsterGround(world.temples, rest, SPAWNS.templeClear, SPAWNS.restRadius);
    let n = 0;
    for (const [id, zone] of Object.entries(SPAWNS.zones))
      for (const s of zone.spawns) {
        const [x, z] = toMap(zone.frame, s.at);
        expect(ok(x, z), `${id} ${s.species} at ${x.toFixed(0)}, ${z.toFixed(0)}`).toBe(true);
        n++;
      }
    expect(n).toBeGreaterThan(40);
  });

  it('keeps every monster out of the moat and other water, where shots and steps cannot reach', () => {
    const dry = monsterGround(world.water, [], 3, 0);
    for (const [id, zone] of Object.entries(SPAWNS.zones))
      for (const s of zone.spawns) {
        const [x, z] = toMap(zone.frame, s.at);
        expect(dry(x, z), `${id} ${s.species} at ${x.toFixed(0)}, ${z.toFixed(0)}`).toBe(true);
      }
  });

  it('has a rest point at every gate, the first where the game starts', () => {
    expect(rest).toHaveLength(5);
    const start = frameToMap(frame, 0, 20);
    expect(Math.hypot(rest[0]![0] - start[0], rest[0]![1] - start[1])).toBeLessThan(0.01);
    for (const g of world.landmarks.filter((m) => m.kind === 'gate')) {
      const near = nearestRest(rest, g.x, g.z, 60);
      expect(near.inside, g.name).toBe(true);
    }
  });

  it('tells a temple and a rest point from open street', () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    const ok = monsterGround([square], [[100, 100]], 5, 20);
    expect(ok(5, 5)).toBe(false);
    expect(ok(13, 5)).toBe(false);
    expect(ok(30, 5)).toBe(true);
    expect(ok(110, 100)).toBe(false);
    expect(
      nearestRest(
        [
          [0, 0],
          [50, 0],
        ],
        40,
        0,
        15,
      ),
    ).toEqual({ at: [50, 0], inside: true });
  });
});
