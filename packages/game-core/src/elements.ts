import type { Element, GameConfig } from './types';

/** Damage multiplier of an attacker element against a defender element. null = neutral. */
export function elementMult(
  attacker: Element | null,
  defender: Element | null,
  cfg: GameConfig,
): number {
  if (!attacker || !defender) return 1;
  if (cfg.elementBeats[attacker] === defender) return cfg.balance.combat.elementAdvantage;
  if (cfg.elementBeats[defender] === attacker) return cfg.balance.combat.elementDisadvantage;
  return 1;
}

/** The element that beats `target` (used for "try this element" hints). */
export function elementThatBeats(target: Element, cfg: GameConfig): Element {
  for (const [atk, def] of Object.entries(cfg.elementBeats)) {
    if (def === target) return atk as Element;
  }
  return target;
}
