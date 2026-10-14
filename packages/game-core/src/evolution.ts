import { getDistrict, getForm } from './lookup';
import {
  ELEMENTS,
  type Element,
  type FormDef,
  type GameConfig,
  type PlayerState,
  type Result,
} from './types';

/** The element(s) the player has absorbed most. Ties return all tied elements. */
export function dominantElements(state: PlayerState): Element[] {
  const max = Math.max(...ELEMENTS.map((e) => state.absorbedElements[e]));
  if (max <= 0) return [];
  return ELEMENTS.filter((e) => state.absorbedElements[e] === max);
}

/** Forms the player may evolve into right now (level, absorb count and element line). */
export function evolutionOptions(state: PlayerState, cfg: GameConfig): FormDef[] {
  const cur = getForm(cfg, state.formId);
  const candidates = cfg.forms.filter((f) => f.from === cur.id && state.level >= f.minLevel);
  if (cur.tier === 0) {
    const total = ELEMENTS.reduce((s, e) => s + state.absorbedElements[e], 0);
    if (total < cfg.balance.evolution.minAbsorbForTier1) return [];
    // the element you absorbed most, plus the element of your home district ("ย่านเรา")
    const open = new Set<Element>([
      ...dominantElements(state),
      getDistrict(cfg, state.homeDistrictId).element,
    ]);
    return candidates.filter((f) => f.element !== null && open.has(f.element));
  }
  return candidates;
}

export type EvolveFail = 'notAvailable';

export function evolve(
  state: PlayerState,
  formId: string,
  cfg: GameConfig,
): Result<{ state: PlayerState; skillId: string | null }, EvolveFail> {
  const opt = evolutionOptions(state, cfg).find((f) => f.id === formId);
  if (!opt) return { ok: false, reason: 'notAvailable' };
  const next = structuredClone(state);
  next.formId = opt.id;
  if (opt.skillId && !(next.skills[opt.skillId]?.level ?? 0)) {
    next.skills[opt.skillId] = { level: 1, progress: 0 };
  }
  return { ok: true, state: next, skillId: opt.skillId };
}
