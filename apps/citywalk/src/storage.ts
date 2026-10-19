// Keeping the save on this device. Storage can be missing or refuse (private windows, blocked site
// data), so every call is guarded and the game simply plays without saving then.

import { decodeSave, encodeSave, type SaveData } from '@newgame/rpg-core';

const KEY = 'citywalk.save';

export function readSave(): SaveData | null {
  try {
    return decodeSave(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, encodeSave(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing saved, nothing to clear
  }
}

const PREFS_KEY = 'citywalk.sound';

export interface SoundPrefs {
  muted: boolean;
  volume: number;
}

export const DEFAULT_PREFS: SoundPrefs = { muted: false, volume: 0.7 };

/** Sound settings belong to this device, not to the game save, so "start again" keeps them. */
export function readPrefs(): SoundPrefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (typeof raw === 'object' && raw !== null) {
      const o = raw as Record<string, unknown>;
      const volume = o.volume;
      if (
        typeof o.muted === 'boolean' &&
        typeof volume === 'number' &&
        Number.isFinite(volume) &&
        volume >= 0 &&
        volume <= 1
      )
        return { muted: o.muted, volume };
    }
  } catch {
    // nothing stored, or storage is blocked
  }
  return { ...DEFAULT_PREFS };
}

export function writePrefs(p: SoundPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // the setting just does not stick
  }
}

const TEXT_KEY = 'citywalk.text';
export type TextSize = 'normal' | 'large';

/** The text size chosen on this device (like sound, not part of the game save). */
export function readTextSize(): TextSize {
  try {
    return localStorage.getItem(TEXT_KEY) === 'large' ? 'large' : 'normal';
  } catch {
    return 'normal';
  }
}

export function writeTextSize(t: TextSize): void {
  try {
    localStorage.setItem(TEXT_KEY, t);
  } catch {
    // the setting just does not stick
  }
}

/** Show every screen in this text size. */
export function applyTextSize(t: TextSize): void {
  document.documentElement.dataset.text = t;
}

const COMBOS_KEY = 'citywalk.combos';

/** The combos found so far on this device (the first time shows "combo found"). */
export function readFound(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(COMBOS_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeFound(found: ReadonlySet<string>): void {
  try {
    localStorage.setItem(COMBOS_KEY, JSON.stringify([...found]));
  } catch {
    // found again next time
  }
}

const ASSIST_KEY = 'citywalk.assist';

/** Combo help (longer to chain, a wider perfect dodge), chosen on this device. */
export function readAssist(): boolean {
  try {
    return localStorage.getItem(ASSIST_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeAssist(on: boolean): void {
  try {
    localStorage.setItem(ASSIST_KEY, on ? 'on' : 'off');
  } catch {
    // the setting just does not stick
  }
}
