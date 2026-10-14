import th from './th.json';

type Dict = { [k: string]: string | Dict };

function lookup(path: string): string | undefined {
  let cur: string | Dict | undefined = th as unknown as Dict;
  for (const part of path.split('.')) {
    if (cur === undefined || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Translate a UI key. `{name}` placeholders are filled from `vars`. Unknown keys show the key itself so gaps are visible. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(`ui.${key}`) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
}

export type ContentGroup =
  | 'districts'
  | 'elements'
  | 'rarities'
  | 'stats'
  | 'slots'
  | 'materials'
  | 'monsters'
  | 'bosses'
  | 'skills'
  | 'forms'
  | 'items'
  | 'rules'
  | 'tags'
  | 'awaken';

/** Thai name of a piece of game content (monster, skill, item...). */
export function nm(group: ContentGroup, id: string): string {
  return lookup(`content.${group}.${id}`) ?? id;
}

/** Name of an awakening choice such as "power" or "tag:crit". */
export function awakenName(choice: string): string {
  if (choice.startsWith('tag:')) return `${nm('awaken', 'tag')} ${nm('tags', choice.slice(4))}`;
  return nm('awaken', choice);
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
  if (m > 0) return `${m} นาที`;
  return `${s} วิ`;
}

export function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString('th-TH');
}
