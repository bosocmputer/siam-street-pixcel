// Story quests, one at a time (config/quests.json): where to go, who to talk to, what to beat or
// dodge, and what each gives. The game reports what happened; this keeps count and says when a
// step or a quest is done. No three.js and no clock here.

import questsJson from '../config/quests.json';
import { ConfigError, num, obj, pick } from './config';
import { MONSTERS } from './monsters';
import { validLook, type Look } from './look';

export const STEP_KINDS = ['reach', 'talk', 'defeat', 'dodge'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export type QuestStep =
  | { do: 'reach'; place: string; radius: number }
  | { do: 'talk'; npc: string; line: string }
  | { do: 'defeat'; species: string | null; count: number }
  | { do: 'dodge'; count: number };

export interface QuestSpec {
  id: string;
  steps: QuestStep[];
  reward: { exp: number; learn: string | null };
  next: string | null;
}

export interface NpcSpec {
  id: string;
  place: string;
  look: Look;
}

export interface QuestBook {
  places: Record<string, [number, number]>;
  npcs: Record<string, NpcSpec>;
  first: string;
  quests: Record<string, QuestSpec>;
}

const str = (o: Record<string, unknown>, key: string, where: string): string => {
  const v = o[key];
  if (typeof v !== 'string' || v === '') throw new ConfigError(`${where}.${key}: expected a name`);
  return v;
};

/** Read and check config/quests.json against the places, npcs and monsters it names. */
export function readQuests(raw: unknown, species = Object.keys(MONSTERS)): QuestBook {
  const root = obj(raw, 'quests.json');
  const places: Record<string, [number, number]> = {};
  for (const [id, v] of Object.entries(obj(root.places, 'quests.places'))) {
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => Number.isFinite(n)))
      throw new ConfigError(`quests.places.${id}: expected [x, z]`);
    places[id] = [v[0] as number, v[1] as number];
  }
  const npcs: Record<string, NpcSpec> = {};
  for (const [id, v] of Object.entries(obj(root.npcs, 'quests.npcs'))) {
    const w = `quests.npcs.${id}`;
    const o = obj(v, w);
    const place = str(o, 'place', w);
    if (!places[place]) throw new ConfigError(`${w}.place: no place called ${place}`);
    // checked as the character screen would (with a stand-in name: the real one is in th.ts)
    const look = validLook({ ...obj(o.look, `${w}.look`), name: 'npc' });
    if (!look) throw new ConfigError(`${w}.look: not a look the character screen can make`);
    npcs[id] = { id, place, look: { ...look, name: '' } };
  }
  const list = obj(root.quests, 'quests.quests');
  const quests: Record<string, QuestSpec> = {};
  for (const [id, v] of Object.entries(list)) {
    const w = `quests.${id}`;
    const o = obj(v, w);
    if (!Array.isArray(o.steps) || o.steps.length === 0)
      throw new ConfigError(`${w}.steps: expected a list of steps`);
    const steps = o.steps.map((s: unknown, i): QuestStep => {
      const sw = `${w}.steps.${i}`;
      const so = obj(s, sw);
      const kind = pick(so, 'do', sw, STEP_KINDS);
      if (kind === 'reach') {
        const place = str(so, 'place', sw);
        if (!places[place]) throw new ConfigError(`${sw}.place: no place called ${place}`);
        return { do: 'reach', place, radius: num(so, 'radius', sw, 0.5) };
      }
      if (kind === 'talk') {
        const npc = str(so, 'npc', sw);
        if (!npcs[npc]) throw new ConfigError(`${sw}.npc: no npc called ${npc}`);
        return { do: 'talk', npc, line: str(so, 'line', sw) };
      }
      const count = num(so, 'count', sw, 1);
      if (!Number.isInteger(count)) throw new ConfigError(`${sw}.count: expected a whole number`);
      if (kind === 'dodge') return { do: 'dodge', count };
      const sp = so.species === null ? null : str(so, 'species', sw);
      if (sp !== null && !species.includes(sp))
        throw new ConfigError(`${sw}.species: no monster called ${sp}`);
      return { do: 'defeat', species: sp, count };
    });
    const r = obj(o.reward, `${w}.reward`);
    const learn = r.learn === null ? null : str(r, 'learn', `${w}.reward`);
    const next = o.next === null ? null : str(o, 'next', w);
    quests[id] = { id, steps, reward: { exp: num(r, 'exp', `${w}.reward`), learn }, next };
  }
  for (const q of Object.values(quests))
    if (q.next !== null && !quests[q.next])
      throw new ConfigError(`quests.${q.id}.next: no quest called ${q.next}`);
  const first = str(root, 'first', 'quests');
  if (!quests[first]) throw new ConfigError(`quests.first: no quest called ${first}`);
  return { places, npcs, first, quests };
}

export const QUESTS = readQuests(questsJson);

/** Where the player is in the story: the quest under way (null when there is none left). */
export interface QuestLog {
  id: string | null;
  /** the step under way */
  step: number;
  /** monsters beaten or warnings dodged in this step so far */
  count: number;
  /** quests finished, in order */
  done: string[];
}

export const newQuestLog = (book = QUESTS): QuestLog => ({
  id: book.first,
  step: 0,
  count: 0,
  done: [],
});

/** The quest and step under way, or null. */
export function current(
  log: QuestLog,
  book = QUESTS,
): { quest: QuestSpec; step: QuestStep } | null {
  const quest = log.id === null ? undefined : book.quests[log.id];
  const step = quest?.steps[log.step];
  return quest && step ? { quest, step } : null;
}

/** Where the step under way leads, map-frame [x, z] in the gate frame, or null (beat, dodge). */
export function goalOf(log: QuestLog, book = QUESTS): [number, number] | null {
  const c = current(log, book);
  if (!c) return null;
  if (c.step.do === 'reach') return book.places[c.step.place]!;
  if (c.step.do === 'talk') return book.places[book.npcs[c.step.npc]!.place]!;
  return null;
}

/** How far the step under way has got: [done, needed]. */
export function stepCount(log: QuestLog, book = QUESTS): [number, number] {
  const c = current(log, book);
  if (!c) return [0, 0];
  const s = c.step;
  return s.do === 'defeat' || s.do === 'dodge' ? [log.count, s.count] : [0, 1];
}

export type QuestEvent =
  | { kind: 'reach'; place: string }
  | { kind: 'talk'; npc: string }
  | { kind: 'defeat'; species: string }
  | { kind: 'dodge' };

/**
 * Something happened. If it counts for the step under way the log moves on; the result says
 * whether a step ended, and the quest that was finished (for its reward), if one was.
 */
export function questEvent(
  log: QuestLog,
  e: QuestEvent,
  book = QUESTS,
): { stepped: boolean; finished: QuestSpec | null } {
  const none = { stepped: false, finished: null };
  const c = current(log, book);
  if (!c) return none;
  const s = c.step;
  let counts = false;
  if (s.do === 'reach') counts = e.kind === 'reach' && e.place === s.place;
  else if (s.do === 'talk') counts = e.kind === 'talk' && e.npc === s.npc;
  else if (s.do === 'defeat')
    counts = e.kind === 'defeat' && (s.species === null || s.species === e.species);
  else counts = e.kind === 'dodge';
  if (!counts) return none;
  log.count++;
  const needed = s.do === 'defeat' || s.do === 'dodge' ? s.count : 1;
  if (log.count < needed) return none;
  log.count = 0;
  log.step++;
  if (log.step < c.quest.steps.length) return { stepped: true, finished: null };
  log.done.push(c.quest.id);
  log.id = c.quest.next;
  log.step = 0;
  return { stepped: true, finished: c.quest };
}

/** A quest log read back from a save, or null if it does not fit the quests as they are now. */
export function validQuestLog(raw: unknown, book = QUESTS): QuestLog | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id =
    o.id === null ? null : typeof o.id === 'string' && book.quests[o.id] ? o.id : undefined;
  if (id === undefined) return null;
  const { step, count, done } = o;
  if (!Number.isInteger(step) || !Number.isInteger(count) || (step as number) < 0) return null;
  if ((count as number) < 0) return null;
  if (id !== null && (step as number) >= book.quests[id]!.steps.length) return null;
  if (!Array.isArray(done) || !done.every((d) => typeof d === 'string' && book.quests[d]))
    return null;
  return { id, step: step as number, count: count as number, done: [...(done as string[])] };
}
