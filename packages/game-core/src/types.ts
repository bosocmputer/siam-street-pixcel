// ---------- basic enums ----------
export const ELEMENTS = ['earth', 'water', 'fire', 'wind'] as const;
export type Element = (typeof ELEMENTS)[number];

export const RARITIES = ['common', 'good', 'rare', 'legend'] as const;
export type Rarity = (typeof RARITIES)[number];

export const SLOTS = ['head', 'weapon', 'skin', 'charm'] as const;
export type Slot = (typeof SLOTS)[number];

export const STAT_KEYS = ['str', 'agi', 'vit', 'int'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type AttackStyle = 'none' | 'sword' | 'staff' | 'shield' | 'thorn';

export type Stats = Record<StatKey, number>;

// ---------- config (loaded from config/*.json) ----------
export interface SkillEffects {
  dotMult?: number; // extra damage over time, as a fraction of the hit
  slow?: number; // fraction slowed on the enemy attack speed
  lifesteal?: number; // fraction of damage dealt returned as HP
  reflect?: number; // fraction of damage taken returned to the enemy
  multiTarget?: boolean;
  critBonus?: number; // added crit chance
  defBonus?: number; // passive: fraction of DEF
  hpBonus?: number; // passive: fraction of HP
  atkBonus?: number; // passive: fraction of ATK
  atkSpeedBonus?: number; // passive: fraction of attack speed
}

export interface SkillDef {
  id: string;
  element: Element;
  tags: string[];
  kind: 'active' | 'passive';
  cooldown?: number;
  power?: number;
  effects: SkillEffects;
  part: string; // visible growth part id
  formOnly?: boolean;
}

export interface MonsterDef {
  id: string;
  districtId: string;
  element: Element;
  hp: number;
  atk: number;
  atkSpeed: number;
  exp: number;
  coins: number;
  coreChance: number;
  skillId: string;
}

export interface FormDef {
  id: string;
  tier: number;
  element: Element | null;
  from: string | null;
  minLevel: number;
  statBonus: Partial<Stats>;
  skillId: string | null;
}

export interface ItemBonus {
  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  atk?: number;
  def?: number;
  hp?: number;
}

export interface ItemRates {
  coin?: number;
  exp?: number;
  drop?: number;
  core?: number;
  crit?: number;
}

export interface ItemDef {
  id: string;
  slot: Slot;
  minStage: number;
  bonus: ItemBonus;
  style?: AttackStyle; // weapons only
  resist?: Partial<Record<Element, number>>; // skins only
  rates?: ItemRates; // charms only
  material: string; // district material used to upgrade
}

export interface StyleDef {
  atkMult: number;
  speedMult: number;
  skillMult: number;
  defMult: number;
  reflect: number;
  dotMult: number;
}

export interface ComboMods {
  dmgMult?: number;
  critAdd?: number;
  dotMult?: number;
  slow?: number;
  lifesteal?: number;
  speedMult?: number;
  defMult?: number;
}

export interface DistrictDef {
  id: string;
  element: Element;
  stageCount: number;
  killMult: number; // later districts need more kills per stage
  stageOffset: number; // districts continue the difficulty curve: effective stage = stage + offset
  monsters: { id: string; weight: number }[];
  material: string;
  bossId: string;
}

export interface BossDef {
  id: string;
  districtId: string;
  element: Element;
}

export interface RuleEffects {
  coinMult?: number;
  expMult?: number;
  dropMult?: number;
  dropMultByElement?: Partial<Record<Element, number>>;
  damageMultByElement?: Partial<Record<Element, number>>;
  enemyAtkMultByElement?: Partial<Record<Element, number>>;
  critAdd?: number;
}

export interface RuleDef {
  id: string;
  effects: RuleEffects;
}

export interface BalanceConfig {
  maxLevel: number;
  statPointsPerLevel: number;
  startingStatPoints: number;
  exp: { base: number; exponent: number; earlyLevels: number; earlyMult: number };
  stats: {
    hpBase: number;
    hpPerVit: number;
    hpPerLevel: number;
    atkBase: number;
    atkPerStr: number;
    atkPerLevel: number;
    defPerVit: number;
    atkSpeedBase: number;
    atkSpeedPerAgi: number;
    atkSpeedMax: number;
    critBase: number;
    critPerAgi: number;
    critMax: number;
    critDamage: number;
    skillPowPerInt: number;
    cdrPerInt: number;
    cdrMax: number;
  };
  combat: {
    defConstant: number;
    elementAdvantage: number;
    elementDisadvantage: number;
    hpStep: number; // monster HP = base * (1 + hpStep * (stage-1)) ^ hpPower
    hpPower: number;
    atkStep: number;
    atkPower: number;
    multiTargetBonus: number;
    maxDamagePerKillFraction: number;
    maxHealFraction: number;
    resistCap: number;
  };
  idle: {
    capSeconds: number;
    respawnSeconds: number;
    killsPerStage: number;
    killsPerStageGrowth: number;
    minClaimIntervalSeconds: number;
    welcomeBackAfterSeconds: number;
    welcomeBackMaxBonusSeconds: number;
  };
  rewards: {
    expGrowth: number;
    coinGrowth: number;
    itemDropChance: number;
    jellyPerKill: number;
    materialChance: number;
    rarityWeights: Record<Rarity, number>;
    rarityStageShift: number;
    salvageJelly: Record<Rarity, number>;
    salvageCoins: Record<Rarity, number>;
  };
  skills: {
    unlockCores: number;
    levelUpCoresBase: number;
    maxLevel: number;
    powerPerLevel: number;
    activeSlots: number;
    passiveSlots: number;
  };
  items: {
    rarityMult: Record<Rarity, number>;
    upgradeMax: number;
    upgradePerLevel: number;
    upgradeCoinBase: number;
    upgradeCoinGrowth: number;
    upgradeJellyBase: number;
    upgradeMaterialBase: number;
  };
  inventory: { baseCapacity: number; capacityPerFiveLevels: number; presetCount: number };
  evolution: { minAbsorbForTier1: number };
  bestiary: { setAtkMult: number; setHpMult: number };
  carry: { dpsBonus: number };
  boss: { hpPerActivePlayer: number; minHp: number; uptime: number };
  league: { shrinkK: number };
  tutorial: { firstMonsterCores: number };
}

export interface GameConfig {
  balance: BalanceConfig;
  elementBeats: Record<Element, Element>;
  styles: Record<AttackStyle, StyleDef>;
  combos: Record<string, Record<string, ComboMods>>;
  skills: SkillDef[];
  monsters: MonsterDef[];
  forms: FormDef[];
  items: ItemDef[];
  districts: DistrictDef[];
  bosses: BossDef[];
  rules: RuleDef[];
}

// ---------- player state ----------
export interface ItemInstance {
  uid: string;
  defId: string;
  rarity: Rarity;
  upgrade: number;
}

export interface Loadout {
  activeSkills: (string | null)[];
  passiveSkills: (string | null)[];
  equipment: Partial<Record<Slot, string>>; // item uid
  stats: Stats;
}

export interface PlayerState {
  version: 1;
  homeDistrictId: string; // "ย่านเรา": the player's identity, not where they farm
  level: number;
  exp: number;
  coins: number;
  statPoints: number;
  stats: Stats;
  formId: string;
  absorbedElements: Record<Element, number>;
  skills: Record<string, { level: number; progress: number }>;
  activeSkills: (string | null)[];
  passiveSkills: (string | null)[];
  equipment: Partial<Record<Slot, string>>;
  items: ItemInstance[];
  materials: Record<string, number>;
  cores: Record<string, number>; // unabsorbed cores per monster id
  bestiary: Record<string, number>; // monster id -> times absorbed
  presets: (Loadout | null)[];
  autoSalvageBelow: Rarity | null; // salvage drops strictly below this rarity
  farm: { districtId: string; stage: number; killCarry: number };
  frontierKills: Record<string, number>; // kills already made towards the next stage, per district
  progress: Record<string, number>; // district id -> highest cleared stage
  lastClaimAt: number; // server seconds
  counters: { item: number };
}

export type Fail<R extends string = string> = { ok: false; reason: R };
export type Ok<T> = { ok: true } & T;
export type Result<T, R extends string = string> = Ok<T> | Fail<R>;
