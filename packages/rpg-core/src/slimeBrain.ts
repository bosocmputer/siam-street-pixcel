// What a wandering slime decides to do each frame. No three.js here so it can be tested on its own.

import monstersJson from '../config/monsters.json';
import { num, obj } from './config';
import type { Element } from './skills';

export type SlimeMode = 'idle' | 'hop' | 'watch' | 'lunge' | 'chase';

export interface SlimeSpec {
  hop: { cycle: number; liftOff: number; land: number; distance: number };
  near: { watch: number; lunge: number; forget: number };
  vitals: { hp: number; hurt: number; melt: number; respawn: number; grow: number };
  wander: number;
  exp: number;
  takes: Record<Element, number>;
  attack: { damage: number; reach: number; cycle: number; strikeAt: number };
  anger: { time: number; leash: number };
}

/** Read and check the slime numbers from config/monsters.json. */
export function readSlime(raw: unknown): SlimeSpec {
  const w = 'monsters.slime';
  const o = obj(obj(raw, 'monsters.json').slime, w);
  const part = (key: string) => obj(o[key], `${w}.${key}`);
  const hop = part('hop'),
    near = part('near'),
    takes = part('takes'),
    attack = part('attack'),
    anger = part('anger');
  const spec: SlimeSpec = {
    hop: {
      cycle: num(hop, 'cycle', `${w}.hop`, 0.01),
      liftOff: num(hop, 'liftOff', `${w}.hop`),
      land: num(hop, 'land', `${w}.hop`),
      distance: num(hop, 'distance', `${w}.hop`),
    },
    near: {
      watch: num(near, 'watch', `${w}.near`),
      lunge: num(near, 'lunge', `${w}.near`),
      forget: num(near, 'forget', `${w}.near`),
    },
    vitals: {
      hp: num(o, 'hp', w, 1),
      hurt: num(o, 'hurt', w),
      melt: num(o, 'melt', w),
      respawn: num(o, 'respawn', w),
      grow: num(o, 'grow', w),
    },
    wander: num(o, 'wander', w),
    exp: num(o, 'exp', w),
    takes: { fire: num(takes, 'fire', `${w}.takes`), water: num(takes, 'water', `${w}.takes`) },
    attack: {
      damage: num(attack, 'damage', `${w}.attack`),
      reach: num(attack, 'reach', `${w}.attack`),
      cycle: num(attack, 'cycle', `${w}.attack`, 0.1),
      strikeAt: num(attack, 'strikeAt', `${w}.attack`),
    },
    anger: { time: num(anger, 'time', `${w}.anger`), leash: num(anger, 'leash', `${w}.anger`) },
  };
  if (spec.attack.strikeAt >= spec.attack.cycle)
    throw new Error(`${w}.attack.strikeAt must be inside the attack cycle`);
  return spec;
}

/** All the slime numbers. */
export const SLIME = readSlime(monstersJson);

/** Timing of the model's Jumping clip: it leaves the ground at liftOff and lands at land (seconds). */
export const HOP = SLIME.hop;
/** Distances to the walker (metres) where a slime starts watching and lunging. */
export const NEAR = SLIME.near;
/** How far from home a slime wanders, metres. */
export const WANDER = SLIME.wander;
/** How a slime attacks, and how long it stays angry after being hit. */
export const ATTACK = SLIME.attack;
export const ANGER = SLIME.anger;

export interface SlimeBrain {
  x: number;
  z: number;
  home: [number, number];
  /** direction the slime wants to face, radians, 0 = +z */
  heading: number;
  mode: SlimeMode;
  target: [number, number] | null;
  /** seconds left to stand still before looking for a new spot */
  wait: number;
  /** time into the current hop cycle */
  phase: number;
  /** seconds left being angry (it was hit); only an angry slime hurts */
  anger: number;
  /** time into the current attack */
  attackT: number;
  /** set on the step an angry slime's blow lands on the player */
  struck: boolean;
}

export interface BrainWorld {
  /** how far from home a slime wanders */
  wander: number;
  rng: () => number;
  /** move from (x, z) by (dx, dz) as far as walls allow */
  move: (x: number, z: number, dx: number, dz: number) => [number, number];
  /** may a slime go here (e.g. is it on the square) */
  allowed: (x: number, z: number) => boolean;
}

/** Where the player is; a player who is down is left alone. */
export interface Prey {
  x: number;
  z: number;
  down?: boolean;
}

export function newBrain(x: number, z: number, wait = 0): SlimeBrain {
  return {
    x,
    z,
    home: [x, z],
    heading: 0,
    mode: 'idle',
    target: null,
    wait,
    phase: 0,
    anger: 0,
    attackT: 0,
    struck: false,
  };
}

export function airborne(phase: number): boolean {
  const t = phase % HOP.cycle;
  return t >= HOP.liftOff && t < HOP.land;
}

/** Make a slime angry at whoever hit it. */
export function provoke(b: SlimeBrain): void {
  b.anger = ANGER.time;
}

/** Hop along towards `target`, moving only while in the air. Returns false when it bumped. */
function hopTowards(b: SlimeBrain, dt: number, w: BrainWorld): void {
  const wasUp = airborne(b.phase);
  b.phase += dt;
  if (!b.target) return;
  const tx = b.target[0] - b.x,
    tz = b.target[1] - b.z;
  const left = Math.hypot(tx, tz);
  b.heading = Math.atan2(tx, tz);
  if (wasUp && left > 0.05) {
    const speed = HOP.distance / (HOP.land - HOP.liftOff);
    const step = Math.min(left, speed * dt);
    const [nx, nz] = w.move(b.x, b.z, (tx / left) * step, (tz / left) * step);
    const moved = Math.hypot(nx - b.x, nz - b.z);
    b.x = nx;
    b.z = nz;
    if (moved < step * 0.3) b.target = null; // bumped into something: give up after landing
  }
  if (left < 0.4) b.target = null;
}

/** One step of an attack: the blow lands once per cycle, at strikeAt, if the player is in reach. */
function attack(b: SlimeBrain, dt: number, dPlayer: number, hurts: boolean): void {
  const before = b.attackT;
  b.attackT = (b.attackT + dt) % ATTACK.cycle;
  const crossed =
    before < ATTACK.strikeAt
      ? b.attackT >= ATTACK.strikeAt || b.attackT < before
      : b.attackT < before && b.attackT >= ATTACK.strikeAt;
  if (hurts && crossed && dPlayer <= ATTACK.reach) b.struck = true;
}

export function stepBrain(b: SlimeBrain, dt: number, player: Prey, w: BrainWorld): void {
  b.struck = false;
  const px = player.x - b.x,
    pz = player.z - b.z;
  const dPlayer = player.down ? Infinity : Math.hypot(px, pz);
  if (player.down) b.anger = 0;
  b.anger = Math.max(0, b.anger - dt);
  // an angry slime that strays too far from home calms down and goes back
  if (b.anger > 0 && Math.hypot(b.x - b.home[0], b.z - b.home[1]) > ANGER.leash) {
    b.anger = 0;
    b.target = [...b.home];
    b.mode = 'hop';
  }
  const flying = (b.mode === 'hop' || b.mode === 'chase') && airborne(b.phase);

  // close enough to the player: attack (or, if not angry, only threaten); finish a hop first
  if (dPlayer < NEAR.lunge && !flying) {
    if (b.mode !== 'lunge') b.attackT = 0;
    b.mode = 'lunge';
    b.heading = Math.atan2(px, pz);
    b.target = null;
    attack(b, dt, dPlayer, b.anger > 0);
    return;
  }
  // angry and out of reach: hop after the player
  if (b.anger > 0) {
    if (b.mode !== 'chase' || (!b.target && !airborne(b.phase))) {
      if (b.mode !== 'chase') b.phase = 0;
      b.mode = 'chase';
      b.target = [player.x, player.z];
    }
    hopTowards(b, dt, w);
    return;
  }
  if (b.mode === 'chase' && flying) {
    hopTowards(b, dt, w); // calmed down mid-air: land first
    return;
  }
  if (b.mode === 'chase') {
    b.mode = 'idle';
    b.wait = 1;
  }

  // the walker comes first: watch when near, but finish a hop in the air
  if (dPlayer < NEAR.watch && !flying) {
    b.mode = 'watch';
    b.heading = Math.atan2(px, pz);
    b.target = null;
    return;
  }
  if (b.mode === 'watch' || b.mode === 'lunge') {
    // a little out of reach: keep an eye on the walker until they are well away
    if (dPlayer < NEAR.forget) {
      b.mode = 'watch';
      b.heading = Math.atan2(px, pz);
      return;
    }
    b.mode = 'idle';
    b.wait = 1;
  }

  if (b.mode === 'idle') {
    b.wait -= dt;
    if (b.wait > 0) return;
    const a = w.rng() * Math.PI * 2;
    const r = 2 + w.rng() * w.wander;
    const tx = b.home[0] + Math.sin(a) * r,
      tz = b.home[1] + Math.cos(a) * r;
    if (!w.allowed(tx, tz)) {
      b.wait = 0.3;
      return;
    }
    b.target = [tx, tz];
    b.mode = 'hop';
    b.phase = 0;
    b.heading = Math.atan2(tx - b.x, tz - b.z);
    return;
  }

  // hopping: only move while in the air, so the body never slides on the ground
  hopTowards(b, dt, w);
  // a hop ends on the ground; with nowhere left to go, rest a while
  if (!b.target && !airborne(b.phase)) {
    b.mode = 'idle';
    b.wait = 2 + w.rng() * 4;
  }
}

/** A slime's health. Hit points, and how long each stage after a hit lasts (seconds). */
export const VITALS = SLIME.vitals;

/** alive → (hit) hurt → alive, or → (out of hp) melting → gone → growing back at home → alive */
export type Life = 'alive' | 'hurt' | 'melting' | 'gone' | 'growing';

export interface Vitals {
  hp: number;
  life: Life;
  /** seconds left in the current stage (unused while alive) */
  timer: number;
}

export const newVitals = (): Vitals => ({ hp: VITALS.hp, life: 'alive', timer: 0 });

/** Can a shot hit it? Not while it is melting away, gone or still growing back. */
export const hittable = (v: Vitals): boolean => v.life === 'alive' || v.life === 'hurt';

/** Take a hit. Returns what happened. */
export function damage(v: Vitals, amount: number): 'hurt' | 'defeated' | 'ignored' {
  if (!hittable(v)) return 'ignored';
  v.hp = Math.max(0, v.hp - amount);
  if (v.hp === 0) {
    v.life = 'melting';
    v.timer = VITALS.melt;
    return 'defeated';
  }
  v.life = 'hurt';
  v.timer = VITALS.hurt;
  return 'hurt';
}

/** Move the stages along; returns the new stage when it changes, else null. */
export function stepVitals(v: Vitals, dt: number): Life | null {
  if (v.life === 'alive') return null;
  v.timer -= dt;
  if (v.timer > 0) return null;
  const next: Record<Exclude<Life, 'alive'>, [Life, number]> = {
    hurt: ['alive', 0],
    melting: ['gone', VITALS.respawn],
    gone: ['growing', VITALS.grow],
    growing: ['alive', 0],
  };
  const [life, timer] = next[v.life];
  v.life = life;
  v.timer = timer;
  if (life === 'growing') v.hp = VITALS.hp;
  return life;
}
