// Fighting up close: the three-hit strike, the dash (moving) or guard (standing), the perfect
// dodge, and the combo count. Numbers from config/combat.json. No three.js here: the game moves the
// body and draws; this only keeps the timing and says what happened.

import combatJson from '../config/combat.json';
import { ConfigError, num, obj } from './config';
import { ATTR } from './attributes';
import { PLAYER } from './stats';

export interface HitSpec {
  damage: number;
  /** metres the monster is pushed back */
  knock: number;
  /** seconds the swing lasts */
  time: number;
  /** seconds into the swing that the blow lands */
  impact: number;
}

export interface MeleeSpec {
  strike: {
    hits: HitSpec[];
    chainWindow: number;
    reach: number;
    energyOnHit: number;
    wave: { range: number; damage: number; speed: number; knock: number };
  };
  dash: { distance: number; time: number; safe: number; cooldown: number };
  guard: { reduce: number; energyPerSecond: number };
  perfect: {
    window: number;
    assistWindow: number;
    slow: number;
    slowRate: number;
    multiplier: number;
  };
  dashStrike: { window: number; multiplier: number };
  combo: {
    resetAfter: number;
    step: number;
    bonusPerStep: number;
    maxBonus: number;
    autoCap: number;
    ultimateAt: number;
  };
  assist: { chainScale: number };
  crit: { chance: number; perDex: number; multiplier: number };
}

/** Read and check config/combat.json. */
export function readMelee(raw: unknown): MeleeSpec {
  const o = obj(raw, 'combat.json');
  const part = (key: string, inside = o, where = 'combat') => obj(inside[key], `${where}.${key}`);
  const nums = <K extends string>(key: string, keys: K[], inside = o, where = 'combat') => {
    const p = part(key, inside, where);
    return Object.fromEntries(keys.map((k) => [k, num(p, k, `${where}.${key}`)])) as Record<
      K,
      number
    >;
  };
  const strike = part('strike');
  if (!Array.isArray(strike.hits) || strike.hits.length === 0)
    throw new ConfigError('combat.strike.hits: expected a list of hits');
  const hits = strike.hits.map((h: unknown, i) => {
    const w = `combat.strike.hits.${i}`;
    const p = obj(h, w);
    const hit = {
      damage: num(p, 'damage', w),
      knock: num(p, 'knock', w),
      time: num(p, 'time', w, 0.01),
      impact: num(p, 'impact', w),
    };
    if (hit.impact > hit.time) throw new ConfigError(`${w}.impact: lands after the swing ends`);
    return hit;
  });
  const dash = nums('dash', ['distance', 'time', 'safe', 'cooldown']);
  if (dash.time <= 0) throw new ConfigError('combat.dash.time: must be above 0');
  const guard = nums('guard', ['reduce', 'energyPerSecond']);
  if (guard.reduce > 1) throw new ConfigError('combat.guard.reduce: at most 1');
  const combo = nums('combo', [
    'resetAfter',
    'step',
    'bonusPerStep',
    'maxBonus',
    'autoCap',
    'ultimateAt',
  ]);
  if (combo.step < 1 || combo.ultimateAt < 1)
    throw new ConfigError('combat.combo: step and ultimateAt must be at least 1');
  return {
    strike: {
      hits,
      chainWindow: num(strike, 'chainWindow', 'combat.strike'),
      reach: num(strike, 'reach', 'combat.strike', 0.1),
      energyOnHit: num(strike, 'energyOnHit', 'combat.strike'),
      wave: nums('wave', ['range', 'damage', 'speed', 'knock'], strike, 'combat.strike'),
    },
    dash,
    guard,
    perfect: nums('perfect', ['window', 'assistWindow', 'slow', 'slowRate', 'multiplier']),
    dashStrike: nums('dashStrike', ['window', 'multiplier']),
    combo,
    assist: nums('assist', ['chainScale']),
    crit: nums('crit', ['chance', 'perDex', 'multiplier']),
  };
}

export const MELEE = readMelee(combatJson);

/**
 * The basic combos (jobs.md section 1): the heavy third hit of a chain, a strike straight out of a
 * dash, and the counter after a perfect dodge.
 */
export const COMBOS = ['finisher', 'dashStrike', 'counter'] as const;
export type ComboName = (typeof COMBOS)[number];

export interface Swing {
  /** which hit of the chain, from 1 */
  step: number;
  hit: HitSpec;
  /** how many times harder than the hit's own damage (a counter, a dash strike) */
  multiplier: number;
  /** the combo this swing makes, if any */
  combo: ComboName | null;
}

export interface Fighter {
  /** the swing being made, or null */
  swing: Swing | null;
  /** seconds into it */
  swingT: number;
  /** its blow has landed already */
  landed: boolean;
  /** strike was pressed during the swing: the next one follows when it ends */
  queued: boolean;
  /** the last hit of the chain made */
  chain: number;
  /** seconds since the last swing ended */
  sinceSwing: number;
  /** seconds of dash movement left */
  dash: number;
  dashCooldown: number;
  /** seconds left that blows pass through */
  safe: number;
  /** seconds since the last dash started */
  sinceDash: number;
  guarding: boolean;
  /** the next strike is a counter (after a perfect dodge) */
  counter: boolean;
  /** seconds of slow time left (after a perfect dodge) */
  slow: number;
  /** hits landed in a row */
  combo: number;
  /** seconds since the last hit landed */
  sinceHit: number;
  /** the longest combo so far */
  best: number;
  /** combo help: longer to chain, wider perfect dodge */
  assist: boolean;
}

const LONG_AGO = 999;

export function newFighter(assist = false): Fighter {
  return {
    swing: null,
    swingT: 0,
    landed: false,
    queued: false,
    chain: 0,
    sinceSwing: LONG_AGO,
    dash: 0,
    dashCooldown: 0,
    safe: 0,
    sinceDash: LONG_AGO,
    guarding: false,
    counter: false,
    slow: 0,
    combo: 0,
    sinceHit: LONG_AGO,
    best: 0,
    assist,
  };
}

function startSwing(f: Fighter, spec: MeleeSpec): Swing {
  const hits = spec.strike.hits;
  const window = spec.strike.chainWindow * (f.assist ? spec.assist.chainScale : 1);
  const step = f.chain < hits.length && f.sinceSwing <= window ? f.chain + 1 : 1;
  let multiplier = 1;
  let combo: ComboName | null = null;
  if (f.counter) {
    multiplier = spec.perfect.multiplier;
    combo = 'counter';
  } else if (f.sinceDash <= spec.dashStrike.window) {
    multiplier = spec.dashStrike.multiplier;
    combo = 'dashStrike';
  } else if (step === hits.length && hits.length > 1) combo = 'finisher';
  const swing: Swing = { step, hit: hits[step - 1]!, multiplier, combo };
  Object.assign(f, {
    swing,
    swingT: 0,
    landed: false,
    queued: false,
    chain: step,
    counter: false,
    guarding: false,
    dash: 0,
    // a dash gives one strong strike, not every strike after it
    sinceDash: LONG_AGO,
  });
  return swing;
}

/**
 * Strike was pressed: start the next hit of the chain, or, during a swing, have it follow when the
 * swing ends. Returns the swing started now, or null.
 */
export function pressStrike(f: Fighter, spec = MELEE): Swing | null {
  if (f.swing) {
    f.queued = true;
    return null;
  }
  return startSwing(f, spec);
}

/**
 * Dash was pressed. Moving, it is a dash (if it is ready); standing, the player guards until
 * releaseGuard. Either one breaks off a swing.
 */
export function pressDash(f: Fighter, moving: boolean, spec = MELEE): 'dash' | 'guard' | null {
  if (moving && f.dashCooldown > 0) return null;
  f.swing = null;
  f.queued = false;
  if (!moving) {
    f.guarding = true;
    return 'guard';
  }
  Object.assign(f, {
    dash: spec.dash.time,
    safe: spec.dash.safe,
    sinceDash: 0,
    dashCooldown: spec.dash.cooldown,
    guarding: false,
  });
  return 'dash';
}

export function releaseGuard(f: Fighter): void {
  f.guarding = false;
}

/** metres per second while dashing */
export const dashSpeed = (spec = MELEE) => spec.dash.distance / spec.dash.time;

export interface FighterStep {
  /** a swing that started this step (one that was waiting for the last to end) */
  started: Swing | null;
  /** a swing whose blow lands this step */
  landed: Swing | null;
  /** energy guarding used this step */
  drain: number;
}

/** Move the fighter's clocks on by dt seconds (real time, not slowed by a perfect dodge). */
export function stepFighter(f: Fighter, dt: number, spec = MELEE): FighterStep {
  const out: FighterStep = { started: null, landed: null, drain: 0 };
  f.safe = Math.max(0, f.safe - dt);
  f.dashCooldown = Math.max(0, f.dashCooldown - dt);
  f.dash = Math.max(0, f.dash - dt);
  f.slow = Math.max(0, f.slow - dt);
  f.sinceDash += dt;
  if (f.combo > 0) {
    f.sinceHit += dt;
    if (f.sinceHit > spec.combo.resetAfter) f.combo = 0;
  }
  if (f.guarding) out.drain = spec.guard.energyPerSecond * dt;
  const s = f.swing;
  if (!s) {
    f.sinceSwing += dt;
    return out;
  }
  f.swingT += dt;
  if (!f.landed && f.swingT >= s.hit.impact) {
    f.landed = true;
    out.landed = s;
  }
  if (f.swingT >= s.hit.time) {
    f.swing = null;
    f.sinceSwing = 0;
    if (f.queued) out.started = startSwing(f, spec);
  }
  return out;
}

/**
 * A hit of the player's landed on a monster: the combo grows (auto play stops counting at
 * autoCap). Returns the energy it gives back.
 */
export function landHit(f: Fighter, auto = false, spec = MELEE): number {
  f.combo = auto ? Math.min(spec.combo.autoCap, f.combo + 1) : f.combo + 1;
  f.sinceHit = 0;
  f.best = Math.max(f.best, f.combo);
  return spec.strike.energyOnHit;
}

export type BlowResult = 'perfect' | 'dodged' | 'guarded' | 'hit';

/**
 * A monster's blow reaches the player. Just after starting a dash it is dodged perfectly (time
 * slows and the next strike is a counter); while the dash keeps them safe it is dodged; guarding
 * takes part of it; otherwise it hits, which ends the combo and the chain.
 */
export function takeBlow(
  f: Fighter,
  damage: number,
  spec = MELEE,
): { result: BlowResult; damage: number } {
  const window = f.assist ? spec.perfect.assistWindow : spec.perfect.window;
  if (f.sinceDash <= window) {
    f.counter = true;
    f.slow = spec.perfect.slow;
    return { result: 'perfect', damage: 0 };
  }
  if (f.safe > 0) return { result: 'dodged', damage: 0 };
  if (f.guarding)
    return { result: 'guarded', damage: Math.round(damage * (1 - spec.guard.reduce)) };
  Object.assign(f, { combo: 0, chain: 0, swing: null, queued: false });
  return { result: 'hit', damage };
}

/** How much harder hits are at this combo: bonusPerStep for every `step` hits, up to maxBonus. */
export function comboBonus(combo: number, spec = MELEE): number {
  const c = spec.combo;
  return Math.min(c.maxBonus, Math.floor(combo / c.step) * c.bonusPerStep);
}

/** How full the ultimate gauge is, 0..1. */
export const comboGauge = (combo: number, spec = MELEE) =>
  Math.min(1, combo / spec.combo.ultimateAt);

/** The chance of a critical hit with this much DEX. */
export function critChance(dex: number, spec = MELEE, base = ATTR.base): number {
  return Math.min(1, spec.crit.chance + spec.crit.perDex * Math.max(0, dex - base));
}

/**
 * Damage of a strike or wave: its base, a little more for each level above 1, the attributes'
 * power, the swing's multiplier, the combo bonus, how much the monster takes, and a critical hit.
 * Rounded to whole points, at least 1.
 */
export function strikeDamage(
  base: number,
  o: {
    level: number;
    power?: number;
    multiplier?: number;
    combo?: number;
    takes?: number;
    crit?: boolean;
  },
  spec = MELEE,
  perLevel = PLAYER.damagePerLevel,
): number {
  const raw =
    base *
    (1 + perLevel * Math.max(0, o.level - 1)) *
    (o.power ?? 1) *
    (o.multiplier ?? 1) *
    (1 + comboBonus(o.combo ?? 0, spec)) *
    (o.takes ?? 1) *
    (o.crit ? spec.crit.multiplier : 1);
  return Math.max(1, Math.round(raw));
}
