// Skill shots: what they do and how they fly. No three.js here so it can be tested on its own.

export type Element = 'fire' | 'water';

export interface SkillSpec {
  damage: number;
  /** metres per second */
  speed: number;
  /** seconds before it can be used again */
  cooldown: number;
  /** a shot with nothing to hit fades out after this many metres */
  range: number;
  /** how hard it swings out to the side (+ right, - left) and up as it leaves the hand */
  side: number;
  lift: number;
  /** how far the slime is pushed back, metres */
  knock: number;
  /** seconds spent gathering the ball in the hand before it flies */
  charge: number;
  /** slimes this close to where it bursts (metres) also take `damage` */
  splash: { radius: number; damage: number } | null;
}

/**
 * Fire: a big ball of flame gathered in the hand, flies straight and fairly slowly, and bursts
 * wide enough to scorch slimes nearby. Water: drawn together quickly, shot like a short spear of
 * water, very fast, pushes the slime back hard.
 */
export const SKILLS: Record<Element, SkillSpec> = {
  fire: {
    damage: 40,
    speed: 15,
    cooldown: 1.6,
    range: 32,
    side: 0,
    lift: 0.04,
    knock: 0.7,
    charge: 0.55,
    splash: { radius: 2.8, damage: 15 },
  },
  water: {
    damage: 20,
    speed: 34,
    cooldown: 0.7,
    range: 32,
    side: 0,
    lift: 0,
    knock: 1.3,
    charge: 0.3,
    splash: null,
  },
};

/** How far a slime can be and still be picked when no target is chosen. */
export const AUTO_RANGE = 30;
/** a shot this close to a slime's middle hits it */
export const HIT_RADIUS = 0.6;

export type Vec3 = [number, number, number];

export interface Shot {
  element: Element;
  pos: Vec3;
  /** current direction of travel, length 1 */
  dir: Vec3;
  /** index of the slime it chases, or null to fly straight */
  target: number | null;
  travelled: number;
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * Start a shot from `from`. With an aim point it leaves the hand swinging out to one side and up,
 * then curls in; without one it flies straight along `heading` (radians, 0 = +z).
 */
export function launch(
  element: Element,
  from: Vec3,
  heading: number,
  aim: Vec3 | null,
  target: number | null,
): Shot {
  const s = SKILLS[element];
  let fwd: Vec3 = [Math.sin(heading), 0, Math.cos(heading)];
  if (aim) fwd = norm([aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]]);
  if (!aim) return { element, pos: [...from], dir: fwd, target: null, travelled: 0 };
  // right of the walker when facing fwd
  const right: Vec3 = norm([-fwd[2], 0, fwd[0]]);
  const dir = norm([fwd[0] + right[0] * s.side, fwd[1] + s.lift, fwd[2] + right[2] * s.side]);
  return { element, pos: [...from], dir, target, travelled: 0 };
}

/**
 * Move a shot for dt seconds, turning it towards `aim` (if any). It turns harder the closer it
 * gets, so a chased target is always reached.
 */
export function stepShot(shot: Shot, dt: number, aim: Vec3 | null): void {
  const s = SKILLS[shot.element];
  if (aim) {
    const to: Vec3 = [aim[0] - shot.pos[0], aim[1] - shot.pos[1], aim[2] - shot.pos[2]];
    const d = Math.hypot(to[0], to[1], to[2]);
    if (d > 1e-6) {
      const want = norm(to);
      const k = Math.min(1, dt * (4 + 12 / Math.max(d, 0.3)));
      shot.dir = norm([
        shot.dir[0] + (want[0] - shot.dir[0]) * k,
        shot.dir[1] + (want[1] - shot.dir[1]) * k,
        shot.dir[2] + (want[2] - shot.dir[2]) * k,
      ]);
    }
  }
  const step = s.speed * dt;
  shot.pos = [
    shot.pos[0] + shot.dir[0] * step,
    shot.pos[1] + shot.dir[1] * step,
    shot.pos[2] + shot.dir[2] * step,
  ];
  shot.travelled += step;
}

/** A shot that has flown its full range with nothing to hit. */
export function spent(shot: Shot): boolean {
  return shot.travelled > SKILLS[shot.element].range;
}

/**
 * Pick the slime to shoot when none is chosen: the nearest one within reach, but one in front of
 * the walker beats a nearer one behind.
 */
export function chooseTarget(
  player: { x: number; z: number; heading: number },
  slimes: readonly { x: number; z: number; alive: boolean }[],
  range = AUTO_RANGE,
): number | null {
  const fx = Math.sin(player.heading),
    fz = Math.cos(player.heading);
  let best: number | null = null;
  let bestScore = Infinity;
  slimes.forEach((s, i) => {
    if (!s.alive) return;
    const dx = s.x - player.x,
      dz = s.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return;
    const facing = d > 1e-6 ? (dx * fx + dz * fz) / d : 1; // 1 ahead, -1 behind
    const score = d * (2 - facing);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * Slimes caught in a burst at `at` (map metres), apart from the one hit directly. Only the
 * ground distance counts.
 */
export function splashed(
  at: Vec3,
  slimes: readonly { x: number; z: number; alive: boolean }[],
  radius: number,
  except: number | null,
): number[] {
  const out: number[] = [];
  slimes.forEach((s, i) => {
    if (i !== except && s.alive && Math.hypot(s.x - at[0], s.z - at[2]) <= radius) out.push(i);
  });
  return out;
}

/** Seconds left before each skill can be used again. */
export type Cooldowns = Record<Element, number>;

export const readyCooldowns = (): Cooldowns => ({ fire: 0, water: 0 });

export function tickCooldowns(cd: Cooldowns, dt: number): void {
  for (const k of Object.keys(cd) as Element[]) cd[k] = Math.max(0, cd[k] - dt);
}

/** Use a skill if it is ready; returns whether it was used. */
export function useSkill(cd: Cooldowns, element: Element): boolean {
  if (cd[element] > 0) return false;
  cd[element] = SKILLS[element].cooldown;
  return true;
}
