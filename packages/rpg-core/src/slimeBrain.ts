// What a wandering slime decides to do each frame. No three.js here so it can be tested on its own.
// Every slime follows its species' numbers (config/monsters.json): size, pace, reach, anger.

import { DEFAULT_SPECIES, HOP, monster, type MonsterSpec, type VitalTimes } from './monsters';

export type SlimeMode = 'idle' | 'hop' | 'watch' | 'lunge' | 'chase' | 'charge' | 'slam';

/** a boss's special move under way */
export interface Special {
  kind: 'charge' | 'slam';
  /** seconds into the move, in clip time */
  t: number;
  /** it has already struck (a move hurts at most once) */
  done: boolean;
  /** the way a charge goes, fixed when the dash starts */
  heading: number;
}

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
  /** how much that blow hurts (its attack, or a special move's own damage) */
  blow: number;
  /** a special move being done, or null */
  special: Special | null;
  /** seconds until each special move may be used again */
  cool: { charge: number; slam: number };
  /** set on the step a ground slam lands, whether or not it hit the player */
  shock: boolean;
  /** seconds the warning ring of the coming blow has shown */
  warned: number;
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
    blow: spec.attack.damage,
    special: null,
    // a boss does not start a special move the moment it is angry
    cool: { charge: 1.5, slam: 3 },
    shock: false,
    warned: 0,
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

/** Clip time left until the next blow of the attack cycle, in (0, cycle]. */
function toStrike(b: SlimeBrain): number {
  const a = b.spec.attack;
  return b.attackT < a.strikeAt ? a.strikeAt - b.attackT : a.cycle - b.attackT + a.strikeAt;
}

/**
 * One step of an attack: the blow lands once per cycle, at strikeAt, if the player is in reach.
 * An angry slime's blow is warned of for at least attack.warn seconds: if the ring has not shown
 * that long when the blow is due, it holds its wind-up until it has.
 */
function attack(b: SlimeBrain, dt: number, dPlayer: number, hurts: boolean): void {
  const a = b.spec.attack;
  const step = dt * b.spec.pace;
  const left = toStrike(b);
  if (hurts && left <= a.warn * b.spec.pace + 1e-9) b.warned += dt;
  if (left > step) {
    b.attackT = (b.attackT + step) % a.cycle;
    return;
  }
  if (hurts && b.warned < a.warn - 1e-9) {
    b.attackT = Math.max(0, a.strikeAt - 1e-6);
    return;
  }
  b.attackT = (b.attackT + step) % a.cycle;
  b.warned = 0;
  if (hurts && dPlayer <= a.reach) {
    b.struck = true;
    b.blow = a.damage;
  }
}

/** A red warning on the ground of where a blow is about to land. */
export interface Warning {
  kind: 'blow' | 'slam' | 'charge';
  /** where it starts (the monster), map metres */
  x: number;
  z: number;
  /** a ring's radius, or a lane's half width, metres */
  radius: number;
  /** a lane's length (0 for a ring) and the way it runs, radians, 0 = +z */
  length: number;
  heading: number;
  /** 0 when it appears, 1 when the blow lands: the red fills in as it grows */
  fill: number;
}

/**
 * The warning a monster shows now, or null. Only an angry monster warns, since only an angry one
 * hurts: a ring round it before its blow, a wide ring before a ground slam, a lane where a
 * charge will run.
 */
export function warningOf(b: SlimeBrain): Warning | null {
  const s = b.special;
  const at = { x: b.x, z: b.z, heading: b.heading };
  if (s?.kind === 'slam') {
    const m = b.spec.specials.slam!;
    if (s.done) return null;
    return {
      kind: 'slam',
      ...at,
      radius: m.radius,
      length: 0,
      fill: Math.min(1, s.t / m.strikeAt),
    };
  }
  if (s?.kind === 'charge') {
    const m = b.spec.specials.charge!;
    if (s.t >= m.dashEnd || s.done) return null;
    // the rest of the run, plus how far it reaches past its nose
    const run = m.speed * (m.dashEnd - Math.max(s.t, m.dashStart)) + m.reach;
    return {
      kind: 'charge',
      ...at,
      heading: s.heading,
      radius: m.reach,
      length: run,
      fill: Math.min(1, s.t / m.dashStart),
    };
  }
  const a = b.spec.attack;
  if (b.mode !== 'lunge' || b.anger <= 0 || toStrike(b) > a.warn * b.spec.pace + 1e-9) return null;
  return {
    kind: 'blow',
    ...at,
    radius: a.reach,
    length: 0,
    fill: a.warn > 0 ? Math.min(1, b.warned / a.warn) : 1,
  };
}

/**
 * Pick a special move for an angry boss that is on the ground, or null. A ground slam when the
 * player is close; a charge when they are a little way off.
 */
function pickSpecial(b: SlimeBrain, dPlayer: number): Special | null {
  const { charge, slam } = b.spec.specials;
  if (slam && b.cool.slam <= 0 && dPlayer <= slam.radius * 0.85)
    return { kind: 'slam', t: 0, done: false, heading: b.heading };
  if (charge && b.cool.charge <= 0 && dPlayer >= charge.min && dPlayer <= charge.max)
    return { kind: 'charge', t: 0, done: false, heading: b.heading };
  return null;
}

/** One step of a special move: aim, then strike. Ends itself when its clip is over. */
function stepSpecial(b: SlimeBrain, dt: number, player: Prey, w: BrainWorld): void {
  const s = b.special!;
  const px = player.x - b.x,
    pz = player.z - b.z;
  const dPlayer = player.down ? Infinity : Math.hypot(px, pz);
  s.t += dt;
  if (s.kind === 'slam') {
    const m = b.spec.specials.slam!;
    b.mode = 'slam';
    // it keeps facing the player while it rears up
    if (s.t < m.strikeAt * 0.7) b.heading = Math.atan2(px, pz);
    if (!s.done && s.t >= m.strikeAt) {
      s.done = true;
      b.shock = true;
      if (dPlayer <= m.radius) {
        b.struck = true;
        b.blow = m.damage;
      }
    }
    if (s.t >= m.length) endSpecial(b, m.cooldown, px, pz);
    return;
  }
  const m = b.spec.specials.charge!;
  b.mode = 'charge';
  if (s.t < m.dashStart) {
    // crouching: it turns to follow the player, and the way it will go is fixed at the last moment
    b.heading = s.heading = Math.atan2(px, pz);
  } else if (s.t < m.dashEnd) {
    b.heading = s.heading;
    const step = m.speed * dt;
    const dx = Math.sin(s.heading) * step,
      dz = Math.cos(s.heading) * step;
    const [nx, nz] = w.move(b.x, b.z, dx, dz, b.spec.radius);
    const stopped = Math.hypot(nx - b.x, nz - b.z) < step * 0.3 || !w.allowed(nx, nz);
    if (!stopped) {
      b.x = nx;
      b.z = nz;
    } else s.t = Math.max(s.t, m.dashEnd); // ran into something: the dash is over
    if (!s.done && dPlayer <= m.reach) {
      s.done = true;
      b.struck = true;
      b.blow = m.damage;
    }
  }
  if (s.t >= m.length) endSpecial(b, m.cooldown, px, pz);
}

function endSpecial(b: SlimeBrain, cooldown: number, px: number, pz: number): void {
  b.cool[b.special!.kind] = cooldown;
  b.special = null;
  b.mode = 'watch';
  b.heading = Math.atan2(px, pz);
}

export function stepBrain(b: SlimeBrain, dt: number, player: Prey, w: BrainWorld): void {
  const { near, anger } = b.spec;
  b.struck = false;
  b.shock = false;
  b.cool.charge = Math.max(0, b.cool.charge - dt);
  b.cool.slam = Math.max(0, b.cool.slam - dt);
  const px = player.x - b.x,
    pz = player.z - b.z;
  const dPlayer = player.down ? Infinity : Math.hypot(px, pz);
  if (player.down) {
    b.anger = 0;
    b.special = null;
  }
  b.anger = Math.max(0, b.anger - dt);
  // an angry slime that strays too far from home calms down and goes back
  if (b.anger > 0 && Math.hypot(b.x - b.home[0], b.z - b.home[1]) > anger.leash) {
    b.anger = 0;
    b.target = [...b.home];
    b.mode = 'hop';
  }
  // a special move in progress carries on until its clip is over
  if (b.special) {
    stepSpecial(b, dt, player, w);
    return;
  }
  const flying = (b.mode === 'hop' || b.mode === 'chase') && airborne(b.phase);
  if (b.anger > 0 && !flying) {
    const next = pickSpecial(b, dPlayer);
    if (next) {
      b.special = next;
      b.target = null;
      stepSpecial(b, dt, player, w);
      return;
    }
  }

  // close enough to the player: attack (or, if not angry, only threaten); finish a hop first
  if (dPlayer < near.lunge && !flying) {
    if (b.mode !== 'lunge') {
      b.attackT = 0;
      b.warned = 0;
    }
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
