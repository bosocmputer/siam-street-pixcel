// What the player can tell the game to do, and which keys do it (config/controls.json).
// Touch buttons send the same actions, so the game does not care where a command came from.

import controlsJson from '../config/controls.json';
import { obj, strings } from './config';

export type HoldAction = 'forward' | 'back' | 'left' | 'right';
export type PressAction = 'skill1' | 'skill2' | 'target' | 'walk' | 'run' | 'bike';

const HOLD: HoldAction[] = ['forward', 'back', 'left', 'right'];
const PRESS: PressAction[] = ['skill1', 'skill2', 'target', 'walk', 'run', 'bike'];

export interface Bindings {
  hold: Map<string, HoldAction>;
  press: Map<string, PressAction>;
}

/** Read the key list; every action needs at least one key and no key may do two things. */
export function readBindings(raw: unknown): Bindings {
  const root = obj(raw, 'controls.json');
  const out: Bindings = { hold: new Map(), press: new Map() };
  const used = new Set<string>();
  const fill = <A extends string>(kind: 'hold' | 'press', names: A[], into: Map<string, A>) => {
    const o = obj(root[kind], `controls.${kind}`);
    for (const a of names) {
      const keys = strings(o[a], `controls.${kind}.${a}`);
      if (keys.length === 0) throw new Error(`controls.${kind}.${a}: needs at least one key`);
      for (const k of keys) {
        if (used.has(k)) throw new Error(`controls: ${k} is used twice`);
        used.add(k);
        into.set(k, a);
      }
    }
  };
  fill('hold', HOLD, out.hold);
  fill('press', PRESS, out.press);
  return out;
}

export const BINDINGS = readBindings(controlsJson);

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
