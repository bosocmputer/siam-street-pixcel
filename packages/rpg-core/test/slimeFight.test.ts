import { describe, expect, it } from 'vitest';
import { seeded } from '../src/rng';
import {
  ANGER,
  ATTACK,
  NEAR,
  SLIME,
  newBrain,
  provoke,
  stepBrain,
  type BrainWorld,
} from '../src/slimeBrain';

const open: BrainWorld = {
  wander: 5,
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
});
