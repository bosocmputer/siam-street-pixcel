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
