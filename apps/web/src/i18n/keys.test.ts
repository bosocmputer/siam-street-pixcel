import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, nm, t } from './t';
import th from './th.json';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

const dict = th as unknown as { ui: Record<string, Record<string, string>> };
const has = (key: string) => {
  const [group, name] = key.split('.');
  return !!(group && name && dict.ui[group]?.[name]);
};

describe('UI text keys', () => {
  const files = sources(join(__dirname, '..'));

  it('every t("group.key") used in the source exists in th.json', () => {
    const missing: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([a-z]+\.[A-Za-z]+)'/g)) {
        if (!has(m[1]!)) missing.push(`${f.split('/src/')[1]}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every dynamic key we build by hand resolves', () => {
    for (const tab of ['farm', 'slime', 'skills', 'bag', 'map'])
      expect(has(`nav.${tab}`)).toBe(true);
    for (const s of ['Sword', 'Staff', 'Shield', 'Thorn', 'None'])
      expect(has(`bag.style${s}`)).toBe(true);
    for (const k of ['statStr', 'statAgi', 'statVit', 'statInt'])
      expect(has(`slime.${k}`)).toBe(true);
  });

  it('has no unused UI keys left behind', () => {
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    const unused: string[] = [];
    for (const [group, entries] of Object.entries(dict.ui)) {
      for (const name of Object.keys(entries)) {
        const key = `${group}.${name}`;
        const dynamic = group === 'nav' || /^style[A-Z]/.test(name) || /^stat[A-Z]/.test(name);
        if (!dynamic && !all.includes(`'${key}'`) && !all.includes(`"${key}"`)) unused.push(key);
      }
    }
    expect(unused).toEqual([]);
  });
});

describe('formatting helpers', () => {
  it('fills placeholders and shows unknown keys instead of crashing', () => {
    expect(t('common.level', { n: 5 })).toBe('เวล 5');
    expect(t('nope.nothing')).toBe('nope.nothing');
    expect(t('common.level')).toBe('เวล {n}');
    expect(nm('skills', 'brick_smash')).toBe('ทุบอิฐ');
    expect(nm('skills', 'unknown_skill')).toBe('unknown_skill');
  });
  it('formats time and big numbers compactly', () => {
    expect(formatDuration(45)).toBe('45 วิ');
    expect(formatDuration(600)).toBe('10 นาที');
    expect(formatDuration(3600)).toBe('1 ชม.');
    expect(formatDuration(5400)).toBe('1 ชม. 30 นาที');
    expect(formatNumber(950)).toBe('950');
    expect(formatNumber(15400)).toBe('15.4K');
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });
});
