import { getDistrict } from './lookup';
import type { GameConfig, PlayerState, Result, SlimeLook } from './types';

/** The district every new player starts farming (the easiest one). */
export const STARTING_FARM_DISTRICT = 'wiang';

/** Trim, drop control characters and cut the name to the allowed length (by characters, not bytes). */
export function sanitizeName(raw: string, cfg: GameConfig): string {
  const clean = raw
    .replace(/\s+/g, ' ') // tabs and newlines become one space first
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return Array.from(clean).slice(0, cfg.looks.nameMaxLength).join('');
}

/** Make any look valid: unknown colour -> first colour, eye style clamped to the offered range. */
export function normalizeLook(look: Partial<SlimeLook> | undefined, cfg: GameConfig): SlimeLook {
  const color =
    look?.color && cfg.looks.colors.includes(look.color) ? look.color : cfg.looks.colors[0];
  const eyes = Math.min(Math.max(Math.floor(look?.eyes ?? 0), 0), cfg.looks.eyes - 1);
  return { color: color ?? 'mint', eyes };
}

/**
 * A brand-new player: level 1, a starter sword, farming stage 1 of the first district.
 * `homeDistrictId` is the "ย่านเรา" (team identity); null until the player chooses one on the map.
 * `profile` is what they picked in the slime creator.
 */
export function createNewPlayer(
  cfg: GameConfig,
  homeDistrictId: string | null,
  nowSeconds: number,
  profile: { name?: string; look?: Partial<SlimeLook> } = {},
): PlayerState {
  if (homeDistrictId !== null) getDistrict(cfg, homeDistrictId); // throws if unknown
  getDistrict(cfg, STARTING_FARM_DISTRICT);
  const b = cfg.balance;
  return {
    version: 1,
    name: sanitizeName(profile.name ?? '', cfg),
    look: normalizeLook(profile.look, cfg),
    homeDistrictId,
    homeChosenAt: homeDistrictId === null ? null : nowSeconds,
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
 * They come from the first monster of the district everyone starts farming.
 */
export function grantTutorialCores(state: PlayerState, cfg: GameConfig): PlayerState {
  const district = getDistrict(cfg, STARTING_FARM_DISTRICT);
  const first = district.monsters[0];
  const next = structuredClone(state);
  if (first) {
    next.cores[first.id] = (next.cores[first.id] ?? 0) + cfg.balance.tutorial.firstMonsterCores;
  }
  return next;
}

/** Whole days left before the home district may be changed again (0 = free to change). */
export function homeCooldownDays(state: PlayerState, nowSeconds: number, cfg: GameConfig): number {
  if (state.homeChosenAt === null || state.homeDistrictId === null) return 0;
  const left = state.homeChosenAt + cfg.balance.home.changeDays * 86400 - nowSeconds;
  return left > 0 ? Math.ceil(left / 86400) : 0;
}

export type ChooseHomeFail = 'unknownDistrict' | 'same' | 'cooldown';

/**
 * Choose (or change) "ย่านเรา". The first choice is free; changing later waits `home.changeDays`.
 * Changing never costs anything else, and stage progress is kept per district.
 */
export function chooseHome(
  state: PlayerState,
  districtId: string,
  nowSeconds: number,
  cfg: GameConfig,
): Result<{ state: PlayerState }, ChooseHomeFail> {
  if (!cfg.districts.some((d) => d.id === districtId))
    return { ok: false, reason: 'unknownDistrict' };
  if (state.homeDistrictId === districtId) return { ok: false, reason: 'same' };
  if (homeCooldownDays(state, nowSeconds, cfg) > 0) return { ok: false, reason: 'cooldown' };
  return { ok: true, state: { ...state, homeDistrictId: districtId, homeChosenAt: nowSeconds } };
}
