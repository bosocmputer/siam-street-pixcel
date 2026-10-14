import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, pickWeighted, rollCount } from '../src';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });

  it('differs for different seeds', () => {
    expect(createRng('a')()).not.toBe(createRng('b')());
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('stays inside [0, 1)', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const r = createRng(seed);
        for (let i = 0; i < 50; i++) {
          const v = r();
          if (!(v >= 0 && v < 1)) return false;
        }
        return true;
      }),
    );
  });

  it('rollCount keeps the expected value and never goes negative', () => {
    const r = createRng('roll');
    let total = 0;
    for (let i = 0; i < 4000; i++) total += rollCount(2.3, r);
    expect(total / 4000).toBeGreaterThan(2.2);
    expect(total / 4000).toBeLessThan(2.4);
    expect(rollCount(0, r)).toBe(0);
    expect(rollCount(-3, r)).toBe(0);
    expect(rollCount(Number.NaN, r)).toBe(0);
  });

  it('pickWeighted respects weights and zero weights', () => {
    const r = createRng('pick');
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[pickWeighted([1, 0, 3], r)]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBeGreaterThan(counts[0]! * 2);
    expect(pickWeighted([0, 0], r)).toBe(0);
  });
});
