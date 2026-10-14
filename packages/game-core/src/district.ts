import { getRule } from './lookup';
import { createRng, type Rng } from './rng';
import type { GameConfig, RuleDef } from './types';

/** Weekly boss HP, scaled by how many players were active in the district. */
export function bossMaxHp(activePlayers: number, cfg: GameConfig): number {
  const b = cfg.balance.boss;
  return Math.max(b.minHp, Math.round(Math.max(0, activePlayers) * b.hpPerActivePlayer));
}

/**
 * Season score of a district. Shrunk by `k` so a district with one very strong player does not
 * beat a district where many people take part, and a big district is not favoured just for size.
 */
export function seasonScore(
  totalContribution: number,
  activePlayers: number,
  cfg: GameConfig,
): number {
  return totalContribution / (Math.max(0, activePlayers) + cfg.balance.league.shrinkK);
}

/** Deterministic Fisher-Yates using the given rng. */
function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** The 3 rule options offered for a week. Same seed => same options. */
export function pickRuleOptions(weekSeed: string, cfg: GameConfig, count = 3): RuleDef[] {
  return shuffle(cfg.rules, createRng(`rules:${weekSeed}`)).slice(0, count);
}

/** Winner of a vote. Ties are broken by the seed so the result is reproducible. */
export function tallyVotes(
  votes: Record<string, number>,
  options: string[],
  weekSeed: string,
  cfg: GameConfig,
): string {
  if (options.length === 0) throw new Error('tallyVotes: no options');
  for (const id of options) getRule(cfg, id); // throws on an unknown rule id
  const max = Math.max(...options.map((id) => votes[id] ?? 0));
  const tied = options.filter((id) => (votes[id] ?? 0) === max);
  const rng = createRng(`tie:${weekSeed}`);
  return tied[Math.floor(rng() * tied.length)] as string;
}
