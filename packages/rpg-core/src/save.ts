// What is kept between visits, and how it is checked when read back. The app decides where it is
// stored (this device for now) and passes in the time; nothing here reads the clock.

import { CAMERA_MODES, type CameraMode } from './camera';
import { ITEMS, MAX_STACK, type Inventory } from './items';

export const SAVE_VERSION = 3;
/** the view a save from before the camera setting comes back with */
export const DEFAULT_CAMERA: CameraMode = 'shoulder';

export type MoveMode = 'walk' | 'run' | 'bike';

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** when it was saved, milliseconds since 1970 (given by the app) */
  savedAt: number;
  player: { x: number; z: number; heading: number };
  settings: { mode: MoveMode; scale: number; labels: boolean; haze: boolean; camera: CameraMode };
  /** level and experience; health and energy as they were (version 2 on) */
  stats: { level: number; exp: number; hp: number; energy: number };
  /** what the player carries, by item id (version 3 on) */
  items: Inventory;
}

const MODES: MoveMode[] = ['walk', 'run', 'bike'];
const SCALES = [1, 0.5, 1 / 3];

export function encodeSave(d: SaveData): string {
  return JSON.stringify(d);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Read a save back. Anything damaged, from a newer version of the game, or out of range gives
 * null, and the game starts fresh instead of breaking. An older save still reads: version 1
 * (before levels) comes back at level 1 with full health and energy (`fresh`), and anything
 * before version 3 comes back with an empty bag and the default camera. Items that are no longer
 * in the game are dropped from the bag rather than spoiling the whole save.
 */
export function decodeSave(
  text: string | null,
  fresh: SaveData['stats'] = { level: 1, exp: 0, hp: 100, energy: 100 },
): SaveData | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !isObj(raw) ||
    (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) ||
    !isNum(raw.savedAt)
  )
    return null;
  const p = raw.player,
    s = raw.settings;
  if (!isObj(p) || !isObj(s)) return null;
  if (!isNum(p.x) || !isNum(p.z) || !isNum(p.heading)) return null;
  if (Math.abs(p.x) > 1e5 || Math.abs(p.z) > 1e5) return null;
  const mode = MODES.find((m) => m === s.mode);
  const scale = SCALES.find((v) => isNum(s.scale) && Math.abs(v - s.scale) < 1e-6);
  if (!mode || scale === undefined) return null;
  if (typeof s.labels !== 'boolean' || typeof s.haze !== 'boolean') return null;
  let camera = DEFAULT_CAMERA;
  const items: Inventory = {};
  if (raw.version === 3) {
    const c = CAMERA_MODES.find((m) => m === s.camera);
    if (!c) return null;
    camera = c;
    if (!isObj(raw.items)) return null;
    for (const [id, n] of Object.entries(raw.items)) {
      if (!isNum(n) || !Number.isInteger(n) || n < 0 || n > MAX_STACK) return null;
      if (id in ITEMS && n > 0) items[id] = n;
    }
  }
  let stats = fresh;
  if (raw.version >= 2) {
    const t = raw.stats;
    if (!isObj(t) || !isNum(t.level) || !isNum(t.exp) || !isNum(t.hp) || !isNum(t.energy))
      return null;
    if (!Number.isInteger(t.level) || t.level < 1 || t.level > 999) return null;
    if (t.exp < 0 || t.hp < 0 || t.energy < 0) return null;
    stats = { level: t.level, exp: t.exp, hp: t.hp, energy: t.energy };
  }
  return {
    version: SAVE_VERSION,
    savedAt: raw.savedAt,
    player: { x: p.x, z: p.z, heading: p.heading },
    settings: { mode, scale, labels: s.labels, haze: s.haze, camera },
    stats,
    items,
  };
}
