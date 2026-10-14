import { getItemDef } from './lookup';
import {
  STAT_KEYS,
  type GameConfig,
  type Loadout,
  type PlayerState,
  type Rarity,
  type Result,
  type Slot,
} from './types';

export function capacity(state: PlayerState, cfg: GameConfig): number {
  const i = cfg.balance.inventory;
  return i.baseCapacity + Math.floor(state.level / 5) * i.capacityPerFiveLevels;
}

/** Items that count against capacity (equipped items always fit). */
export function usedSlots(state: PlayerState): number {
  const equipped = new Set(Object.values(state.equipment));
  return state.items.filter((x) => !equipped.has(x.uid)).length;
}

export type EquipFail = 'notFound';

export function equipItem(
  state: PlayerState,
  uid: string,
  cfg: GameConfig,
): Result<{ state: PlayerState; slot: Slot }, EquipFail> {
  const inst = state.items.find((x) => x.uid === uid);
  if (!inst) return { ok: false, reason: 'notFound' };
  const slot = getItemDef(cfg, inst.defId).slot;
  const next = structuredClone(state);
  next.equipment[slot] = uid;
  return { ok: true, state: next, slot };
}

export function unequipSlot(state: PlayerState, slot: Slot): PlayerState {
  const next = structuredClone(state);
  delete next.equipment[slot];
  return next;
}

export function setAutoSalvage(state: PlayerState, below: Rarity | null): PlayerState {
  const next = structuredClone(state);
  next.autoSalvageBelow = below;
  return next;
}

// ---- presets ----

function currentLoadout(state: PlayerState): Loadout {
  return {
    activeSkills: [...state.activeSkills],
    passiveSkills: [...state.passiveSkills],
    equipment: { ...state.equipment },
    stats: { ...state.stats },
  };
}

export type PresetFail = 'badSlot' | 'empty' | 'tooManyPoints';

export function savePreset(
  state: PlayerState,
  index: number,
  cfg: GameConfig,
): Result<{ state: PlayerState }, PresetFail> {
  if (!Number.isInteger(index) || index < 0 || index >= cfg.balance.inventory.presetCount) {
    return { ok: false, reason: 'badSlot' };
  }
  const next = structuredClone(state);
  next.presets[index] = currentLoadout(state);
  return { ok: true, state: next };
}

/**
 * Apply a saved preset. Skills or items that no longer exist are dropped from the loadout
 * instead of failing. Stat points are re-spent from the saved allocation, trimmed to what the
 * player can afford now.
 */
export function applyPreset(
  state: PlayerState,
  index: number,
  cfg: GameConfig,
): Result<{ state: PlayerState }, PresetFail> {
  if (!Number.isInteger(index) || index < 0 || index >= cfg.balance.inventory.presetCount) {
    return { ok: false, reason: 'badSlot' };
  }
  const preset = state.presets[index];
  if (!preset) return { ok: false, reason: 'empty' };
  const next = structuredClone(state);

  const keepSkill = (id: string | null) => (id && (state.skills[id]?.level ?? 0) >= 1 ? id : null);
  next.activeSkills = state.activeSkills.map((_, i) => keepSkill(preset.activeSkills[i] ?? null));
  next.passiveSkills = state.passiveSkills.map((_, i) =>
    keepSkill(preset.passiveSkills[i] ?? null),
  );

  next.equipment = {};
  for (const [slot, uid] of Object.entries(preset.equipment)) {
    if (uid && state.items.some((x) => x.uid === uid)) next.equipment[slot as Slot] = uid;
  }

  // stats: refund everything, then re-spend up to the saved amounts
  let remaining = state.statPoints;
  for (const k of STAT_KEYS) remaining += state.stats[k];
  for (const k of STAT_KEYS) {
    const want = Math.min(preset.stats[k], remaining);
    next.stats[k] = want;
    remaining -= want;
  }
  next.statPoints = remaining;
  return { ok: true, state: next };
}
