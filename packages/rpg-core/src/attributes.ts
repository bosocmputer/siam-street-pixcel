// The five attributes, the points to raise them, and the job wheel (GDD v2.2 section 6). Numbers
// come from config/attributes.json.

import attributesJson from '../config/attributes.json';
import { ConfigError, num, obj, pick, strings } from './config';

export const ATTRS = ['str', 'agi', 'dex', 'int', 'vit'] as const;
export type Attr = (typeof ATTRS)[number];
export type Attrs = Record<Attr, number>;
export type Range = 'near' | 'far';

export interface JobSpec {
  id: string;
  between: [Attr, Attr];
  range: Range;
}

export interface AttrSpec {
  /** the wheel, clockwise from the top */
  order: Attr[];
  base: number;
  perLevel: number;
  /** one per side of the wheel, in the wheel's order */
  jobs: JobSpec[];
  secret: { id: string; spread: number };
  jobLevel: number;
  hintLevels: number[];
  effects: { hpPerVit: number; energyPerInt: number; powerPerPoint: number };
}

export function readAttributes(raw: unknown): AttrSpec {
  const w = 'attributes';
  const o = obj(raw, 'attributes.json');
  const order = strings(o.order, `${w}.order`).map((a) => {
    const found = ATTRS.find((x) => x === a);
    if (!found) throw new ConfigError(`${w}.order: no attribute called ${a}`);
    return found;
  });
  if (order.length !== ATTRS.length || new Set(order).size !== ATTRS.length)
    throw new ConfigError(`${w}.order: list each of ${ATTRS.join(', ')} once`);
  if (!Array.isArray(o.jobs)) throw new ConfigError(`${w}.jobs: expected a list`);
  const jobs = o.jobs.map((j, i): JobSpec => {
    const jo = obj(j, `${w}.jobs[${i}]`);
    const between = strings(jo.between, `${w}.jobs[${i}].between`);
    const a = order[i]!,
      b = order[(i + 1) % order.length]!;
    if (between.length !== 2 || between[0] !== a || between[1] !== b)
      throw new ConfigError(
        `${w}.jobs[${i}].between: expected ["${a}", "${b}"] (the wheel's side)`,
      );
    if (typeof jo.id !== 'string' || !jo.id) throw new ConfigError(`${w}.jobs[${i}].id: missing`);
    return {
      id: jo.id,
      between: [a, b],
      range: pick(jo, 'range', `${w}.jobs[${i}]`, ['near', 'far']),
    };
  });
  if (jobs.length !== order.length)
    throw new ConfigError(`${w}.jobs: expected one job for each of the ${order.length} sides`);
  const secret = obj(o.secret, `${w}.secret`);
  if (typeof secret.id !== 'string' || !secret.id) throw new ConfigError(`${w}.secret.id: missing`);
  const effects = obj(o.effects, `${w}.effects`);
  const hints = o.hintLevels;
  if (!Array.isArray(hints) || !hints.every((h) => Number.isInteger(h) && h >= 1))
    throw new ConfigError(`${w}.hintLevels: expected a list of levels`);
  return {
    order,
    base: num(o, 'base', w, 1),
    perLevel: num(o, 'perLevel', w, 1),
    jobs,
    secret: { id: secret.id, spread: num(secret, 'spread', `${w}.secret`) },
    jobLevel: num(o, 'jobLevel', w, 2),
    hintLevels: hints as number[],
    effects: {
      hpPerVit: num(effects, 'hpPerVit', `${w}.effects`),
      energyPerInt: num(effects, 'energyPerInt', `${w}.effects`),
      powerPerPoint: num(effects, 'powerPerPoint', `${w}.effects`),
    },
  };
}

export const ATTR = readAttributes(attributesJson);

/** Every job id, the wheel's first and the secret one last. */
export const JOB_IDS = [...ATTR.jobs.map((j) => j.id), ATTR.secret.id];

export const baseAttrs = (spec = ATTR): Attrs =>
  Object.fromEntries(ATTRS.map((a) => [a, spec.base])) as Attrs;

/** Points the player has had by this level. */
export const pointsEarned = (level: number, spec = ATTR) => spec.perLevel * Math.max(0, level - 1);
export const pointsSpent = (a: Attrs, spec = ATTR) =>
  ATTRS.reduce((n, k) => n + (a[k] - spec.base), 0);
export const pointsLeft = (a: Attrs, level: number, spec = ATTR) =>
  pointsEarned(level, spec) - pointsSpent(a, spec);

/**
 * The attributes after putting `add` on them, or null if that is not allowed: whole numbers,
 * nothing taken away, and no more than the points left.
 */
export function addPoints(a: Attrs, add: Partial<Attrs>, level: number, spec = ATTR): Attrs | null {
  let total = 0;
  const out = { ...a };
  for (const [k, n] of Object.entries(add)) {
    const key = ATTRS.find((x) => x === k);
    if (!key || n === undefined || !Number.isInteger(n) || n < 0) return null;
    out[key] += n;
    total += n;
  }
  return total <= pointsLeft(a, level, spec) ? out : null;
}

/** Are these attributes possible at this level? (for reading a save) */
export function validAttrs(raw: unknown, level: number, spec = ATTR): Attrs | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out = baseAttrs(spec);
  for (const k of ATTRS) {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < spec.base) return null;
    out[k] = v;
  }
  return pointsSpent(out, spec) <= pointsEarned(level, spec) ? out : null;
}

/** The highest attribute (the first on the wheel when several share it). */
export function leaning(a: Attrs, spec = ATTR): Attr {
  return spec.order.reduce((best, k) => (a[k] > a[best] ? k : best), spec.order[0]!);
}

export interface JobPick {
  /** the job these attributes give */
  job: string;
  /** wheel sides as good as the winner (more than one only on a tie), by job id */
  ties: string[];
}

/**
 * The job these attributes give at the job level. The highest attribute and its higher neighbour
 * on the wheel pick the side. Sides that tie go to the player's way of fighting (`range`), then
 * to the wheel's order. All attributes within `spread` of each other with the three-hands task
 * done gives the secret job.
 */
export function pickJob(
  a: Attrs,
  how: { range?: Range | null; trio?: boolean } = {},
  spec = ATTR,
): JobPick {
  const values = ATTRS.map((k) => a[k]);
  const top = Math.max(...values);
  if (how.trio && top - Math.min(...values) <= spec.secret.spread)
    return { job: spec.secret.id, ties: [] };
  let best: JobSpec[] = [];
  let score = -Infinity;
  for (const j of spec.jobs) {
    const [x, y] = [a[j.between[0]], a[j.between[1]]];
    if (Math.max(x, y) !== top) continue;
    const s = Math.min(x, y);
    if (s > score) [score, best] = [s, [j]];
    else if (s === score) best.push(j);
  }
  const ties = best.length > 1 ? best.map((j) => j.id) : [];
  const suits = best.filter((j) => j.range === how.range);
  return { job: (suits[0] ?? best[0]!).id, ties };
}

/** What the attributes add: max health, max energy, and a skill power multiplier. */
export function attrBonus(a: Attrs, spec = ATTR): { hp: number; energy: number; power: number } {
  const e = spec.effects;
  return {
    hp: e.hpPerVit * (a.vit - spec.base),
    energy: e.energyPerInt * (a.int - spec.base),
    power: 1 + e.powerPerPoint * (Math.max(...ATTRS.map((k) => a[k])) - spec.base),
  };
}
