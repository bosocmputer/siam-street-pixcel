// What the player can tell the game to do, and which keys do it (config/controls.json).
// Touch buttons send the same actions, so the game does not care where a command came from.

import controlsJson from '../config/controls.json';
import { ConfigError, num, obj, strings } from './config';

export type HoldAction = 'forward' | 'back' | 'left' | 'right' | 'sprint';
export type PressAction = 'strike' | 'dash' | 'skill1' | 'skill2' | 'target';

const HOLD: HoldAction[] = ['forward', 'back', 'left', 'right', 'sprint'];
export const PRESS_ACTIONS: readonly PressAction[] = [
  'strike',
  'dash',
  'skill1',
  'skill2',
  'target',
];

export interface Bindings {
  hold: Map<string, HoldAction>;
  press: Map<string, PressAction>;
  /** the stick pushed at least this far runs */
  runAt: number;
}

/** Read the key list; every action needs at least one key and no key may do two things. */
export function readBindings(raw: unknown): Bindings {
  const root = obj(raw, 'controls.json');
  const runAt = num(root, 'runAt', 'controls');
  if (runAt > 1) throw new ConfigError('controls.runAt: at most 1');
  const out: Bindings = { hold: new Map(), press: new Map(), runAt };
  const used = new Set<string>();
  const fill = <A extends string>(kind: 'hold' | 'press', names: A[], into: Map<string, A>) => {
    const o = obj(root[kind], `controls.${kind}`);
    for (const a of names) {
      const keys = strings(o[a], `controls.${kind}.${a}`);
      if (keys.length === 0) throw new ConfigError(`controls.${kind}.${a}: needs at least one key`);
      for (const k of keys) {
        if (used.has(k)) throw new ConfigError(`controls: ${k} is used twice`);
        used.add(k);
        into.set(k, a);
      }
    }
  };
  fill('hold', HOLD, out.hold);
  fill('press', [...PRESS_ACTIONS], out.press);
  return out;
}

export const BINDINGS = readBindings(controlsJson);

/**
 * Walk or run: running when sprint is held or the stick is pushed at least runAt; the faster
 * modes (a rented ride) are chosen elsewhere.
 */
export function gait(push: number, sprint: boolean, runAt = BINDINGS.runAt): 'walk' | 'run' {
  return sprint || push >= runAt ? 'run' : 'walk';
}

/** Turn held movement actions into a direction: forward and right in -1..1, length at most 1. */
export function moveFrom(held: ReadonlySet<HoldAction>): { forward: number; right: number } {
  let forward = (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0);
  let right = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  const len = Math.hypot(forward, right);
  if (len > 1) {
    forward /= len;
    right /= len;
  }
  return { forward, right };
}
