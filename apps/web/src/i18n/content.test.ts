import { describe, expect, it } from 'vitest';
import { ELEMENTS, RARITIES, SLOTS, STAT_KEYS, defaultConfig as cfg } from '@slimehood/game-core';
import th from './th.json';

const c = th.content as Record<string, Record<string, string>>;

function missing(group: string, ids: readonly string[]): string[] {
  return ids.filter((id) => !(c[group]?.[id] ?? '').trim()).map((id) => `${group}.${id}`);
}

describe('Thai names for every piece of game content', () => {
  it('has a name for each id in the config', () => {
    const gaps = [
      ...missing(
        'districts',
        cfg.districts.map((x) => x.id),
      ),
      ...missing(
        'monsters',
        cfg.monsters.map((x) => x.id),
      ),
      ...missing(
        'bosses',
        cfg.bosses.map((x) => x.id),
      ),
      ...missing(
        'skills',
        cfg.skills.map((x) => x.id),
      ),
      ...missing(
        'forms',
        cfg.forms.map((x) => x.id),
      ),
      ...missing(
        'items',
        cfg.items.map((x) => x.id),
      ),
      ...missing(
        'rules',
        cfg.rules.map((x) => x.id),
      ),
      ...missing('materials', ['jelly', ...cfg.districts.map((d) => d.material)]),
      ...missing('elements', ELEMENTS),
      ...missing('rarities', RARITIES),
      ...missing('slots', SLOTS),
      ...missing('stats', STAT_KEYS),
    ];
    expect(gaps).toEqual([]);
  });

  it('has no names for things that do not exist (stale keys)', () => {
    const known: Record<string, Set<string>> = {
      districts: new Set(cfg.districts.map((x) => x.id)),
      monsters: new Set(cfg.monsters.map((x) => x.id)),
      bosses: new Set(cfg.bosses.map((x) => x.id)),
      skills: new Set(cfg.skills.map((x) => x.id)),
      forms: new Set(cfg.forms.map((x) => x.id)),
      items: new Set(cfg.items.map((x) => x.id)),
      rules: new Set(cfg.rules.map((x) => x.id)),
    };
    const stale: string[] = [];
    for (const [group, ids] of Object.entries(known)) {
      for (const id of Object.keys(c[group] ?? {})) if (!ids.has(id)) stale.push(`${group}.${id}`);
    }
    expect(stale).toEqual([]);
  });

  it('keeps the friendly tone from the GDD: no formal endings or rude words', () => {
    const banned = ['ครับ', 'ค่ะ', 'คะ', 'ท่าน', 'มึง', 'กู'];
    const bad: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        for (const w of banned) if (node.includes(w)) bad.push(`${path}: ${w}`);
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
      }
    };
    walk(th, 'th');
    expect(bad).toEqual([]);
  });

  it('names stay short enough for buttons and list rows', () => {
    const long: string[] = [];
    for (const [group, items] of Object.entries(c)) {
      for (const [id, name] of Object.entries(items))
        if ([...name].length > 24) long.push(`${group}.${id}`);
    }
    expect(long).toEqual([]);
  });
});
