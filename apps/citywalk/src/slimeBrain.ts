// What a wandering slime decides to do each frame. No three.js here so it can be tested on its own.

export type SlimeMode = 'idle' | 'hop' | 'watch' | 'lunge';

/** Timing of the model's Jumping clip: it leaves the ground at liftOff and lands at land (seconds). */
export const HOP = { cycle: 1.6, liftOff: 0.3, land: 1.12, distance: 1.2 };
/** Distances to the walker (metres) where a slime starts watching and lunging. */
export const NEAR = { watch: 6, lunge: 2.2, forget: 7.5 };

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
}

export interface BrainWorld {
  /** how far from home a slime may wander */
  wander: number;
  rng: () => number;
  /** move from (x, z) by (dx, dz) as far as walls allow */
  move: (x: number, z: number, dx: number, dz: number) => [number, number];
  /** may a slime go here (e.g. is it on the square) */
  allowed: (x: number, z: number) => boolean;
}

export function newBrain(x: number, z: number, wait = 0): SlimeBrain {
  return { x, z, home: [x, z], heading: 0, mode: 'idle', target: null, wait, phase: 0 };
}

export function airborne(phase: number): boolean {
  const t = phase % HOP.cycle;
  return t >= HOP.liftOff && t < HOP.land;
}

/** Seeded random numbers (mulberry32), so a herd behaves the same every time it starts. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stepBrain(
  b: SlimeBrain,
  dt: number,
  player: { x: number; z: number },
  w: BrainWorld,
): void {
  const px = player.x - b.x,
    pz = player.z - b.z;
  const dPlayer = Math.hypot(px, pz);
  const busyWithPlayer = b.mode === 'watch' || b.mode === 'lunge';

  // the walker comes first: watch when near, lunge when very near, but finish a hop in the air
  if (dPlayer < NEAR.watch && !(b.mode === 'hop' && airborne(b.phase))) {
    b.mode = dPlayer < NEAR.lunge ? 'lunge' : 'watch';
    b.heading = Math.atan2(px, pz);
    b.target = null;
    return;
  }
  if (busyWithPlayer) {
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
  const wasUp = airborne(b.phase);
  b.phase += dt;
  if (b.target) {
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
  // a hop ends on the ground; with nowhere left to go, rest a while
  if (!b.target && !airborne(b.phase)) {
    b.mode = 'idle';
    b.wait = 2 + w.rng() * 4;
  }
}

/** A slime's health. Hit points, and how long each stage after a hit lasts (seconds). */
export const VITALS = { hp: 100, hurt: 0.35, melt: 0.9, respawn: 5, grow: 0.5 };

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
