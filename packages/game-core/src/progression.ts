import { STAT_KEYS, type GameConfig, type PlayerState, type Result, type StatKey } from './types';

export function expToNext(level: number, cfg: GameConfig): number {
  const e = cfg.balance.exp;
  const early = level < e.earlyLevels ? e.earlyMult : 1; // first levels are cheap so the first session feels fast
  return Math.max(1, Math.round(e.base * Math.pow(level, e.exponent) * early));
}

/** Adds exp and levels up. Mutates `state` (callers clone first). Returns levels gained. */
export function addExp(state: PlayerState, exp: number, cfg: GameConfig): number {
  const b = cfg.balance;
  if (state.level >= b.maxLevel) return 0;
  state.exp += exp;
  let gained = 0;
  while (state.level < b.maxLevel) {
    const need = expToNext(state.level, cfg);
    if (state.exp < need) break;
    state.exp -= need;
    state.level += 1;
    state.statPoints += b.statPointsPerLevel;
    gained += 1;
  }
  if (state.level >= b.maxLevel) state.exp = 0;
  return gained;
}

/** Total stat points a player at this level has earned (allocated + unspent). */
export function totalStatPoints(level: number, cfg: GameConfig): number {
  return cfg.balance.startingStatPoints + (level - 1) * cfg.balance.statPointsPerLevel;
}

export type AllocFail = 'notEnoughPoints' | 'invalidAmount';

export function allocateStat(
  state: PlayerState,
  key: StatKey,
  amount: number,
): Result<{ state: PlayerState }, AllocFail> {
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, reason: 'invalidAmount' };
  if (state.statPoints < amount) return { ok: false, reason: 'notEnoughPoints' };
  const next = structuredClone(state);
  next.stats[key] += amount;
  next.statPoints -= amount;
  return { ok: true, state: next };
}

/** Free reset: every allocated point goes back to the unspent pool. */
export function resetStats(state: PlayerState): PlayerState {
  const next = structuredClone(state);
  for (const k of STAT_KEYS) {
    next.statPoints += next.stats[k];
    next.stats[k] = 0;
  }
  return next;
}
