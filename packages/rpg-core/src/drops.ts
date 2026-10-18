// What a beaten monster leaves behind, and what happens to it on the ground until it is picked
// up. The dice come from a seeded generator the app passes in, so the same seed gives the same
// drops, and a server can roll them instead later.

import { PICKUP, type PickupSpec } from './items';

export interface DropSpec {
  item: string;
  /** 0..1 */
  chance: number;
  min: number;
  max: number;
}

export interface Drop {
  item: string;
  count: number;
}

/** Roll a monster's drop table: each entry may drop, and drops a count between min and max. */
export function rollDrops(table: readonly DropSpec[], rng: () => number): Drop[] {
  const out = new Map<string, number>();
  for (const d of table) {
    if (rng() >= d.chance) continue;
    const count = d.min + Math.floor(rng() * (d.max - d.min + 1));
    out.set(d.item, (out.get(d.item) ?? 0) + count);
  }
  return [...out].map(([item, count]) => ({ item, count }));
}

/** A drop lying on the ground. */
export interface Pickup {
  uid: number;
  item: string;
  count: number;
  x: number;
  z: number;
  /** where it started, for the way it flies out */
  fromX: number;
  fromZ: number;
  /** seconds on the ground */
  age: number;
}

/** Lay drops out around where the monster fell, scattered in a ring; `uid` numbers them. */
export function spawnPickups(
  drops: readonly Drop[],
  at: { x: number; z: number },
  rng: () => number,
  uid: number,
  p: PickupSpec = PICKUP,
): Pickup[] {
  const turn = rng() * Math.PI * 2;
  return drops.map((d, i) => {
    // spread evenly round the ring, with a little wobble so they do not look placed
    const a = turn + (i / drops.length) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const r = p.scatter * (0.5 + rng() * 0.5);
    return {
      uid: uid + i,
      item: d.item,
      count: d.count,
      x: at.x + Math.sin(a) * r,
      z: at.z + Math.cos(a) * r,
      fromX: at.x,
      fromZ: at.z,
      age: 0,
    };
  });
}

/**
 * Move the drops on by dt. Once they have landed, any within magnet range slide towards the
 * player, faster the closer they get, and are collected on touching. A player who is down
 * collects nothing. Drops lying too long are gone. Mutates the drops and returns what was
 * collected; `left` is the drops still on the ground.
 */
export function stepPickups(
  list: Pickup[],
  dt: number,
  player: { x: number; z: number; down?: boolean },
  p: PickupSpec = PICKUP,
): { left: Pickup[]; got: Pickup[] } {
  const left: Pickup[] = [];
  const got: Pickup[] = [];
  for (const k of list) {
    k.age += dt;
    if (k.age > p.life) continue;
    if (!player.down && k.age >= p.popTime) {
      const dx = player.x - k.x,
        dz = player.z - k.z;
      const d = Math.hypot(dx, dz);
      if (d <= p.collectRange) {
        got.push(k);
        continue;
      }
      if (d < p.magnetRange) {
        const speed = 4 + (p.magnetSpeed - 4) * (1 - d / p.magnetRange);
        const step = Math.min(d, speed * dt);
        k.x += (dx / d) * step;
        k.z += (dz / d) * step;
      }
    }
    left.push(k);
  }
  return { left, got };
}
