// Skills: what each one does and how its shot flies. Every skill is one entry in
// config/skills.json, so a new skill of a known kind needs no new code. No three.js here.

import skillsJson from '../config/skills.json';
import { ConfigError, num, obj, signed } from './config';

export type Element = 'fire' | 'water';
export const ELEMENTS: Element[] = ['fire', 'water'];

export interface SkillSpec {
  id: string;
  /** decides the look and how much each monster takes from it */
  element: Element;
  /** energy it uses */
  cost: number;
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
  /** how far the monster is pushed back, metres */
  knock: number;
  /** seconds spent gathering the ball in the hand before it flies */
  charge: number;
  /** monsters this close to where it bursts (metres) also take `damage` */
  splash: { radius: number; damage: number } | null;
}

/** Read and check the skill numbers from config/skills.json. */
export function readSkills(raw: unknown): {
  skills: Record<string, SkillSpec>;
  autoRange: number;
  hitRadius: number;
} {
  const root = obj(raw, 'skills.json');
  const list = obj(root.skills, 'skills.json skills');
  const skills: Record<string, SkillSpec> = {};
  for (const id of Object.keys(list)) {
    const w = `skills.${id}`;
    const o = obj(list[id], w);
    const element = ELEMENTS.find((e) => e === o.element);
    if (!element) throw new ConfigError(`${w}.element: expected one of ${ELEMENTS.join(', ')}`);
    const splash = o.splash === null ? null : obj(o.splash, `${w}.splash`);
    skills[id] = {
      id,
      element,
      cost: num(o, 'cost', w),
      damage: num(o, 'damage', w),
      speed: num(o, 'speed', w, 0.1),
      cooldown: num(o, 'cooldown', w),
      range: num(o, 'range', w, 0.1),
      side: signed(o, 'side', w),
      lift: signed(o, 'lift', w),
      knock: num(o, 'knock', w),
      charge: num(o, 'charge', w),
      splash: splash && {
        radius: num(splash, 'radius', `${w}.splash`),
        damage: num(splash, 'damage', `${w}.splash`),
      },
    };
  }
  if (Object.keys(skills).length === 0) throw new ConfigError('skills.json: no skills');
  return {
    skills,
    autoRange: num(root, 'autoRange', 'skills.json'),
    hitRadius: num(root, 'hitRadius', 'skills.json', 0.01),
  };
}

const CONFIG = readSkills(skillsJson);

/**
 * Every skill by id. fireball: a big ball of flame gathered in the hand, flies straight and fairly
 * slowly, and bursts wide enough to scorch monsters nearby. waterball: drawn together quickly,
 * shot like a short spear of water, very fast, pushes hard.
 */
export const SKILLS: Readonly<Record<string, SkillSpec>> = CONFIG.skills;

/** One skill by id; an id that is not in the config is a mistake in the code or config. */
export function skill(id: string): SkillSpec {
  const s = SKILLS[id];
  if (!s) throw new ConfigError(`unknown skill: ${id}`);
  return s;
}

/** How far a monster can be and still be picked when no target is chosen. */
export const AUTO_RANGE = CONFIG.autoRange;
/** a shot this close to a monster's middle hits it */
export const HIT_RADIUS = CONFIG.hitRadius;

export type Vec3 = [number, number, number];

export interface Shot {
  skill: SkillSpec;
  pos: Vec3;
  /** current direction of travel, length 1 */
  dir: Vec3;
  /** index of the monster it chases, or null to fly straight */
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
  s: SkillSpec,
  from: Vec3,
  heading: number,
  aim: Vec3 | null,
  target: number | null,
): Shot {
  let fwd: Vec3 = [Math.sin(heading), 0, Math.cos(heading)];
  if (aim) fwd = norm([aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]]);
  if (!aim) return { skill: s, pos: [...from], dir: fwd, target: null, travelled: 0 };
  // right of the walker when facing fwd
  const right: Vec3 = norm([-fwd[2], 0, fwd[0]]);
  const dir = norm([fwd[0] + right[0] * s.side, fwd[1] + s.lift, fwd[2] + right[2] * s.side]);
  return { skill: s, pos: [...from], dir, target, travelled: 0 };
}

/**
 * Move a shot for dt seconds, turning it towards `aim` (if any). It turns harder the closer it
 * gets, so a chased target is always reached.
 */
export function stepShot(shot: Shot, dt: number, aim: Vec3 | null): void {
  const s = shot.skill;
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
  return shot.travelled > shot.skill.range;
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

/** Seconds left before each skill can be used again, by skill id. */
export type Cooldowns = Record<string, number>;

export const readyCooldowns = (): Cooldowns =>
  Object.fromEntries(Object.keys(SKILLS).map((id) => [id, 0]));

export function tickCooldowns(cd: Cooldowns, dt: number): void {
  for (const k of Object.keys(cd)) cd[k] = Math.max(0, cd[k]! - dt);
}

/** Use a skill if it is ready; returns whether it was used. */
export function useSkill(cd: Cooldowns, id: string): boolean {
  if ((cd[id] ?? 0) > 0) return false;
  cd[id] = skill(id).cooldown;
  return true;
}

/**
 * Damage a skill does: its base damage, a little more for each level above 1, times how much of
 * that element the monster takes. Rounded to whole points.
 */
export function skillDamage(base: number, level: number, perLevel: number, takes = 1): number {
  return Math.round(base * (1 + perLevel * Math.max(0, level - 1)) * takes);
}
