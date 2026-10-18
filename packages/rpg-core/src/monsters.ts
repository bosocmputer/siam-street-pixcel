// Every kind of monster and its numbers (config/monsters.json). A species lists only what is
// different from `base`, so a new one is a few lines of data. No three.js here.

import monstersJson from '../config/monsters.json';
import { ConfigError, num, obj } from './config';
import type { DropSpec } from './drops';
import { ITEMS, hexColor } from './items';
import type { Element } from './skills';

export interface VitalTimes {
  hurt: number;
  melt: number;
  respawn: number;
  grow: number;
}

/** A boss's rush: it crouches, springs at the player in a straight line and slams into them. */
export interface ChargeSpec {
  /** name of the animation in the model */
  clip: string;
  /** only used when the player is between min and max metres away */
  min: number;
  max: number;
  /** seconds of clip time when the dash starts and ends; before that it crouches and aims */
  dashStart: number;
  dashEnd: number;
  /** seconds the whole move lasts (the clip's length) */
  length: number;
  /** metres per second while dashing */
  speed: number;
  damage: number;
  /** a player this close to it while dashing is hit (once) */
  reach: number;
  /** seconds before it may be used again */
  cooldown: number;
}

/** A boss's ground slam: it rears up and brings its arms down, hurting everything round it. */
export interface SlamSpec {
  clip: string;
  /** seconds of clip time when the blow lands */
  strikeAt: number;
  length: number;
  /** a player within this many metres when it lands is hit */
  radius: number;
  damage: number;
  cooldown: number;
}

export interface MonsterSpec {
  id: string;
  /** which model it is drawn with (an id in public/assets.json) */
  model: string;
  /** voice pitch, 1 = by its size; below 1 is deeper */
  pitch: number;
  /** how much a skill's push-back moves it (1 = normal, a heavy boss barely moves) */
  knock: number;
  /** moves only some monsters have; null = it does not have that one */
  specials: { charge: ChargeSpec | null; slam: SlamSpec | null };
  hp: number;
  vitals: VitalTimes;
  wander: number;
  exp: number;
  scale: number;
  /** body colour 0xrrggbb, or null to keep the model's own */
  tint: number | null;
  pace: number;
  stride: number;
  radius: number;
  takes: Record<Element, number>;
  near: { watch: number; lunge: number; forget: number };
  attack: { damage: number; reach: number; cycle: number; strikeAt: number };
  anger: { time: number; leash: number };
  drops: DropSpec[];
}

type Obj = Record<string, unknown>;
const isPlain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Lay a species' own settings over the base: groups merge one level down, the rest replace. */
function merge(base: Obj, over: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(over))
    out[k] = isPlain(v) && isPlain(base[k]) ? { ...(base[k] as Obj), ...v } : v;
  return out;
}

function readCharge(raw: unknown, w: string): ChargeSpec | null {
  if (raw === null) return null;
  const c = obj(raw, w);
  if (typeof c.clip !== 'string' || c.clip === '')
    throw new ConfigError(`${w}.clip: expected the name of an animation`);
  const spec: ChargeSpec = {
    clip: c.clip,
    min: num(c, 'min', w),
    max: num(c, 'max', w),
    dashStart: num(c, 'dashStart', w),
    dashEnd: num(c, 'dashEnd', w),
    length: num(c, 'length', w, 0.1),
    speed: num(c, 'speed', w),
    damage: num(c, 'damage', w),
    reach: num(c, 'reach', w),
    cooldown: num(c, 'cooldown', w),
  };
  if (spec.max <= spec.min) throw new ConfigError(`${w}: expected max to be more than min`);
  if (!(spec.dashStart < spec.dashEnd && spec.dashEnd <= spec.length))
    throw new ConfigError(`${w}: expected dashStart < dashEnd ≤ length`);
  return spec;
}

function readSlam(raw: unknown, w: string): SlamSpec | null {
  if (raw === null) return null;
  const c = obj(raw, w);
  if (typeof c.clip !== 'string' || c.clip === '')
    throw new ConfigError(`${w}.clip: expected the name of an animation`);
  const spec: SlamSpec = {
    clip: c.clip,
    strikeAt: num(c, 'strikeAt', w),
    length: num(c, 'length', w, 0.1),
    radius: num(c, 'radius', w, 0.1),
    damage: num(c, 'damage', w),
    cooldown: num(c, 'cooldown', w),
  };
  if (spec.strikeAt >= spec.length) throw new ConfigError(`${w}: expected strikeAt < length`);
  return spec;
}

function resolve(id: string, o: Obj, itemIds: readonly string[]): MonsterSpec {
  const w = `monsters.${id}`;
  const part = (key: string) => obj(o[key], `${w}.${key}`);
  const near = part('near'),
    attack = part('attack'),
    anger = part('anger'),
    takes = part('takes');
  if (!Array.isArray(o.drops)) throw new ConfigError(`${w}.drops: expected a list`);
  const drops = o.drops.map((raw, i): DropSpec => {
    const dw = `${w}.drops[${i}]`;
    const d = obj(raw, dw);
    if (typeof d.item !== 'string' || !itemIds.includes(d.item))
      throw new ConfigError(`${dw}.item: no item called ${JSON.stringify(d.item)}`);
    const chance = num(d, 'chance', dw);
    const min = num(d, 'min', dw, 1),
      max = num(d, 'max', dw, 1);
    if (chance > 1) throw new ConfigError(`${dw}.chance: expected 0..1, got ${chance}`);
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min)
      throw new ConfigError(`${dw}: min and max must be whole numbers with max at least min`);
    return { item: d.item, chance, min, max };
  });
  const specials = part('specials');
  if (typeof o.model !== 'string' || o.model === '')
    throw new ConfigError(`${w}.model: expected the id of a model`);
  const spec: MonsterSpec = {
    id,
    model: o.model,
    pitch: num(o, 'pitch', w, 0.1),
    knock: num(o, 'knock', w),
    specials: {
      charge: readCharge(specials.charge, `${w}.specials.charge`),
      slam: readSlam(specials.slam, `${w}.specials.slam`),
    },
    hp: num(o, 'hp', w, 1),
    vitals: {
      hurt: num(o, 'hurt', w),
      melt: num(o, 'melt', w),
      respawn: num(o, 'respawn', w),
      grow: num(o, 'grow', w),
    },
    wander: num(o, 'wander', w),
    exp: num(o, 'exp', w),
    scale: num(o, 'scale', w, 0.1),
    tint: o.tint === null ? null : hexColor(o.tint, `${w}.tint`),
    pace: num(o, 'pace', w, 0.1),
    stride: num(o, 'stride', w, 0.1),
    radius: num(o, 'radius', w, 0.05),
    takes: { fire: num(takes, 'fire', `${w}.takes`), water: num(takes, 'water', `${w}.takes`) },
    near: {
      watch: num(near, 'watch', `${w}.near`),
      lunge: num(near, 'lunge', `${w}.near`),
      forget: num(near, 'forget', `${w}.near`),
    },
    attack: {
      damage: num(attack, 'damage', `${w}.attack`),
      reach: num(attack, 'reach', `${w}.attack`),
      cycle: num(attack, 'cycle', `${w}.attack`, 0.1),
      strikeAt: num(attack, 'strikeAt', `${w}.attack`),
    },
    anger: { time: num(anger, 'time', `${w}.anger`), leash: num(anger, 'leash', `${w}.anger`) },
    drops,
  };
  if (spec.attack.strikeAt >= spec.attack.cycle)
    throw new ConfigError(`${w}.attack.strikeAt must be inside the attack cycle`);
  if (spec.near.lunge > spec.near.watch || spec.near.watch > spec.near.forget)
    throw new ConfigError(`${w}.near: expected lunge ≤ watch ≤ forget`);
  return spec;
}

/** Read and check config/monsters.json. */
export function readMonsters(
  raw: unknown,
  itemIds: readonly string[] = Object.keys(ITEMS),
): {
  hop: { cycle: number; liftOff: number; land: number; distance: number };
  species: Record<string, MonsterSpec>;
} {
  const root = obj(raw, 'monsters.json');
  const hop = obj(obj(root.body, 'monsters.body').hop, 'monsters.body.hop');
  const w = 'monsters.body.hop';
  const body = {
    cycle: num(hop, 'cycle', w, 0.01),
    liftOff: num(hop, 'liftOff', w),
    land: num(hop, 'land', w),
    distance: num(hop, 'distance', w),
  };
  if (body.land <= body.liftOff || body.land > body.cycle)
    throw new ConfigError(`${w}: expected liftOff < land ≤ cycle`);
  const base = obj(root.base, 'monsters.base');
  const list = obj(root.species, 'monsters.species');
  const species: Record<string, MonsterSpec> = {};
  for (const id of Object.keys(list))
    species[id] = resolve(id, merge(base, obj(list[id], `monsters.${id}`)), itemIds);
  if (Object.keys(species).length === 0) throw new ConfigError('monsters.json: no species');
  return { hop: body, species };
}

const CONFIG = readMonsters(monstersJson);

/** Timing of the slime model's Jumping clip: it leaves the ground at liftOff and lands at land. */
export const HOP = CONFIG.hop;
export const MONSTERS: Readonly<Record<string, MonsterSpec>> = CONFIG.species;
/** The plain slime, which a brain uses when no species is given. */
export const DEFAULT_SPECIES = 'slime_water';

/** One species by id; an id that is not in the config is a mistake in the code or config. */
export function monster(id: string): MonsterSpec {
  const m = MONSTERS[id];
  if (!m) throw new ConfigError(`unknown monster: ${id}`);
  return m;
}
