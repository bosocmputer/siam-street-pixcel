import { getMonster, getSkill, hasSkill } from './lookup';
import type { GameConfig, PlayerState, Result, SkillDef } from './types';

/** Active skill power at a given skill level. */
export function skillPowerAt(def: SkillDef, level: number, cfg: GameConfig): number {
  return (def.power ?? 0) * (1 + (level - 1) * cfg.balance.skills.powerPerLevel);
}

/** Cores needed to go from `level` to `level + 1` (level 0 = unlock). */
export function coresNeeded(level: number, cfg: GameConfig): number {
  const s = cfg.balance.skills;
  return level === 0 ? s.unlockCores : s.levelUpCoresBase * level;
}

function isAwakenReady(
  entry: { level: number; progress: number; awakened?: string },
  cfg: GameConfig,
): boolean {
  return (
    entry.level >= cfg.balance.skills.maxLevel &&
    !entry.awakened &&
    entry.progress >= cfg.balance.skills.awakenCores
  );
}

/** Choices offered when a skill awakens ("ตื่นพลัง"): stronger, faster, or a new combo tag. */
export function awakenOptions(def: SkillDef, cfg: GameConfig): string[] {
  const base = def.kind === 'active' ? ['power', 'swift'] : ['boost'];
  const tags = cfg.balance.skills.awakenTags
    .filter((t) => !def.tags.includes(t))
    .map((t) => `tag:${t}`);
  return [...base, ...tags];
}

export function awakenReady(state: PlayerState, skillId: string, cfg: GameConfig): boolean {
  const entry = state.skills[skillId];
  return !!entry && isAwakenReady(entry, cfg);
}

export type AwakenFail = 'notOwned' | 'notReady' | 'badChoice';

/** Spend a full awakening gauge to pick how the skill evolves. The choice is permanent. */
export function awaken(
  state: PlayerState,
  skillId: string,
  choice: string,
  cfg: GameConfig,
): Result<{ state: PlayerState }, AwakenFail> {
  const entry = state.skills[skillId];
  if (!entry || entry.level < 1 || !hasSkill(cfg, skillId))
    return { ok: false, reason: 'notOwned' };
  if (!isAwakenReady(entry, cfg)) return { ok: false, reason: 'notReady' };
  if (!awakenOptions(getSkill(cfg, skillId), cfg).includes(choice)) {
    return { ok: false, reason: 'badChoice' };
  }
  const next = structuredClone(state);
  const target = next.skills[skillId];
  if (target) {
    target.awakened = choice;
    target.progress = 0;
  }
  return { ok: true, state: next };
}

export type AbsorbFail = 'noCores' | 'invalidAmount';

export interface AbsorbResult {
  state: PlayerState;
  skillId: string;
  unlocked: boolean;
  level: number;
  absorbed: number;
  awakenReady: boolean;
}

/**
 * "กลืนเลย!": consume cores of a monster. Feeds the monster's skill (unlock, then level up),
 * the bestiary and the element counter used by evolution. Extra cores at max level are still
 * consumed (they count for the bestiary and element) so the button always does something.
 */
export function absorb(
  state: PlayerState,
  monsterId: string,
  count: number | 'all',
  cfg: GameConfig,
): Result<AbsorbResult, AbsorbFail> {
  const have = state.cores[monsterId] ?? 0;
  const n = count === 'all' ? have : count;
  if (!Number.isInteger(n) || n < 1)
    return { ok: false, reason: have < 1 ? 'noCores' : 'invalidAmount' };
  if (have < n) return { ok: false, reason: 'noCores' };

  const m = getMonster(cfg, monsterId);
  const next = structuredClone(state);
  next.cores[monsterId] = have - n;
  if (next.cores[monsterId] === 0) delete next.cores[monsterId];
  next.bestiary[monsterId] = (next.bestiary[monsterId] ?? 0) + n;
  next.absorbedElements[m.element] += n;

  const entry = next.skills[m.skillId] ?? { level: 0, progress: 0 };
  const wasLocked = entry.level < 1;
  let left = n;
  while (left > 0 && entry.level < cfg.balance.skills.maxLevel) {
    const need = coresNeeded(entry.level, cfg);
    const take = Math.min(left, need - entry.progress);
    entry.progress += take;
    left -= take;
    if (entry.progress >= need) {
      entry.level += 1;
      entry.progress = 0;
    }
  }
  if (entry.level >= cfg.balance.skills.maxLevel) {
    // cores beyond max level fill the awakening gauge
    entry.progress = entry.awakened
      ? 0
      : Math.min(cfg.balance.skills.awakenCores, entry.progress + left);
  }
  next.skills[m.skillId] = entry;
  return {
    ok: true,
    state: next,
    skillId: m.skillId,
    unlocked: wasLocked && entry.level >= 1,
    level: entry.level,
    absorbed: n,
    awakenReady: isAwakenReady(entry, cfg),
  };
}

export type EquipSkillFail =
  | 'badSlot'
  | 'notOwned'
  | 'wrongKind'
  | 'alreadyEquipped'
  | 'unknownSkill';

export function equipSkill(
  state: PlayerState,
  kind: 'active' | 'passive',
  index: number,
  skillId: string | null,
  cfg: GameConfig,
): Result<{ state: PlayerState }, EquipSkillFail> {
  const list = kind === 'active' ? state.activeSkills : state.passiveSkills;
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return { ok: false, reason: 'badSlot' };
  }
  if (skillId !== null) {
    if (!hasSkill(cfg, skillId)) return { ok: false, reason: 'unknownSkill' };
    if ((state.skills[skillId]?.level ?? 0) < 1) return { ok: false, reason: 'notOwned' };
    if (getSkill(cfg, skillId).kind !== kind) return { ok: false, reason: 'wrongKind' };
    if (list.some((id, i) => id === skillId && i !== index)) {
      return { ok: false, reason: 'alreadyEquipped' };
    }
  }
  const next = structuredClone(state);
  (kind === 'active' ? next.activeSkills : next.passiveSkills)[index] = skillId;
  return { ok: true, state: next };
}
