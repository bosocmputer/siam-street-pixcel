import { describe, expect, it } from 'vitest';
import { BINDINGS, moveFrom, readBindings, type HoldAction } from '../src/actions';
import { advance, newClock } from '../src/clock';
import { ConfigError } from '../src/config';
import { RIG, checkRig, readRig, type ModelFacts } from '../src/rig';
import { DEFAULT_CAMERA, SAVE_VERSION, decodeSave, encodeSave, type SaveData } from '../src/save';
import { MAX_STACK } from '../src/items';
import { nextScreen, worldRuns } from '../src/screens';
import { readSkills } from '../src/skills';
import { readMonsters } from '../src/monsters';
import monstersJson from '../config/monsters.json';
import rigJson from '../config/rig.json';
import skillsJson from '../config/skills.json';

describe('fixed clock', () => {
  it('runs whole steps and carries the rest to the next frame', () => {
    const c = newClock(0.1, 5);
    expect(advance(c, 0.25)).toBe(2);
    expect(c.carry).toBeCloseTo(0.05);
    expect(advance(c, 0.05)).toBe(1);
    expect(c.carry).toBeCloseTo(0);
    expect(advance(c, -1)).toBe(0);
  });

  it('drops a very long pause instead of replaying all of it', () => {
    const c = newClock(1 / 60, 6);
    expect(advance(c, 3)).toBe(6);
    expect(c.carry).toBe(0);
  });

  it('gives the same number of steps however the time is cut into frames', () => {
    const a = newClock(),
      b = newClock();
    let na = 0,
      nb = 0;
    for (let i = 0; i < 60; i++) na += advance(a, 1 / 30);
    for (let i = 0; i < 144; i++) nb += advance(b, 1 / 72);
    expect(na).toBe(120);
    expect(nb).toBe(120);
  });
});

describe('controls', () => {
  it('maps keys from config to actions', () => {
    expect(BINDINGS.hold.get('KeyW')).toBe('forward');
    expect(BINDINGS.hold.get('ArrowLeft')).toBe('left');
    expect(BINDINGS.press.get('KeyQ')).toBe('skill1');
    expect(BINDINGS.press.get('Tab')).toBe('target');
  });

  it('refuses a key used twice or an action with no key', () => {
    const base = { hold: { forward: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'] } };
    const press = {
      skill1: ['KeyQ'],
      skill2: ['KeyE'],
      target: ['Tab'],
      walk: ['Digit1'],
      run: ['Digit2'],
    };
    expect(() => readBindings({ ...base, press: { ...press, bike: ['KeyW'] } })).toThrow(/twice/);
    expect(() => readBindings({ ...base, press: { ...press, bike: [] } })).toThrow(/at least one/);
    expect(() => readBindings({ ...base, press })).toThrow(ConfigError);
  });

  it('turns held keys into a walking direction no longer than 1', () => {
    const held = (...a: HoldAction[]) => new Set(a);
    expect(moveFrom(held())).toEqual({ forward: 0, right: 0 });
    expect(moveFrom(held('forward', 'back'))).toEqual({ forward: 0, right: 0 });
    const d = moveFrom(held('forward', 'right'));
    expect(Math.hypot(d.forward, d.right)).toBeCloseTo(1);
    expect(d.forward).toBeCloseTo(d.right);
  });
});

describe('save', () => {
  const good: SaveData = {
    version: SAVE_VERSION,
    savedAt: 1_700_000_000_000,
    player: { x: 120.5, z: -40, heading: 1.2 },
    settings: { mode: 'run', scale: 0.5, labels: false, haze: true, camera: 'back' },
    stats: { level: 4, exp: 12, hp: 80.5, energy: 33 },
    items: { gel_water: 5, gel_core: 1 },
  };

  it('reads back exactly what was saved', () => {
    expect(decodeSave(encodeSave(good))).toEqual(good);
  });

  it('a save from before levels comes back at level 1, with an empty bag and the new camera', () => {
    const old: Record<string, unknown> = { ...good, version: 1 };
    delete old.stats;
    delete old.items;
    old.settings = { mode: 'run', scale: 0.5, labels: false, haze: true };
    const fresh = { level: 1, exp: 0, hp: 100, energy: 100 };
    expect(decodeSave(JSON.stringify(old), fresh)).toEqual({
      ...good,
      version: SAVE_VERSION,
      stats: fresh,
      items: {},
      settings: { ...good.settings, camera: DEFAULT_CAMERA },
    });
    expect(decodeSave(JSON.stringify(old))!.stats.level).toBe(1);
  });

  it('a version 2 save keeps its stats and gets an empty bag', () => {
    const v2: Record<string, unknown> = { ...good, version: 2 };
    delete v2.items;
    v2.settings = { mode: 'run', scale: 0.5, labels: false, haze: true };
    const got = decodeSave(JSON.stringify(v2))!;
    expect(got.stats).toEqual(good.stats);
    expect(got.items).toEqual({});
    expect(got.settings.camera).toBe(DEFAULT_CAMERA);
  });

  it('drops items that are no longer in the game and empty stacks, but refuses a broken bag', () => {
    const keep = (items: unknown) => decodeSave(JSON.stringify({ ...good, items }));
    expect(keep({ gel_water: 3, old_thing: 9, gel_fire: 0 })!.items).toEqual({ gel_water: 3 });
    expect(keep([1, 2])).toBeNull();
    expect(keep({ gel_water: 1.5 })).toBeNull();
    expect(keep({ gel_water: -1 })).toBeNull();
    expect(keep({ gel_water: MAX_STACK + 1 })).toBeNull();
    expect(keep({ gel_water: 'many' })).toBeNull();
    expect(
      decodeSave(JSON.stringify({ ...good, settings: { ...good.settings, camera: 'sky' } })),
    ).toBeNull();
  });

  it('refuses broken stats', () => {
    const bad = (stats: unknown) => decodeSave(JSON.stringify({ ...good, stats }));
    expect(bad(undefined)).toBeNull();
    expect(bad({ ...good.stats, level: 0 })).toBeNull();
    expect(bad({ ...good.stats, level: 2.5 })).toBeNull();
    expect(bad({ ...good.stats, hp: -1 })).toBeNull();
    expect(bad({ ...good.stats, exp: 'x' })).toBeNull();
  });

  it('starts fresh from a missing, broken, newer or out-of-range save', () => {
    expect(decodeSave(null)).toBeNull();
    expect(decodeSave('{not json')).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, version: 99 }))).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, player: { ...good.player, x: 'a' } }))).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, player: { ...good.player, x: 1e9 } }))).toBeNull();
    expect(
      decodeSave(JSON.stringify({ ...good, settings: { ...good.settings, mode: 'fly' } })),
    ).toBeNull();
    expect(
      decodeSave(JSON.stringify({ ...good, settings: { ...good.settings, scale: 0.7 } })),
    ).toBeNull();
    expect(
      decodeSave(JSON.stringify({ ...good, settings: { ...good.settings, haze: 1 } })),
    ).toBeNull();
    expect(decodeSave(JSON.stringify([1, 2]))).toBeNull();
  });
});

describe('screens', () => {
  it('goes loading → intro → play, pauses while hidden and comes back', () => {
    expect(nextScreen('loading', 'loaded')).toBe('intro');
    expect(nextScreen('loading', 'loadFailed')).toBe('failed');
    expect(nextScreen('intro', 'start')).toBe('play');
    expect(nextScreen('play', 'hide')).toBe('paused');
    expect(nextScreen('paused', 'show')).toBe('play');
    // events that do not apply change nothing
    expect(nextScreen('intro', 'hide')).toBe('intro');
    expect(nextScreen('failed', 'start')).toBe('failed');
    expect(worldRuns('play')).toBe(true);
    expect(worldRuns('paused')).toBe(false);
  });
});

describe('config checks', () => {
  it('reads the real config files', () => {
    expect(readSkills(skillsJson).skills.fireball!.damage).toBeGreaterThan(0);
    expect(readMonsters(monstersJson).species.slime_water!.hp).toBe(100);
  });

  it('names the exact place of a bad number', () => {
    const broken = structuredClone(skillsJson) as unknown as {
      skills: { fireball: { speed: unknown } };
    };
    broken.skills.fireball.speed = 'fast';
    expect(() => readSkills(broken)).toThrow(/skills.fireball.speed/);
    expect(() => readSkills(null)).toThrow(ConfigError);
  });
});

describe('character rig', () => {
  /** a model that matches the rig exactly */
  const perfect = (): ModelFacts => ({
    nodes: [...RIG.joints, ...RIG.sockets].map((n) => ({ ...n, turned: false })),
    minY: 0,
    maxY: RIG.height,
    triangles: 4000,
    materials: 3,
    fileKB: 400,
    animations: 0,
    skinned: false,
  });

  it('the rig file is sound: 20 joints, 3 sockets, every parent listed first', () => {
    expect(RIG.joints).toHaveLength(20);
    expect(RIG.sockets.map((s) => s.name)).toEqual([
      'Socket_Head',
      'Socket_Hand_L',
      'Socket_Hand_R',
    ]);
    expect(() => readRig({ ...rigJson, joints: [...rigJson.joints].reverse() })).toThrow(
      /before its parent/,
    );
    expect(() =>
      readRig({ ...rigJson, joints: [{ name: 'Root', parent: null, at: [0, 0] }] }),
    ).toThrow(/at \[x, y, z\]/);
  });

  it('passes a model that matches', () => {
    expect(checkRig(perfect())).toEqual([]);
  });

  it('explains in Thai what to fix', () => {
    const m = perfect();
    m.nodes = m.nodes.filter((n) => n.name !== 'Socket_Hand_R');
    const hand = m.nodes.find((n) => n.name === 'Hand_L')!;
    hand.at = [0.3, 0.85, 0];
    hand.turned = true;
    m.nodes.find((n) => n.name === 'Head')!.parent = 'Chest';
    m.minY = -0.1;
    m.maxY = 1.9;
    m.triangles = 9000;
    m.materials = 6;
    m.fileKB = 2048;
    m.animations = 2;
    m.skinned = true;
    const issues = checkRig(m);
    const codes = issues.map((i) => i.code);
    for (const c of ['missing', 'parent', 'place', 'turned', 'ground', 'height', 'budget', 'extra'])
      expect(codes).toContain(c);
    expect(issues.find((i) => i.code === 'missing')!.th).toContain('Socket_Hand_R');
    expect(issues.find((i) => i.code === 'place')!.th).toContain('(0.26, 0.85, 0)');
  });

  it('allows a 2 cm slip in where a joint sits', () => {
    const m = perfect();
    m.nodes.find((n) => n.name === 'Head')!.at = [0, 1.535, 0];
    expect(checkRig(m)).toEqual([]);
  });
});
