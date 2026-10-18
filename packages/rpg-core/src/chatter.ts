// What monsters say and show (config/chatter.json): when a monster speaks, which of its lines it
// picks, when it blinks. The lines themselves are text in the game (th.ts); here they are only
// counted. Random numbers come from the caller.

import chatterJson from '../config/chatter.json';
import { ConfigError, num, obj } from './config';

export const CHAT_EVENTS = [
  'idle',
  'notice',
  'attack',
  'hurt',
  'defeated',
  'respawn',
  'charge',
  'slam',
] as const;
export type ChatEvent = (typeof CHAT_EVENTS)[number];

export const EMOTES = ['excl', 'anger', 'sweat', 'swirl', 'note', 'zzz'] as const;
export type Emote = (typeof EMOTES)[number];

export interface ChatSpec {
  chance: Record<ChatEvent, number>;
  gap: number;
  idleEvery: [number, number];
  hearRange: number;
  showFor: number;
  maxBubbles: number;
  emote: Record<ChatEvent, Emote>;
  blinkEvery: [number, number];
  blinkFor: number;
  squash: { breathe: number; land: number; stretch: number; recover: number };
}

function range(v: unknown, where: string): [number, number] {
  if (
    !Array.isArray(v) ||
    v.length !== 2 ||
    !v.every((n) => typeof n === 'number' && n > 0) ||
    v[0] > v[1]
  )
    throw new ConfigError(`${where}: expected [shortest, longest] seconds`);
  return [v[0], v[1]];
}

export function readChatter(raw: unknown): ChatSpec {
  const w = 'chatter';
  const o = obj(raw, w);
  const c = obj(o.chance, `${w}.chance`);
  const e = obj(o.emote, `${w}.emote`);
  const sq = obj(o.squash, `${w}.squash`);
  const chance = {} as Record<ChatEvent, number>;
  const emote = {} as Record<ChatEvent, Emote>;
  for (const k of CHAT_EVENTS) {
    chance[k] = num(c, k, `${w}.chance`);
    if (chance[k] > 1) throw new ConfigError(`${w}.chance.${k}: expected 0..1`);
    const m = EMOTES.find((x) => x === e[k]);
    if (!m) throw new ConfigError(`${w}.emote.${k}: expected one of ${EMOTES.join(', ')}`);
    emote[k] = m;
  }
  return {
    chance,
    gap: num(o, 'gap', w),
    idleEvery: range(o.idleEvery, `${w}.idleEvery`),
    hearRange: num(o, 'hearRange', w, 1),
    showFor: num(o, 'showFor', w, 0.5),
    maxBubbles: num(o, 'maxBubbles', w, 1),
    emote,
    blinkEvery: range(o.blinkEvery, `${w}.blinkEvery`),
    blinkFor: num(o, 'blinkFor', w, 0.01),
    squash: {
      breathe: num(sq, 'breathe', `${w}.squash`),
      land: num(sq, 'land', `${w}.squash`),
      stretch: num(sq, 'stretch', `${w}.squash`),
      recover: num(sq, 'recover', `${w}.squash`, 0.1),
    },
  };
}

export const CHATTER: ChatSpec = readChatter(chatterJson);

/** One monster's voice: how long it keeps quiet, when it next remarks, its last line. */
export interface ChatVoice {
  quiet: number;
  idleIn: number;
  last: number;
  blinkIn: number;
}

const within = ([a, b]: [number, number], rng: () => number) => a + (b - a) * rng();

export function newVoice(rng: () => number, spec = CHATTER): ChatVoice {
  return {
    quiet: 0,
    idleIn: within(spec.idleEvery, rng),
    last: -1,
    blinkIn: within(spec.blinkEvery, rng),
  };
}

/**
 * Time passes for a voice. Returns whether it is time for an idle remark and whether to blink
 * now (each true for one step only).
 */
export function stepVoice(
  v: ChatVoice,
  dt: number,
  rng: () => number,
  spec = CHATTER,
): { remark: boolean; blink: boolean } {
  v.quiet = Math.max(0, v.quiet - dt);
  v.idleIn -= dt;
  v.blinkIn -= dt;
  const remark = v.idleIn <= 0;
  if (remark) v.idleIn = within(spec.idleEvery, rng);
  const blink = v.blinkIn <= 0;
  if (blink) v.blinkIn = within(spec.blinkEvery, rng);
  return { remark, blink };
}

/**
 * Whether the monster speaks for `event`, and which of its `count` lines (never the same one
 * twice running), or null. An event with chance 1 always speaks, even right after a line.
 */
export function speak(
  v: ChatVoice,
  event: ChatEvent,
  count: number,
  rng: () => number,
  spec = CHATTER,
): number | null {
  const chance = spec.chance[event];
  if (count <= 0 || (chance < 1 && v.quiet > 0) || rng() >= chance) return null;
  let i = Math.min(count - 1, Math.floor(rng() * count));
  if (count > 1 && i === v.last) i = (i + 1) % count;
  v.last = i;
  v.quiet = spec.gap;
  return i;
}
