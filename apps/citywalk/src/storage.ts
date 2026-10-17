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
