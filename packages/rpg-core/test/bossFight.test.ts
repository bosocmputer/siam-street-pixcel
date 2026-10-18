import { describe, expect, it } from 'vitest';
import { monster } from '../src/monsters';
import { seeded } from '../src/rng';
import { newBrain, provoke, stepBrain, type BrainWorld } from '../src/slimeBrain';

const BOSS = monster('boss_tide_regent');
const CHARGE = BOSS.specials.charge!;
const SLAM = BOSS.specials.slam!;

const open: BrainWorld = {
  rng: seeded(7),
  move: (x, z, dx, dz) => [x + dx, z + dz],
  allowed: () => true,
};

type Player = { x: number; z: number; down?: boolean };
const DT = 1 / 60;

/** step until `done` says so (or the time runs out); returns the seconds it took */
function until(
  b: ReturnType<typeof newBrain>,
  player: Player,
  done: () => boolean,
  world = open,
  limit = 20,
): number {
  let t = 0;
  for (; t < limit && !done(); t += DT) stepBrain(b, DT, player, world);
  return t;
}

describe('a boss with special moves', () => {
  it('a calm boss only threatens, even with a special move ready', () => {
    const b = newBrain(0, 0, 0, BOSS);
    const player = { x: 3, z: 0 };
    for (let t = 0; t < 30; t += DT) {
      stepBrain(b, DT, player, open);
      expect(b.special).toBeNull();
      expect(b.struck).toBe(false);
    }
  });

  it('an angry boss rears up and slams the ground, hurting a player who stays close', () => {
    const b = newBrain(0, 0, 0, BOSS);
    provoke(b);
    const player = { x: 3, z: 0 };
    // it does not start at once
    stepBrain(b, DT, player, open);
    expect(b.special).toBeNull();
    const wait = until(b, player, () => b.special?.kind === 'slam');
    expect(wait).toBeGreaterThan(2);
    expect(b.mode).toBe('slam');
    // the blow lands at strikeAt: the shock is felt and the player is hurt for the slam's damage
    let shocked = 0;
    let hurt = 0;
    let when = 0;
    for (let t = 0; b.special && t < 5; t += DT) {
      stepBrain(b, DT, player, open);
      if (b.shock) {
        shocked++;
        when = b.special?.t ?? SLAM.length;
      }
      if (b.struck) {
        hurt++;
        expect(b.blow).toBe(SLAM.damage);
      }
    }
    expect([shocked, hurt]).toEqual([1, 1]);
    expect(when).toBeGreaterThanOrEqual(SLAM.strikeAt);
    expect(when).toBeLessThan(SLAM.strikeAt + 0.05);
    // done: it is watching again, and the move has to cool down
    expect(b.special).toBeNull();
    expect(b.mode).toBe('watch');
    expect(b.cool.slam).toBeGreaterThan(SLAM.cooldown - 0.1);
  });

  it('a player who gets away in time is not hurt by the slam, though the ground still shakes', () => {
    const b = newBrain(0, 0, 0, BOSS);
    provoke(b);
    const player = { x: 3, z: 0 };
    until(b, player, () => b.special?.kind === 'slam');
    player.x = SLAM.radius + 2; // ran off while it was rearing up
    let shocked = false;
    let hurt = false;
    for (let t = 0; b.special && t < 5; t += DT) {
      stepBrain(b, DT, player, open);
      shocked ||= b.shock;
      hurt ||= b.struck;
    }
    expect([shocked, hurt]).toEqual([true, false]);
  });

  it('a charge crouches, aims, then dashes in a straight line at where the player was', () => {
    const b = newBrain(0, 0, 0, BOSS);
    provoke(b);
    // 7 m away: too far for a slam, in range for a charge
    const player = { x: 0, z: 7 };
    until(b, player, () => b.special?.kind === 'charge');
    expect(b.mode).toBe('charge');
    // while crouching it stays put and turns to follow the player
    const start = [b.x, b.z];
    player.x = 2;
    for (let t = 0; t < CHARGE.dashStart - 0.1; t += DT) stepBrain(b, DT, player, open);
    expect([b.x, b.z]).toEqual(start);
    expect(b.heading).toBeCloseTo(Math.atan2(player.x - b.x, player.z - b.z), 1);
    // the player steps aside after it has committed: it runs on in the line it chose
    for (let t = 0; b.special!.t < CHARGE.dashStart + 0.02 && t < 5; t += DT)
      stepBrain(b, DT, player, open);
    const aimed = b.heading;
    player.x = 12;
    let blows = 0;
    let midDash = NaN;
    for (let t = 0; b.special && t < 5; t += DT) {
      stepBrain(b, DT, player, open);
      if (b.struck) blows++;
      if (b.special && b.special.t > CHARGE.dashStart + 0.1 && Number.isNaN(midDash))
        midDash = b.heading;
    }
    expect(midDash).toBeCloseTo(aimed, 1);
    // it covered about dash time × speed, in the aimed direction
    const ran = Math.hypot(b.x - start[0]!, b.z - start[1]!);
    expect(ran).toBeCloseTo((CHARGE.dashEnd - CHARGE.dashStart) * CHARGE.speed, 0);
    expect(Math.atan2(b.x - start[0]!, b.z - start[1]!)).toBeCloseTo(aimed, 1);
    expect(blows).toBe(0);
    expect(b.mode).toBe('watch');
    expect(b.cool.charge).toBeGreaterThan(CHARGE.cooldown - 0.1);
  });

  it('a charge that catches the player hurts them once, for the charge damage', () => {
    const b = newBrain(0, 0, 0, BOSS);
    provoke(b);
    const player = { x: 0, z: 6 };
    until(b, player, () => b.special?.kind === 'charge');
    let blows = 0;
    let blow = 0;
    for (let t = 0; b.special && t < 5; t += DT) {
      stepBrain(b, DT, player, open);
      if (b.struck) {
        blows++;
        blow = b.blow;
      }
    }
    expect([blows, blow]).toEqual([1, CHARGE.damage]);
  });

  it('a charge that runs into a wall or off the square stops there', () => {
    const wall: BrainWorld = { ...open, move: (x, z) => [x, z] };
    const a = newBrain(0, 0, 0, BOSS);
    provoke(a);
    const player = { x: 0, z: 7 };
    until(a, player, () => a.special?.kind === 'charge', wall);
    until(a, player, () => a.special === null, wall);
    expect([a.x, a.z]).toEqual([0, 0]);
    expect(a.mode).toBe('watch');

    const edge: BrainWorld = { ...open, allowed: (_x, z) => z < 1 };
    const c = newBrain(0, 0, 0, BOSS);
    provoke(c);
    until(c, player, () => c.special?.kind === 'charge', edge);
    until(c, player, () => c.special === null, edge);
    expect(c.z).toBeLessThan(CHARGE.speed * 0.2);
  });

  it('chooses by distance: a slam up close, a charge from further off, nothing out of range', () => {
    const near = newBrain(0, 0, 0, BOSS);
    near.cool = { charge: 0, slam: 0 };
    provoke(near);
    stepBrain(near, DT, { x: 2, z: 0 }, open);
    expect(near.special?.kind).toBe('slam');

    const mid = newBrain(0, 0, 0, BOSS);
    mid.cool = { charge: 0, slam: 0 };
    provoke(mid);
    stepBrain(mid, DT, { x: CHARGE.max - 1, z: 0 }, open);
    expect(mid.special?.kind).toBe('charge');

    const far = newBrain(0, 0, 0, BOSS);
    far.cool = { charge: 0, slam: 0 };
    provoke(far);
    stepBrain(far, DT, { x: CHARGE.max + 5, z: 0 }, open);
    expect(far.special).toBeNull();
    expect(far.mode).toBe('chase');
  });

  it('a player who is down ends the move and is left alone', () => {
    const b = newBrain(0, 0, 0, BOSS);
    provoke(b);
    const player: Player = { x: 3, z: 0 };
    until(b, player, () => b.special !== null);
    player.down = true;
    stepBrain(b, DT, player, open);
    expect(b.special).toBeNull();
    expect(b.anger).toBe(0);
  });

  it('an ordinary blow carries the monster’s own attack damage', () => {
    const b = newBrain(0, 0, 0, BOSS);
    b.cool = { charge: 99, slam: 99 };
    provoke(b);
    let blows = 0;
    for (let t = 0; t < 4; t += DT) {
      stepBrain(b, DT, { x: 4, z: 0 }, open);
      if (b.struck) {
        blows++;
        expect(b.blow).toBe(BOSS.attack.damage);
      }
    }
    expect(blows).toBeGreaterThan(1);
  });

  it('a monster without special moves never starts one', () => {
    const b = newBrain(0, 0);
    provoke(b);
    for (let t = 0; t < 20; t += DT) {
      stepBrain(b, DT, { x: 3, z: 0 }, open);
      expect(b.special).toBeNull();
    }
  });
});
