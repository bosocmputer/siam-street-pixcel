// Sound recipes (config/sounds.json): what each sound is made of. The browser makes the sound;
// everything here is plain data and checks, so it can be tested without any audio.

import soundsJson from '../config/sounds.json';
import { ConfigError, flag, num, numOr, obj, pick } from './config';

export const WAVES = ['sine', 'triangle', 'square', 'sawtooth'] as const;
export const NOISE_COLORS = ['white', 'pink', 'brown'] as const;
export const FILTERS = ['lowpass', 'highpass', 'bandpass'] as const;
export type Wave = (typeof WAVES)[number];
export type NoiseColor = (typeof NOISE_COLORS)[number];
export type FilterType = (typeof FILTERS)[number];

/** A glide from one number to another over the layer's life. */
export interface Sweep {
  from: number;
  to: number;
  curve: 'exp' | 'lin';
}

export interface Wobble {
  from: number;
  to: number;
  depth: number;
}

export interface FilterSpec {
  type: FilterType;
  from: number;
  to: number;
  q: number;
}

/** Loudness over time: up over `attack` to `peak`, held for `hold`, then dying away over `release`. */
export interface Envelope {
  attack: number;
  hold: number;
  release: number;
  peak: number;
}

export interface Layer {
  kind: 'osc' | 'noise';
  wave: Wave;
  color: NoiseColor;
  /** pitch glide of a tone (null for noise) */
  freq: Sweep | null;
  filter: FilterSpec | null;
  env: Envelope;
  /** seconds after the start of the sound */
  at: number;
  repeat: { count: number; spread: number };
  /** how much each copy's pitch may differ, as a fraction */
  jitter: number;
  /** loudness throbbing (a whirr, a flutter): `from` → `to` beats a second, `depth` 0..1 */
  wobble: Wobble | null;
  /** 0..1, roughens the layer (crunchy fire); 0 leaves it clean */
  drive: number;
  /** seconds this layer sounds for: attack + hold + release */
  length: number;
}

export interface SoundSpec {
  id: string;
  volume: number;
  priority: 1 | 2 | 3;
  cooldown: number;
  spatial: boolean;
  /** plays until the game stops it (a fireball's roar while it flies); the recipe is the longest */
  held: boolean;
  alert: boolean;
  /** level other sounds drop to while an alert plays (1 = no change) */
  duck: number;
  layers: Layer[];
  /** seconds from the start until the last layer has died away */
  length: number;
}

export interface SoundsConfig {
  sounds: Record<string, SoundSpec>;
  limits: { voices: number };
  spatial: { near: number; far: number };
  footsteps: { walk: number; run: number; bike: number };
  combo: { window: number; step: number; max: number };
}

function readLayer(raw: unknown, w: string): Layer {
  const o = obj(raw, w);
  const kind = pick(o, 'kind', w, ['osc', 'noise'] as const);
  const envO = obj(o.env, `${w}.env`);
  const env: Envelope = {
    attack: num(envO, 'attack', `${w}.env`),
    hold: numOr(envO, 'hold', `${w}.env`, 0),
    release: num(envO, 'release', `${w}.env`, 0.005),
    peak: numOr(envO, 'peak', `${w}.env`, 1),
  };
  if (env.peak > 2) throw new ConfigError(`${w}.env.peak: expected 0..2, got ${env.peak}`);
  let freq: Sweep | null = null;
  if (kind === 'osc') {
    const f = obj(o.freq, `${w}.freq`);
    freq = {
      from: num(f, 'from', `${w}.freq`, 1),
      to: num(f, 'to', `${w}.freq`, 1),
      curve: pick(f, 'curve', `${w}.freq`, ['exp', 'lin'] as const, 'exp'),
    };
    if (freq.from > 20000 || freq.to > 20000)
      throw new ConfigError(`${w}.freq: expected pitches up to 20000 Hz`);
  }
  let filter: FilterSpec | null = null;
  if (o.filter !== undefined) {
    const f = obj(o.filter, `${w}.filter`);
    filter = {
      type: pick(f, 'type', `${w}.filter`, FILTERS),
      from: num(f, 'from', `${w}.filter`, 20),
      to: num(f, 'to', `${w}.filter`, 20),
      q: numOr(f, 'q', `${w}.filter`, 1, 0.1),
    };
    if (filter.from > 20000 || filter.to > 20000 || filter.q > 30)
      throw new ConfigError(`${w}.filter: expected up to 20000 Hz and q up to 30`);
  }
  const r = o.repeat === undefined ? {} : obj(o.repeat, `${w}.repeat`);
  const repeat = {
    count: numOr(r, 'count', `${w}.repeat`, 1, 1),
    spread: numOr(r, 'spread', `${w}.repeat`, 0),
  };
  if (!Number.isInteger(repeat.count) || repeat.count > 40)
    throw new ConfigError(`${w}.repeat.count: expected a whole number from 1 to 40`);
  const jitter = numOr(o, 'jitter', w, 0);
  if (jitter > 0.9) throw new ConfigError(`${w}.jitter: expected 0..0.9, got ${jitter}`);
  let wobble: Wobble | null = null;
  if (o.wobble !== undefined) {
    const b = obj(o.wobble, `${w}.wobble`);
    wobble = {
      from: num(b, 'from', `${w}.wobble`, 0.1),
      to: num(b, 'to', `${w}.wobble`, 0.1),
      depth: num(b, 'depth', `${w}.wobble`),
    };
    if (wobble.from > 60 || wobble.to > 60 || wobble.depth > 1)
      throw new ConfigError(`${w}.wobble: expected up to 60 beats a second and depth 0..1`);
  }
  const drive = numOr(o, 'drive', w, 0);
  if (drive > 1) throw new ConfigError(`${w}.drive: expected 0..1, got ${drive}`);
  return {
    kind,
    wave: pick(o, 'wave', w, WAVES, 'sine'),
    color: pick(o, 'color', w, NOISE_COLORS, 'white'),
    freq,
    filter,
    env,
    at: numOr(o, 'at', w, 0),
    repeat,
    jitter,
    wobble,
    drive,
    length: env.attack + env.hold + env.release,
  };
}

/** Read and check config/sounds.json. */
export function readSounds(raw: unknown): SoundsConfig {
  const root = obj(raw, 'sounds.json');
  const list = obj(root.sounds, 'sounds.json sounds');
  const sounds: Record<string, SoundSpec> = {};
  for (const id of Object.keys(list)) {
    const w = `sounds.${id}`;
    const o = obj(list[id], w);
    if (!Array.isArray(o.layers) || o.layers.length === 0)
      throw new ConfigError(`${w}.layers: expected at least one layer`);
    const layers = o.layers.map((l, i) => readLayer(l, `${w}.layers[${i}]`));
    const priority = num(o, 'priority', w, 1);
    if (priority !== 1 && priority !== 2 && priority !== 3)
      throw new ConfigError(`${w}.priority: expected 1, 2 or 3, got ${priority}`);
    const volume = num(o, 'volume', w);
    if (volume > 1.5) throw new ConfigError(`${w}.volume: expected 0..1.5, got ${volume}`);
    const alert = flag(o, 'alert', w, false);
    const duck = numOr(o, 'duck', w, 1);
    if (duck > 1) throw new ConfigError(`${w}.duck: expected 0..1, got ${duck}`);
    if (alert && duck === 1) throw new ConfigError(`${w}: an alert needs a duck below 1`);
    sounds[id] = {
      id,
      volume,
      priority,
      cooldown: numOr(o, 'cooldown', w, 0),
      spatial: flag(o, 'spatial', w, false),
      held: flag(o, 'held', w, false),
      alert,
      duck,
      layers,
      length: Math.max(...layers.map((l) => l.at + l.repeat.spread + l.length)),
    };
  }
  if (Object.keys(sounds).length === 0) throw new ConfigError('sounds.json: no sounds');
  const limits = obj(root.limits, 'sounds.limits');
  const spatial = obj(root.spatial, 'sounds.spatial');
  const steps = obj(root.footsteps, 'sounds.footsteps');
  const combo = obj(root.combo, 'sounds.combo');
  const cfg: SoundsConfig = {
    sounds,
    limits: { voices: num(limits, 'voices', 'sounds.limits', 1) },
    spatial: {
      near: num(spatial, 'near', 'sounds.spatial', 0.1),
      far: num(spatial, 'far', 'sounds.spatial', 1),
    },
    footsteps: {
      walk: num(steps, 'walk', 'sounds.footsteps', 0.05),
      run: num(steps, 'run', 'sounds.footsteps', 0.05),
      bike: num(steps, 'bike', 'sounds.footsteps', 0.05),
    },
    combo: {
      window: num(combo, 'window', 'sounds.combo'),
      step: num(combo, 'step', 'sounds.combo'),
      max: num(combo, 'max', 'sounds.combo', 1),
    },
  };
  if (cfg.spatial.far <= cfg.spatial.near)
    throw new ConfigError('sounds.spatial: expected far to be more than near');
  // every footstep sound the game asks for must exist
  for (const mode of ['walk', 'run', 'bike'] as const)
    if (!sounds[`step.${mode}`]) throw new ConfigError(`sounds: missing step.${mode}`);
  return cfg;
}

const CONFIG = readSounds(soundsJson);
export const SOUNDS: Readonly<Record<string, SoundSpec>> = CONFIG.sounds;
export const SOUND_LIMITS = CONFIG.limits;
export const SPATIAL = CONFIG.spatial;
export const FOOTSTEPS = CONFIG.footsteps;
export const COMBO = CONFIG.combo;

/** One sound by id; an id that is not in the config is a mistake in the code or config. */
export function sound(id: string): SoundSpec {
  const s = SOUNDS[id];
  if (!s) throw new ConfigError(`unknown sound: ${id}`);
  return s;
}
