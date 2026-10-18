// What a wandering slime decides to do each frame. No three.js here so it can be tested on its own.
// Every slime follows its species' numbers (config/monsters.json): size, pace, reach, anger.

import { DEFAULT_SPECIES, HOP, monster, type MonsterSpec, type VitalTimes } from './monsters';

export type SlimeMode = 'idle' | 'hop' | 'watch' | 'lunge' | 'chase';

export interface SlimeBrain {
  spec: MonsterSpec;
  x: number;
  z: number;
  home: [number, number];
  /** direction the slime wants to face, radians, 0 = +z */
  heading: number;
  mode: SlimeMode;
  target: [number, number] | null;
  /** seconds left to stand still before looking for a new spot */
  wait: number;
  /** time into the current hop cycle, in clip time (runs faster for a quick species) */
  phase: number;
  /** seconds left being angry (it was hit); only an angry slime hurts */
  anger: number;
  /** time into the current attack, in clip time */
  attackT: number;
  /** set on the step an angry slime's blow lands on the player */
  struck: boolean;
}

export interface BrainWorld {
  rng: () => number;
  /** move from (x, z) by (dx, dz) as far as walls allow, for a body of this radius */
  move: (x: number, z: number, dx: number, dz: number, radius: number) => [number, number];
  /** may a slime go here (e.g. is it on the square) */
  allowed: (x: number, z: number) => boolean;
}

/** Where the player is; a player who is down is left alone. */
export interface Prey {
  x: number;
  z: number;
  down?: boolean;
}

export function newBrain(
  x: number,
  z: number,
  wait = 0,
  spec: MonsterSpec = monster(DEFAULT_SPECIES),
): SlimeBrain {
  return {
    spec,
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
  b.anger = b.spec.anger.time;
}

/** Hop along towards `target`, moving only while in the air. */
function hopTowards(b: SlimeBrain, dt: number, w: BrainWorld): void {
  const wasUp = airborne(b.phase);
  b.phase += dt * b.spec.pace;
  if (!b.target) return;
  const tx = b.target[0] - b.x,
    tz = b.target[1] - b.z;
  const left = Math.hypot(tx, tz);
  b.heading = Math.atan2(tx, tz);
  if (wasUp && left > 0.05) {
    // metres per second in the air: the normal hop's speed, longer for a long stride, quicker for
    // a quick species
    const speed = ((HOP.distance * b.spec.stride) / (HOP.land - HOP.liftOff)) * b.spec.pace;
    const step = Math.min(left, speed * dt);
    const [nx, nz] = w.move(b.x, b.z, (tx / left) * step, (tz / left) * step, b.spec.radius);
    const moved = Math.hypot(nx - b.x, nz - b.z);
    b.x = nx;
    b.z = nz;
    if (moved < step * 0.3) b.target = null; // bumped into something: give up after landing
  }
  if (left < 0.4) b.target = null;
}

/** One step of an attack: the blow lands once per cycle, at strikeAt, if the player is in reach. */
function attack(b: SlimeBrain, dt: number, dPlayer: number, hurts: boolean): void {
  const a = b.spec.attack;
  const before = b.attackT;
  b.attackT = (b.attackT + dt * b.spec.pace) % a.cycle;
  const crossed =
    before < a.strikeAt
      ? b.attackT >= a.strikeAt || b.attackT < before
      : b.attackT < before && b.attackT >= a.strikeAt;
  if (hurts && crossed && dPlayer <= a.reach) b.struck = true;
}

export function stepBrain(b: SlimeBrain, dt: number, player: Prey, w: BrainWorld): void {
  const { near, anger } = b.spec;
  b.struck = false;
  const px = player.x - b.x,
    pz = player.z - b.z;
  const dPlayer = player.down ? Infinity : Math.hypot(px, pz);
  if (player.down) b.anger = 0;
  b.anger = Math.max(0, b.anger - dt);
  // an angry slime that strays too far from home calms down and goes back
  if (b.anger > 0 && Math.hypot(b.x - b.home[0], b.z - b.home[1]) > anger.leash) {
    b.anger = 0;
    b.target = [...b.home];
    b.mode = 'hop';
  }
  const flying = (b.mode === 'hop' || b.mode === 'chase') && airborne(b.phase);

  // close enough to the player: attack (or, if not angry, only threaten); finish a hop first
  if (dPlayer < near.lunge && !flying) {
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
  if (dPlayer < near.watch && !flying) {
    b.mode = 'watch';
    b.heading = Math.atan2(px, pz);
    b.target = null;
    return;
  }
  if (b.mode === 'watch' || b.mode === 'lunge') {
    // a little out of reach: keep an eye on the walker until they are well away
    if (dPlayer < near.forget) {
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
    const r = 2 + w.rng() * b.spec.wander;
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

/** alive → (hit) hurt → alive, or → (out of hp) melting → gone → growing back at home → alive */
export type Life = 'alive' | 'hurt' | 'melting' | 'gone' | 'growing';

export interface Vitals {
  hp: number;
  /** most hit points; a slime grows back with this many */
  max: number;
  times: VitalTimes;
  life: Life;
  /** seconds left in the current stage (unused while alive) */
  timer: number;
}

export const newVitals = (spec: MonsterSpec = monster(DEFAULT_SPECIES)): Vitals => ({
  hp: spec.hp,
  max: spec.hp,
  times: spec.vitals,
  life: 'alive',
  timer: 0,
});

/** Can a shot hit it? Not while it is melting away, gone or still growing back. */
export const hittable = (v: Vitals): boolean => v.life === 'alive' || v.life === 'hurt';

/** Take a hit. Returns what happened. */
export function damage(v: Vitals, amount: number): 'hurt' | 'defeated' | 'ignored' {
  if (!hittable(v)) return 'ignored';
  v.hp = Math.max(0, v.hp - amount);
  if (v.hp === 0) {
    v.life = 'melting';
    v.timer = v.times.melt;
    return 'defeated';
  }
  v.life = 'hurt';
  v.timer = v.times.hurt;
  return 'hurt';
}

/** Move the stages along; returns the new stage when it changes, else null. */
export function stepVitals(v: Vitals, dt: number): Life | null {
  if (v.life === 'alive') return null;
  v.timer -= dt;
  if (v.timer > 0) return null;
  const next: Record<Exclude<Life, 'alive'>, [Life, number]> = {
    hurt: ['alive', 0],
    melting: ['gone', v.times.respawn],
    gone: ['growing', v.times.grow],
    growing: ['alive', 0],
  };
  const [life, timer] = next[v.life];
  v.life = life;
  v.timer = timer;
  if (life === 'growing') v.hp = v.max;
  return life;
}
