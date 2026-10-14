import { describe, expect, it } from 'vitest';
import { ELEMENTS, validateConfig } from '../src';
import { cfg } from './helpers';

describe('default config', () => {
  it('has no referential-integrity problems', () => {
    expect(validateConfig(cfg)).toEqual([]);
  });

  it('matches the GDD content counts', () => {
    expect(cfg.districts).toHaveLength(4);
    expect(cfg.monsters).toHaveLength(12);
    expect(cfg.bosses).toHaveLength(4);
    expect(cfg.forms).toHaveLength(9);
    expect(cfg.rules).toHaveLength(6);
    expect(cfg.items.filter((i) => i.slot === 'head')).toHaveLength(10);
    expect(cfg.items.filter((i) => i.slot === 'weapon')).toHaveLength(4);
    expect(cfg.items.filter((i) => i.slot === 'skin')).toHaveLength(8);
    expect(cfg.items.filter((i) => i.slot === 'charm')).toHaveLength(6);
    expect(cfg.skills.filter((s) => !s.formOnly)).toHaveLength(12);
    expect(cfg.skills.filter((s) => s.formOnly)).toHaveLength(8);
  });

  it('each district has 3 monsters of its own element', () => {
    for (const d of cfg.districts) {
      expect(d.monsters).toHaveLength(3);
      for (const m of d.monsters) {
        expect(cfg.monsters.find((x) => x.id === m.id)?.element).toBe(d.element);
      }
    }
  });

  it('every element appears in the ring exactly once as attacker and once as target', () => {
    const targets = ELEMENTS.map((e) => cfg.elementBeats[e]);
    expect(new Set(targets).size).toBe(4);
  });

  it('detects broken references', () => {
    const broken = structuredClone(cfg);
    const first = broken.monsters[0];
    if (first) first.skillId = 'nope';
    expect(validateConfig(broken).join('\n')).toContain('unknown skill nope');
  });

  it('detects duplicate ids', () => {
    const broken = structuredClone(cfg);
    const [first] = broken.items;
    if (first) broken.items.push({ ...first });
    expect(validateConfig(broken).join('\n')).toContain('duplicate item id');
  });
});
