import { describe, expect, it } from 'vitest';
import itemsJson from '../config/items.json';
import { rollDrops, spawnPickups, stepPickups, type DropSpec, type Pickup } from '../src/drops';
import {
  ITEMS,
  MAX_STACK,
  PICKUP,
  addItem,
  countOf,
  item,
  readItems,
  type Inventory,
} from '../src/items';
import { ConfigError } from '../src/config';
import { seeded } from '../src/rng';

describe('items', () => {
  it('reads the real items, each with a colour and a size', () => {
    expect(Object.keys(ITEMS)).toEqual(['gel_water', 'gel_fire', 'gel_lime', 'gel_core']);
    for (const i of Object.values(ITEMS)) {
      expect(i.color).toBeGreaterThan(0);
      expect(i.size).toBeGreaterThan(0);
      expect(i.model).toBeNull();
    }
    expect(item('gel_core').id).toBe('gel_core');
    expect(() => item('gold')).toThrow(/unknown item/);
  });

  it('refuses mistakes', () => {
    type Cfg = {
      items: Record<string, { color: unknown; kind: unknown; model: unknown }>;
      pickup: { life: unknown };
    };
    const bad = (change: (c: Cfg) => void) => {
      const c = structuredClone(itemsJson) as unknown as Cfg;
      change(c);
      return () => readItems(c);
    };
    expect(bad((c) => (c.items.gel_water!.color = 'blue'))).toThrow(/items.gel_water.color/);
    expect(bad((c) => (c.items.gel_water!.kind = 'sword'))).toThrow(/kind/);
    expect(bad((c) => (c.items.gel_water!.model = 7))).toThrow(/model/);
    expect(bad((c) => (c.items = {}))).toThrow(/no items/);
    expect(bad((c) => (c.pickup.life = 0))).toThrow(/items.pickup.life/);
    expect(() => readItems(null)).toThrow(ConfigError);
    // a modelled item is fine
    expect(
      readItems({ ...itemsJson, items: { a: { ...itemsJson.items.gel_water, model: 'jelly' } } })
        .items.a!.model,
    ).toBe('jelly');
  });
});

describe('the bag', () => {
  it('adds up, stops at a full stack, and ignores nonsense counts', () => {
    const bag: Inventory = {};
    expect(addItem(bag, 'gel_water', 3)).toBe(3);
    expect(addItem(bag, 'gel_water', 2)).toBe(2);
    expect(countOf(bag, 'gel_water')).toBe(5);
    expect(countOf(bag, 'gel_fire')).toBe(0);
    expect(addItem(bag, 'gel_water', MAX_STACK)).toBe(MAX_STACK - 5);
    expect(countOf(bag, 'gel_water')).toBe(MAX_STACK);
    expect(addItem(bag, 'gel_water', 1)).toBe(0);
    expect(addItem(bag, 'gel_fire', -4)).toBe(0);
    expect(addItem(bag, 'gel_fire', 2.9)).toBe(2);
    expect(() => addItem(bag, 'gold', 1)).toThrow(/unknown item/);
  });
});

describe('rolling drops', () => {
  const table: DropSpec[] = [
    { item: 'gel_water', chance: 1, min: 2, max: 4 },
    { item: 'gel_core', chance: 0.25, min: 1, max: 1 },
  ];

  it('gives the same drops for the same seed', () => {
    const a = rollDrops(table, seeded(5));
    const b = rollDrops(table, seeded(5));
    expect(b).toEqual(a);
  });

  it('a sure drop always comes, within its count, and a rare one only sometimes', () => {
    const rng = seeded(11);
    let cores = 0;
    for (let i = 0; i < 400; i++) {
      const got = rollDrops(table, rng);
      const water = got.find((d) => d.item === 'gel_water')!;
      expect(water.count).toBeGreaterThanOrEqual(2);
      expect(water.count).toBeLessThanOrEqual(4);
      if (got.some((d) => d.item === 'gel_core')) cores++;
    }
    expect(cores).toBeGreaterThan(60);
    expect(cores).toBeLessThan(140); // about a quarter of 400
  });

  it('never drops at chance 0, and merges the same item listed twice', () => {
    expect(rollDrops([{ item: 'gel_fire', chance: 0, min: 1, max: 1 }], seeded(1))).toEqual([]);
    expect(rollDrops([], seeded(1))).toEqual([]);
    const two = rollDrops(
      [
        { item: 'gel_fire', chance: 1, min: 1, max: 1 },
        { item: 'gel_fire', chance: 1, min: 2, max: 2 },
      ],
      seeded(1),
    );
    expect(two).toEqual([{ item: 'gel_fire', count: 3 }]);
  });
});

describe('drops on the ground', () => {
  const drops = [
    { item: 'gel_water', count: 2 },
    { item: 'gel_core', count: 1 },
    { item: 'gel_fire', count: 1 },
  ];
  const at = { x: 10, z: -5 };

  it('lands them in a ring round where the monster fell, numbered one after another', () => {
    const list = spawnPickups(drops, at, seeded(3), 100);
    expect(list.map((p) => p.uid)).toEqual([100, 101, 102]);
    expect(list.map((p) => p.item)).toEqual(['gel_water', 'gel_core', 'gel_fire']);
    for (const p of list) {
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      expect(d).toBeGreaterThanOrEqual(PICKUP.scatter * 0.5 - 1e-9);
      expect(d).toBeLessThanOrEqual(PICKUP.scatter + 1e-9);
      expect([p.fromX, p.fromZ]).toEqual([at.x, at.z]);
      expect(p.age).toBe(0);
    }
    // they do not all pile in one place
    expect(new Set(list.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size).toBe(3);
    expect(spawnPickups([], at, seeded(3), 0)).toEqual([]);
  });

  const one = (x: number, z: number): Pickup => ({
    uid: 1,
    item: 'gel_water',
    count: 1,
    x,
    z,
    fromX: x,
    fromZ: z,
    age: 0,
  });

  it('waits until it has landed, then is drawn in and collected', () => {
    const p = one(3, 0);
    const player = { x: 0, z: 0 };
    // still flying out: nothing happens even right next to the player
    let r = stepPickups([p], PICKUP.popTime / 2, player);
    expect(r.got).toEqual([]);
    expect(p.x).toBe(3);
    // landed, within magnet range: it slides closer
    r = stepPickups(r.left, PICKUP.popTime, player);
    expect(p.x).toBeLessThan(3);
    const gotAt = [];
    for (let t = 0; t < 3 && r.left.length; t += 1 / 60) {
      r = stepPickups(r.left, 1 / 60, player);
      if (r.got.length) gotAt.push(t);
    }
    expect(gotAt).toHaveLength(1);
    expect(r.left).toEqual([]);
  });

  it('is left alone out of range, and by a player who is down', () => {
    const far = one(PICKUP.magnetRange + 2, 0);
    let r = stepPickups([far], 1, { x: 0, z: 0 });
    expect(far.x).toBe(PICKUP.magnetRange + 2);
    expect(r.got).toEqual([]);
    const near = one(1, 0);
    r = stepPickups([near], 5, { x: 0, z: 0, down: true });
    expect(r.got).toEqual([]);
    expect(near.x).toBe(1);
  });

  it('is drawn in faster the closer it is', () => {
    const a = one(3, 0),
      b = one(1.5, 0);
    a.age = b.age = PICKUP.popTime; // already landed
    stepPickups([a, b], 0.05, { x: 0, z: 0 });
    expect(3 - a.x).toBeGreaterThan(0);
    expect(3 - a.x).toBeLessThan(1.5 - b.x);
  });

  it('is gone after lying too long', () => {
    const p = one(50, 0);
    expect(stepPickups([p], PICKUP.life - 1, { x: 0, z: 0 }).left).toHaveLength(1);
    expect(stepPickups([p], 2, { x: 0, z: 0 }).left).toEqual([]);
  });
});
