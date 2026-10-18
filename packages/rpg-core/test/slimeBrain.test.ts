import { describe, expect, it } from 'vitest';
import { seeded } from '../src/rng';
import { DEFAULT_SPECIES, HOP, monster } from '../src/monsters';
import { airborne, newBrain, stepBrain, type BrainWorld } from '../src/slimeBrain';

const NEAR = monster(DEFAULT_SPECIES).near;

const far = { x: 1000, z: 1000 };
const open: BrainWorld = {
  rng: seeded(7),
  move: (x, z, dx, dz) => [x + dx, z + dz],
  allowed: () => true,
};

describe('slime brain', () => {
  it('gives the same random numbers for the same seed', () => {
    const a = seeded(42),
      b = seeded(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('knows when the hop is in the air', () => {
    expect(airborne(0)).toBe(false);
    expect(airborne(HOP.liftOff)).toBe(true);
    expect(airborne(1.0)).toBe(true);
    expect(airborne(HOP.land)).toBe(false);
    expect(airborne(HOP.cycle + 0.5)).toBe(true);
  });

  it('picks a spot, hops to it moving only in the air, then rests', () => {
    const b = newBrain(0, 0);
    stepBrain(b, 0.1, far, { ...open, rng: seeded(3) });
    expect(b.mode).toBe('hop');
    const target = b.target!;
    // on the ground at the start of the hop: no movement
    for (let t = 0; t < HOP.liftOff - 0.05; t += 0.05) stepBrain(b, 0.05, far, open);
    expect([b.x, b.z]).toEqual([0, 0]);
    // keep going until it rests again
    for (let i = 0; i < 400 && b.mode === 'hop'; i++) stepBrain(b, 0.05, far, open);
    expect(b.mode).toBe('idle');
    expect(Math.hypot(b.x - target[0], b.z - target[1])).toBeLessThan(0.45);
    expect(airborne(b.phase)).toBe(false);
  });

  it('turns to watch the walker, lunges when close, and forgets when they leave', () => {
    const b = newBrain(0, 0);
    stepBrain(b, 0.1, { x: 0, z: NEAR.watch - 1 }, open);
    expect(b.mode).toBe('watch');
    expect(b.heading).toBeCloseTo(0);
    stepBrain(b, 0.1, { x: NEAR.lunge - 0.5, z: 0 }, open);
    expect(b.mode).toBe('lunge');
    expect(b.heading).toBeCloseTo(Math.PI / 2);
    stepBrain(b, 0.1, { x: NEAR.watch + 0.5, z: 0 }, open); // between watch and forget: still watching
    expect(b.mode).toBe('watch');
    stepBrain(b, 0.1, far, open);
    expect(b.mode).toBe('idle');
  });

  it('gives up a hop it cannot make, and never aims outside the allowed area', () => {
    const wall: BrainWorld = { ...open, move: (x, z) => [x, z] };
    const b = newBrain(0, 0);
    for (let i = 0; i < 200 && !(b.mode === 'idle' && b.wait > 1); i++)
      stepBrain(b, 0.05, far, wall);
    expect(b.mode).toBe('idle');
    expect([b.x, b.z]).toEqual([0, 0]);

    const c = newBrain(0, 0);
    stepBrain(c, 0.1, far, { ...open, allowed: () => false });
    expect(c.mode).toBe('idle');
    expect(c.target).toBeNull();
    expect(c.wait).toBeCloseTo(0.3);
  });
});
