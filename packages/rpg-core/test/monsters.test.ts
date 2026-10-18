import { describe, expect, it } from 'vitest';
import itemsJson from '../config/items.json';
import monstersJson from '../config/monsters.json';
import spawnsJson from '../config/spawns.json';
import { ConfigError } from '../src/config';
import { ITEMS } from '../src/items';
import { HOP, MONSTERS, monster, readMonsters } from '../src/monsters';
import { readSpawns, SPAWNS } from '../src/spawns';
import { newVitals, damage, stepVitals } from '../src/slimeBrain';

type Cfg = {
  body: { hop: Record<string, number> };
  base: Record<string, unknown>;
  species: Record<string, Record<string, unknown>>;
};
const copy = (): Cfg => structuredClone(monstersJson) as unknown as Cfg;
const ITEM_IDS = Object.keys(itemsJson.items);

describe('monsters', () => {
  it('has four kinds of slime, each different from the plain one', () => {
    expect(Object.keys(MONSTERS)).toEqual([
      'slime_water',
      'slime_fire',
      'slime_giant',
      'slime_mini',
    ]);
    const plain = monster('slime_water');
    expect(plain.scale).toBe(1);
    expect(plain.tint).toBeNull();
    expect(monster('slime_fire').takes).toEqual({ fire: 0.5, water: 1.5 });
    expect(monster('slime_giant').scale).toBeGreaterThan(1.5);
    expect(monster('slime_giant').hp).toBeGreaterThan(plain.hp * 2);
    expect(monster('slime_mini').scale).toBeLessThan(0.7);
    expect(monster('slime_mini').pace).toBeGreaterThan(1);
    expect(typeof monster('slime_fire').tint).toBe('number');
    expect(HOP.land).toBeGreaterThan(HOP.liftOff);
  });

  it('a species keeps what it does not change from the base, and merges groups one level down', () => {
    const fire = monster('slime_fire');
    // changed
    expect(fire.hp).toBe(80);
    expect(fire.attack.damage).toBe(10);
    // not changed: the rest of the attack group and the other numbers come from the base
    expect(fire.attack.reach).toBe(plainAttack().reach);
    expect(fire.near).toEqual(monster('slime_water').near);
    expect(fire.anger).toEqual(monster('slime_water').anger);
  });

  it('every drop names a real item, and every item is dropped by someone', () => {
    const dropped = new Set<string>();
    for (const m of Object.values(MONSTERS))
      for (const d of m.drops) {
        expect(ITEMS[d.item]).toBeDefined();
        dropped.add(d.item);
      }
    expect([...dropped].sort()).toEqual(Object.keys(ITEMS).sort());
  });

  it('a monster that is beaten melts, then grows back with its own full health', () => {
    const giant = monster('slime_giant');
    const v = newVitals(giant);
    expect(v.max).toBe(giant.hp);
    expect(damage(v, giant.hp)).toBe('defeated');
    expect(stepVitals(v, giant.vitals.melt + 0.01)).toBe('gone');
    expect(stepVitals(v, giant.vitals.respawn + 0.01)).toBe('growing');
    expect(v.hp).toBe(giant.hp);
  });

  it('refuses mistakes, naming the exact place', () => {
    const bad = (change: (c: Cfg) => void, items = ITEM_IDS) => {
      const c = copy();
      change(c);
      return () => readMonsters(c, items);
    };
    expect(bad((c) => (c.species.slime_fire!.hp = -5))).toThrow(/monsters.slime_fire.hp/);
    expect(bad((c) => (c.species.slime_fire!.tint = 'orange'))).toThrow(/monsters.slime_fire.tint/);
    expect(
      bad((c) => (c.species.slime_fire!.drops = [{ item: 'gold', chance: 1, min: 1, max: 1 }])),
    ).toThrow(/no item called "gold"/);
    expect(
      bad((c) => (c.species.slime_fire!.drops = [{ item: 'gel_fire', chance: 2, min: 1, max: 1 }])),
    ).toThrow(/chance/);
    expect(
      bad((c) => (c.species.slime_fire!.drops = [{ item: 'gel_fire', chance: 1, min: 3, max: 2 }])),
    ).toThrow(/min and max/);
    expect(
      bad(
        (c) => (c.species.slime_fire!.drops = [{ item: 'gel_fire', chance: 1, min: 1.5, max: 2 }]),
      ),
    ).toThrow(/whole numbers/);
    expect(bad((c) => (c.species.slime_mini!.attack = { strikeAt: 9 }))).toThrow(/strikeAt/);
    expect(bad((c) => (c.species.slime_mini!.near = { lunge: 9 }))).toThrow(
      /lunge ≤ watch ≤ forget/,
    );
    expect(bad((c) => (c.body.hop.land = 0.1))).toThrow(/liftOff < land/);
    expect(bad((c) => (c.species.slime_mini!.drops = 'lots'))).toThrow(/drops: expected a list/);
    expect(bad((c) => (c.species = {}))).toThrow(/no species/);
    expect(() => readMonsters(null)).toThrow(ConfigError);
    expect(() => monster('dragon')).toThrow(/unknown monster/);
  });
});

function plainAttack() {
  return (monstersJson.base as { attack: { reach: number } }).attack;
}

describe('spawns', () => {
  it('puts a mix of kinds on the plaza, all known', () => {
    const plaza = SPAWNS.plaza!;
    expect(plaza).toHaveLength(6);
    expect(new Set(plaza.map((s) => s.species)).size).toBe(4);
    for (const s of plaza) expect(MONSTERS[s.species]).toBeDefined();
    // the first two are the plain slimes near the start
    expect(plaza[0]!.species).toBe('slime_water');
  });

  it('refuses mistakes', () => {
    const ids = Object.keys(MONSTERS);
    expect(() => readSpawns({ plaza: [{ species: 'dragon', at: [0, 0] }] }, ids)).toThrow(
      /no monster called "dragon"/,
    );
    expect(() => readSpawns({ plaza: [{ species: 'slime_water', at: [0] }] }, ids)).toThrow(
      /at: expected \[x, z\]/,
    );
    expect(() => readSpawns({ plaza: [] }, ids)).toThrow(/expected a list/);
    expect(() => readSpawns({ about: 'x' }, ids)).toThrow(/no zones/);
    expect(readSpawns(spawnsJson, ids).plaza).toHaveLength(6);
  });
});
