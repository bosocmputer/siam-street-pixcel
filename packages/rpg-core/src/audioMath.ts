// The rules around sound that need no audio to test: how many sounds may play at once, which are
// cut first, how loud and on which side a sound at a place should be, when footsteps fall, and the
// rising pitch of picking things up one after another.

import { COMBO, FOOTSTEPS, SOUND_LIMITS, SPATIAL, type SoundSpec } from './sounds';

export interface Voice {
  uid: number;
  id: string;
  /** when it dies away, in seconds on the audio clock */
  end: number;
  priority: number;
}

export interface Mixer {
  voices: Voice[];
  lastPlayed: Record<string, number>;
  next: number;
  /** other sounds are held down to duckLevel until this time */
  duckUntil: number;
  duckLevel: number;
}

export const newMixer = (): Mixer => ({
  voices: [],
  lastPlayed: {},
  next: 1,
  duckUntil: 0,
  duckLevel: 1,
});

export interface Decision {
  play: boolean;
  /** the voice to cut to make room, if any */
  steal: number | null;
  uid: number;
}

/**
 * May this sound play now? `length` is how long it will last (it can be stretched). A sound is
 * refused if the same one played too recently, or if too many are playing and all of them matter
 * more. Otherwise the quietest-priority voice (the one that ends soonest among equals) is cut.
 * Playing registers the voice, and an alert holds the other sounds down while it lasts.
 */
export function request(
  m: Mixer,
  s: SoundSpec,
  now: number,
  length: number = s.length,
  max: number = SOUND_LIMITS.voices,
): Decision {
  m.voices = m.voices.filter((v) => v.end > now);
  const last = m.lastPlayed[s.id];
  if (last !== undefined && now - last < s.cooldown) return { play: false, steal: null, uid: 0 };
  let steal: number | null = null;
  if (m.voices.length >= max) {
    const victim = m.voices.reduce((a, b) =>
      b.priority < a.priority || (b.priority === a.priority && b.end < a.end) ? b : a,
    );
    if (victim.priority > s.priority) return { play: false, steal: null, uid: 0 };
    steal = victim.uid;
    m.voices = m.voices.filter((v) => v.uid !== victim.uid);
  }
  const uid = m.next++;
  m.voices.push({ uid, id: s.id, end: now + length, priority: s.priority });
  m.lastPlayed[s.id] = now;
  if (s.alert) {
    m.duckUntil = now + length;
    m.duckLevel = s.duck;
  }
  return { play: true, steal, uid };
}

/**
 * A held sound (a fireball's roar while it flies) was cut short at `now`: its place is free once
 * its fade of `fade` seconds is over, not when its recipe would have ended.
 */
export function release(m: Mixer, uid: number, now: number, fade = 0): void {
  for (const v of m.voices) if (v.uid === uid) v.end = Math.min(v.end, now + fade);
}

/** How much to turn the other sounds down at this moment (1 = not at all). */
export const duckGain = (m: Mixer, now: number): number => (now < m.duckUntil ? m.duckLevel : 1);

/**
 * Where a sound at `source` seems to be to someone at `listener` looking along (-sin yaw,
 * -cos yaw): `pan` from -1 (left) to 1 (right), and `gain` from 1 (close) falling to 0 far away.
 */
export function spatialize(
  listener: { x: number; z: number; yaw: number },
  source: { x: number; z: number },
  spec = SPATIAL,
): { pan: number; gain: number } {
  const dx = source.x - listener.x,
    dz = source.z - listener.z;
  const d = Math.hypot(dx, dz);
  let gain = d <= spec.near ? 1 : spec.near / d;
  const fadeFrom = spec.far * 0.7;
  if (d >= spec.far) gain = 0;
  else if (d > fadeFrom) gain *= (spec.far - d) / (spec.far - fadeFrom);
  if (d < 0.5) return { pan: 0, gain };
  // right of the listener is (cos yaw, -sin yaw)
  const side = (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / d;
  // a sound right beside you comes from the middle, one further off leans to its side
  return { pan: side * Math.min(1, d / 2) * 0.85, gain };
}

export type StepMode = keyof typeof FOOTSTEPS;

/** The beat of footsteps: time since the last one. */
export interface StepClock {
  t: number;
}

export const newStepClock = (): StepClock => ({ t: 0 });

/**
 * Advance the beat by dt; returns how many footsteps fall in it. Starting to move gives the first
 * step soon, and standing still resets the beat.
 */
export function advanceSteps(
  c: StepClock,
  dt: number,
  moving: boolean,
  mode: StepMode,
  intervals = FOOTSTEPS,
): number {
  const every = intervals[mode];
  if (!moving) {
    c.t = every * 0.6;
    return 0;
  }
  c.t += dt;
  let n = 0;
  while (c.t >= every) {
    c.t -= every;
    n++;
  }
  return n;
}

export interface Combo {
  /** when the last one was picked up, seconds (negative = never) */
  last: number;
  n: number;
}

export const newCombo = (): Combo => ({ last: -1e9, n: 0 });

/**
 * Pitch for picking something up at `now`: each pickup soon after the last is a little higher, up
 * to a limit, and a pause starts again from 1.
 */
export function nextCombo(c: Combo, now: number, cfg = COMBO): number {
  c.n = now - c.last <= cfg.window ? Math.min(cfg.max, c.n + 1) : 0;
  c.last = now;
  return 1 + c.n * cfg.step;
}
