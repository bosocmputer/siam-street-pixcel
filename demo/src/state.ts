import type { Rule } from './config';

export interface World {
  rule: Rule;
  usedWins: number;
}

const KEY = 'siam-rewrite-demo-v1';
let cache: World | null = null;

export function loadWorld(): World {
  if (cache) return { ...cache };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      cache = {
        rule: p.rule === 'ice' || p.rule === 'cover' ? p.rule : null,
        usedWins: Number(p.usedWins) || 0,
      };
      return { ...cache };
    }
  } catch {
    /* storage unavailable: fall back to in-memory */
  }
  cache = { rule: null, usedWins: 0 };
  return { ...cache };
}

export function saveWorld(w: World): void {
  cache = { ...w };
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}
