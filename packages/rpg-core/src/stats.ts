// The player's health, energy (the gauge skills use), level and experience. Numbers come from
// config/player.json.

import playerJson from '../config/player.json';
import { ConfigError, num, obj, strings } from './config';
import { SKILLS } from './skills';
import { attrBonus, baseAttrs, type Attrs } from './attributes';

export interface PlayerSpec {
  hp: { base: number; perLevel: number };
  energy: { base: number; perLevel: number; regen: number };
  hpRegen: { delay: number; perSecond: number };
  exp: { base: number; growth: number };
  maxLevel: number;
  damagePerLevel: number;
  invulnerable: number;
  downTime: number;
  slots: string[];
}

export function readPlayer(raw: unknown, skillIds = Object.keys(SKILLS)): PlayerSpec {
  const w = 'player';
  const o = obj(raw, 'player.json');
  const part = (key: string) => obj(o[key], `${w}.${key}`);
  const hp = part('hp'),
    energy = part('energy'),
    hpRegen = part('hpRegen'),
    exp = part('exp');
  const slots = strings(o.slots, `${w}.slots`);
  for (const s of slots)
    if (!skillIds.includes(s)) throw new ConfigError(`${w}.slots: no skill called ${s}`);
  return {
    hp: { base: num(hp, 'base', `${w}.hp`, 1), perLevel: num(hp, 'perLevel', `${w}.hp`) },
    energy: {
      base: num(energy, 'base', `${w}.energy`, 1),
      perLevel: num(energy, 'perLevel', `${w}.energy`),
      regen: num(energy, 'regen', `${w}.energy`),
    },
    hpRegen: {
      delay: num(hpRegen, 'delay', `${w}.hpRegen`),
      perSecond: num(hpRegen, 'perSecond', `${w}.hpRegen`),
    },
    exp: { base: num(exp, 'base', `${w}.exp`, 1), growth: num(exp, 'growth', `${w}.exp`) },
    maxLevel: num(o, 'maxLevel', w, 1),
    damagePerLevel: num(o, 'damagePerLevel', w),
    invulnerable: num(o, 'invulnerable', w),
    downTime: num(o, 'downTime', w),
    slots,
  };
}

export const PLAYER = readPlayer(playerJson);

export interface PlayerStats {
  level: number;
  /** experience towards the next level */
  exp: number;
  hp: number;
  energy: number;
  /** seconds since the player was last hit (health refills after a while) */
  sinceHit: number;
  /** seconds left that the player cannot be hurt */
  safe: number;
  /** seconds left lying down after running out of health; 0 = standing */
  down: number;
  /** the five attributes, which add health and energy */
  attrs: Attrs;
}

export const maxHp = (level: number, p = PLAYER, attrs?: Attrs) =>
  p.hp.base + p.hp.perLevel * (level - 1) + (attrs ? attrBonus(attrs).hp : 0);
export const maxEnergy = (level: number, p = PLAYER, attrs?: Attrs) =>
  p.energy.base + p.energy.perLevel * (level - 1) + (attrs ? attrBonus(attrs).energy : 0);
export const expToNext = (level: number, p = PLAYER) =>
  Math.round(p.exp.base * Math.pow(level, p.exp.growth));

export function newStats(level = 1, p = PLAYER, attrs = baseAttrs()): PlayerStats {
  return {
    level,
    exp: 0,
    hp: maxHp(level, p, attrs),
    energy: maxEnergy(level, p, attrs),
    sinceHit: 999,
    safe: 0,
    down: 0,
    attrs: { ...attrs },
  };
}

/**
 * Add experience; returns how many levels were gained. Each new level fills health and energy.
 * At the top level experience stops counting.
 */
export function gainExp(s: PlayerStats, amount: number, p = PLAYER): number {
  if (s.level >= p.maxLevel) return 0;
  s.exp += Math.max(0, amount);
  let gained = 0;
  while (s.level < p.maxLevel && s.exp >= expToNext(s.level, p)) {
    s.exp -= expToNext(s.level, p);
    s.level++;
    gained++;
  }
  if (s.level >= p.maxLevel) s.exp = 0;
  if (gained) {
    s.hp = maxHp(s.level, p, s.attrs);
    s.energy = maxEnergy(s.level, p, s.attrs);
  }
  return gained;
}

/** Use energy if there is enough (and the player is standing); returns whether it was used. */
export function spend(s: PlayerStats, cost: number): boolean {
  if (s.down > 0 || s.energy < cost) return false;
  s.energy -= cost;
  return true;
}

/** Take a hit. Nothing happens while safe after a hit or lying down. */
export function hurt(s: PlayerStats, amount: number, p = PLAYER): 'ignored' | 'hurt' | 'down' {
  if (s.safe > 0 || s.down > 0) return 'ignored';
  s.hp = Math.max(0, s.hp - amount);
  s.sinceHit = 0;
  if (s.hp === 0) {
    s.down = p.downTime;
    return 'down';
  }
  s.safe = p.invulnerable;
  return 'hurt';
}

/**
 * Move time on: energy refills, health refills once the player has not been hit for a while, and
 * a player who is down gets up again with everything full. Returns 'up' on the step they get up.
 */
export function stepStats(s: PlayerStats, dt: number, p = PLAYER): 'up' | null {
  if (s.down > 0) {
    s.down = Math.max(0, s.down - dt);
    if (s.down > 0) return null;
    s.hp = maxHp(s.level, p, s.attrs);
    s.energy = maxEnergy(s.level, p, s.attrs);
    s.safe = p.invulnerable;
    return 'up';
  }
  s.safe = Math.max(0, s.safe - dt);
  s.sinceHit += dt;
  s.energy = Math.min(maxEnergy(s.level, p, s.attrs), s.energy + p.energy.regen * dt);
  if (s.sinceHit >= p.hpRegen.delay)
    s.hp = Math.min(maxHp(s.level, p, s.attrs), s.hp + p.hpRegen.perSecond * dt);
  return null;
}
