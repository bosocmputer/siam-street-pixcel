import { getDistrict } from './lookup';
import type { GameConfig, PlayerState } from './types';

/** Districts whose monsters have all been absorbed at least once. */
export function completedSets(state: PlayerState, cfg: GameConfig): string[] {
  return cfg.districts
    .filter((d) => d.monsters.every((m) => (state.bestiary[m.id] ?? 0) >= 1))
    .map((d) => d.id);
}

export function bestiaryBonus(
  state: PlayerState,
  cfg: GameConfig,
): { atkMult: number; hpMult: number } {
  const n = completedSets(state, cfg).length;
  return {
    atkMult: Math.pow(cfg.balance.bestiary.setAtkMult, n),
    hpMult: Math.pow(cfg.balance.bestiary.setHpMult, n),
  };
}

export function districtMonsterIds(cfg: GameConfig, districtId: string): string[] {
  return getDistrict(cfg, districtId).monsters.map((m) => m.id);
}
