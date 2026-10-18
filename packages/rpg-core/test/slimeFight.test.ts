import { describe, expect, it } from 'vitest';
import { seeded } from '../src/rng';
import { DEFAULT_SPECIES, HOP, MONSTERS, monster } from '../src/monsters';
import { newBrain, provoke, stepBrain, type BrainWorld } from '../src/slimeBrain';

const open: BrainWorld = {
  rng: seeded(7),
  move: (x, z, dx, dz) => [x + dx, z + dz],
  allowed: () => true,
};

/** run a brain for `seconds` and count the blows that land */
function run(
  b: ReturnType<typeof newBrain>,
  seconds: number,
  player: { x: number; z: number; down?: boolean },
) {
  let blows = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    stepBrain(b, 1 / 60, player, open);
    if (b.struck) blows++;
  }
  return blows;
}

const SLIME = monster(DEFAULT_SPECIES);
const { near: NEAR, attack: ATTACK, anger: ANGER } = SLIME;

describe('slimes fight back', () => {
  it('a calm slime only threatens: it never lands a blow', () => {
    const b = newBrain(0, 0);
    expect(run(b, 5, { x: 1, z: 0 })).toBe(0);
    expect(b.mode).toBe('lunge');
  });

  it('an angry slime lands one blow per attack while the player is in reach', () => {
    const b = newBrain(0, 0);
    provoke(b);
    expect(b.anger).toBe(ANGER.time);
    // 3 whole attacks
    expect(run(b, ATTACK.cycle * 3 + 0.01, { x: 1, z: 0 })).toBe(3);
    // just outside reach but close enough to swing: it misses
    const c = newBrain(0, 0);
    provoke(c);
    expect(run(c, ATTACK.cycle * 2, { x: (ATTACK.reach + NEAR.lunge) / 2, z: 0 })).toBe(0);
  });

  it('chases the player, hopping, and stops being angry after a while', () => {
    const b = newBrain(0, 0);
    provoke(b);
    run(b, 0.1, { x: 8, z: 0 });
    expect(b.mode).toBe('chase');
    run(b, 4, { x: 8, z: 0 });
    expect(b.x).toBeGreaterThan(3);
    run(b, ANGER.time, { x: 8, z: 0 });
    expect(b.anger).toBe(0);
    expect(b.mode).not.toBe('chase');
  });

  it('gives up and goes home when led too far away', () => {
    const b = newBrain(0, 0);
    provoke(b);
    b.x = ANGER.leash + 1;
    run(b, 1 / 60, { x: 40, z: 0 });
    expect(b.anger).toBe(0);
    expect(b.target).toEqual([0, 0]);
    expect(b.mode).toBe('hop');
  });

  it('leaves a player who is down alone', () => {
    const b = newBrain(0, 0);
    provoke(b);
    expect(run(b, 3, { x: 1, z: 0, down: true })).toBe(0);
    expect(b.anger).toBe(0);
    expect(b.mode).not.toBe('lunge');
  });

  it('lands a hop first if it calms down in the air', () => {
    const b = newBrain(0, 0);
    provoke(b);
    run(b, 0.5, { x: 8, z: 0 }); // in the air by now
    b.anger = 0.001;
    run(b, 1 / 60, { x: 8, z: 0 });
    expect(b.mode).toBe('chase');
    run(b, 1.5, { x: 8, z: 0 });
    expect(b.mode).not.toBe('chase');
  });

  it('reads its numbers from the config', () => {
    expect(SLIME.exp).toBeGreaterThan(0);
    expect(SLIME.takes.fire).toBe(1);
  });

  it('a quick little slime strikes sooner and a heavy giant reaches further', () => {
    const mini = MONSTERS.slime_mini!,
      giant = MONSTERS.slime_giant!;
    const blows = (spec: typeof mini, dist: number, seconds: number) => {
      const b = newBrain(0, 0, 0, spec);
      provoke(b);
      return run(b, seconds, { x: dist, z: 0 });
    };
    // in 6 seconds the quick one lands more blows than its cycle length alone would give
    expect(blows(mini, 1, 6)).toBeGreaterThan(Math.floor(6 / mini.attack.cycle));
    // 2.5 m away is beyond a plain slime's threatening range but inside the giant's reach, so
    // the giant strikes within 1.5 s while the plain slime is still hopping over
    expect(2.5).toBeGreaterThan(SLIME.near.lunge);
    expect(2.5).toBeLessThan(giant.attack.reach);
    expect(blows(giant, 2.5, 1.5)).toBeGreaterThan(0);
    expect(blows(SLIME, 2.5, 1.5)).toBe(0);
  });

  it('a long-striding species covers more ground per hop, and a quick one hops sooner', () => {
    const oneHop = (spec: typeof SLIME) => {
      const b = newBrain(0, 0, 0, spec);
      provoke(b);
      let t = 0;
      for (; t < 10; t += 1 / 60) {
        stepBrain(b, 1 / 60, { x: 50, z: 0 }, open);
        if (b.phase >= HOP.cycle) break;
      }
      return { x: b.x, t };
    };
    const plain = oneHop(SLIME),
      giant = oneHop(MONSTERS.slime_giant!),
      mini = oneHop(MONSTERS.slime_mini!);
    expect(giant.x).toBeCloseTo(HOP.distance * MONSTERS.slime_giant!.stride, 0);
    expect(giant.x).toBeGreaterThan(plain.x);
    expect(plain.x).toBeGreaterThan(mini.x);
    expect(giant.t).toBeGreaterThan(plain.t); // slower
    expect(mini.t).toBeLessThan(plain.t); // quicker
  });
});
