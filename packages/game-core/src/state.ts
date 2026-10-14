import { getDistrict } from './lookup';
import type { GameConfig, PlayerState } from './types';

/** The district every new player starts farming (the easiest one). */
export const STARTING_FARM_DISTRICT = 'wiang';

/**
 * A brand-new player: level 1, a starter sword, farming stage 1 of the first district.
 * `homeDistrictId` is their chosen "ย่านเรา" (identity); it can be any district.
 */
export function createNewPlayer(
  cfg: GameConfig,
  homeDistrictId: string,
  nowSeconds: number,
): PlayerState {
  getDistrict(cfg, homeDistrictId); // throws if unknown
  getDistrict(cfg, STARTING_FARM_DISTRICT);
  const b = cfg.balance;
  return {
    version: 1,
    homeDistrictId,
    level: 1,
    exp: 0,
    coins: 0,
    statPoints: b.startingStatPoints,
    stats: { str: 0, agi: 0, vit: 0, int: 0 },
    formId: 'slime_clear',
    absorbedElements: { earth: 0, water: 0, fire: 0, wind: 0 },
    skills: {},
    activeSkills: Array.from({ length: b.skills.activeSlots }, () => null),
    passiveSkills: Array.from({ length: b.skills.passiveSlots }, () => null),
    equipment: { weapon: 'i1' },
    items: [{ uid: 'i1', defId: 'paddle_sword', rarity: 'common', upgrade: 0 }],
    materials: {},
    cores: {},
    bestiary: {},
    presets: Array.from({ length: b.inventory.presetCount }, () => null),
    autoSalvageBelow: null,
    farm: { districtId: STARTING_FARM_DISTRICT, stage: 1, killCarry: 0 },
    frontierKills: {},
    progress: {},
    lastClaimAt: nowSeconds,
    counters: { item: 1 },
  };
}

/**
 * First-minute reward: the first kill drops enough cores to absorb immediately.
 * The cores come from the player's home district ("ย่านเรา"), so their first evolution leans
 * towards their home element even though everyone starts farming the first district.
 */
export function grantTutorialCores(
  state: PlayerState,
  cfg: GameConfig,
  homeDistrictId: string = state.homeDistrictId,
): PlayerState {
  const district = getDistrict(cfg, homeDistrictId);
  const first = district.monsters[0];
  const next = structuredClone(state);
  if (first) {
    next.cores[first.id] = (next.cores[first.id] ?? 0) + cfg.balance.tutorial.firstMonsterCores;
  }
  return next;
}
