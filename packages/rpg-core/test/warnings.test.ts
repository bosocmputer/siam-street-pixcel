import { describe, expect, it } from 'vitest';
import { DEFAULT_SPECIES, monster } from '../src/monsters';
import { seeded } from '../src/rng';
import {
  newBrain,
  provoke,
  stepBrain,
  warningOf,
  type BrainWorld,
  type Warning,
} from '../src/slimeBrain';

// The red warning on the ground before a monster's blow (systems_design.md section 5: an ordinary
// blow at least 0.6 s ahead, a boss's big move at least 0.9 s), filling in until the blow lands.

const open: BrainWorld = {
  rng: seeded(3),
  move: (x, z, dx, dz) => [x + dx, z + dz],
  allowed: () => true,
};
const DT = 1 / 60;
type Brain = ReturnType<typeof newBrain>;

/** run until a blow lands; returns how long the warning showed before it, and what it was */
function warnedFor(b: Brain, player: { x: number; z: number }, limit = 10) {
  let shown = 0;
  let last: Warning | null = null;
  const fills: number[] = [];
  for (let t = 0; t < limit; t += DT) {
    stepBrain(b, DT, player, open);
    if (b.struck) return { shown, last, fills };
    const w = warningOf(b);
    if (w) {
      shown += DT;
      last = w;
      fills.push(w.fill);
    } else shown = 0;
  }
  return { shown: -1, last, fills };
}

describe('warnings before a blow', () => {
  it('a calm slime shows no warning (it never hurts)', () => {
    const b = newBrain(0, 0);
    for (let t = 0; t < 3; t += DT) {
      stepBrain(b, DT, { x: 1, z: 0 }, open);
      expect(warningOf(b)).toBeNull();
    }
  });

  it('an angry slime rings itself red for at least attack.warn before every blow', () => {
    const spec = monster(DEFAULT_SPECIES);
    const b = newBrain(0, 0, 0, spec);
    provoke(b);
    for (let n = 0; n < 3; n++) {
      const r = warnedFor(b, { x: 1, z: 0 });
      expect(r.shown).toBeGreaterThanOrEqual(spec.attack.warn - DT);
      expect(r.last).toMatchObject({ kind: 'blow', radius: spec.attack.reach, length: 0 });
      // the red fills in as the blow comes
      expect(r.fills[0]!).toBeLessThan(0.1);
      expect(r.last!.fill).toBeGreaterThan(0.9);
      for (let i = 1; i < r.fills.length; i++)
        expect(r.fills[i]!).toBeGreaterThanOrEqual(r.fills[i - 1]!);
    }
  });

  it('a quick slime holds its wind-up so the warning still shows long enough', () => {
    const mini = monster('slime_mini');
    expect(mini.attack.strikeAt / mini.pace).toBeLessThan(mini.attack.warn);
    const b = newBrain(0, 0, 0, mini);
    provoke(b);
    const r = warnedFor(b, { x: 0.8, z: 0 });
    expect(r.shown).toBeGreaterThanOrEqual(mini.attack.warn - DT);
  });

  it("a boss's slam rings its whole reach, and its charge marks the lane it will run", () => {
    const boss = monster('boss_tide_regent');
    const slam = boss.specials.slam!;
    const b = newBrain(0, 0, 0, boss);
    provoke(b);
    b.cool.charge = 99;
    b.cool.slam = 0;
    const r = warnedFor(b, { x: 3, z: 0 });
    expect(r.last).toMatchObject({ kind: 'slam', radius: slam.radius });
    expect(r.shown).toBeGreaterThanOrEqual(slam.strikeAt - DT * 2);
    // after it lands the ring is gone
    expect(warningOf(b)).toBeNull();

    const charge = boss.specials.charge!;
    const c = newBrain(0, 0, 0, boss);
    provoke(c);
    c.cool.slam = 99;
    c.cool.charge = 0;
    let lane: Warning | null = null;
    for (let t = 0; t < 1 && !lane; t += DT) {
      stepBrain(c, DT, { x: 0, z: 7 }, open);
      lane = warningOf(c);
    }
    expect(lane).toMatchObject({ kind: 'charge', radius: charge.reach });
    // pointing at the player, as long as the run
    expect(lane!.heading).toBeCloseTo(0, 1);
    expect(lane!.length).toBeCloseTo(
      charge.speed * (charge.dashEnd - charge.dashStart) + charge.reach,
      1,
    );
    // the lane shows from the crouch until the run, at least warnSpecial ahead of it
    let seen = DT;
    while (c.special && warningOf(c)?.kind === 'charge') {
      stepBrain(c, DT, { x: 0, z: 7 }, open);
      seen += DT;
    }
    expect(seen).toBeGreaterThanOrEqual(charge.dashStart);
    expect(warningOf(c)?.kind).not.toBe('charge');
  });
});
