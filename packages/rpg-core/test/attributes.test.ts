import { describe, expect, it } from 'vitest';
import {
  ATTR,
  ATTRS,
  JOB_IDS,
  addPoints,
  attrBonus,
  baseAttrs,
  leaning,
  pickJob,
  pointsEarned,
  pointsLeft,
  pointsSpent,
  readAttributes,
  validAttrs,
  type Attrs,
} from '../src/attributes';
import { ConfigError } from '../src/config';
import { maxEnergy, maxHp, newStats, gainExp } from '../src/stats';
import attributesJson from '../config/attributes.json';

const at = (str: number, agi: number, dex: number, int: number, vit: number): Attrs => ({
  str,
  agi,
  dex,
  int,
  vit,
});

describe('attribute config', () => {
  it('reads the shipped file: five attributes, one job per side of the wheel', () => {
    expect(ATTR.order).toHaveLength(ATTRS.length);
    expect(ATTR.jobs.map((j) => j.id)).toEqual([
      'striker',
      'ranger',
      'elementalist',
      'cleric',
      'guardian',
    ]);
    expect(JOB_IDS).toContain('freelancer');
  });

  it('refuses a wheel that is wrong', () => {
    const base = structuredClone(attributesJson) as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => () => readAttributes({ ...base, ...patch });
    expect(bad({ order: ['str', 'agi', 'dex', 'int'] })).toThrow(ConfigError);
    expect(bad({ order: ['str', 'agi', 'dex', 'int', 'luk'] })).toThrow(/no attribute/);
    expect(bad({ order: ['str', 'str', 'dex', 'int', 'vit'] })).toThrow(/once/);
    const jobs = structuredClone(attributesJson.jobs);
    jobs[1]!.between = ['dex', 'agi'];
    expect(bad({ jobs })).toThrow(/side/);
    expect(bad({ jobs: attributesJson.jobs.slice(0, 4) })).toThrow(/one job/);
    expect(bad({ jobs: 'all' })).toThrow(/list/);
    expect(
      bad({ jobs: [{ ...attributesJson.jobs[0], id: '' }, ...attributesJson.jobs.slice(1)] }),
    ).toThrow(/id/);
    expect(bad({ secret: { spread: 2 } })).toThrow(/secret/);
    expect(bad({ hintLevels: [3, 'six'] })).toThrow(/hintLevels/);
  });
});

describe('points', () => {
  it('three a level after the first', () => {
    expect(pointsEarned(1)).toBe(0);
    expect(pointsEarned(10)).toBe(27);
    expect(pointsSpent(baseAttrs())).toBe(0);
    expect(pointsLeft(at(6, 5, 5, 7, 5), 2)).toBe(0);
  });

  it('adds points only as whole numbers, never more than are left', () => {
    const a = baseAttrs();
    expect(addPoints(a, { int: 2, vit: 1 }, 2)).toEqual({ ...a, int: 7, vit: 6 });
    expect(addPoints(a, { int: 4 }, 2)).toBeNull();
    expect(addPoints(a, { int: -1 }, 2)).toBeNull();
    expect(addPoints(a, { int: 0.5 }, 2)).toBeNull();
    expect(addPoints(a, { luk: 1 } as Partial<Attrs>, 2)).toBeNull();
    expect(a.int).toBe(ATTR.base);
  });

  it('checks attributes read from a save', () => {
    expect(validAttrs(at(8, 5, 5, 5, 5), 2)).toEqual(at(8, 5, 5, 5, 5));
    expect(validAttrs(at(9, 5, 5, 5, 5), 2)).toBeNull();
    expect(validAttrs(at(4, 5, 5, 5, 5), 9)).toBeNull();
    expect(validAttrs({ str: 5 }, 9)).toBeNull();
    expect(validAttrs([5, 5, 5, 5, 5], 9)).toBeNull();
    expect(validAttrs(null, 9)).toBeNull();
  });
});

describe('the job wheel', () => {
  it('the highest attribute and its higher neighbour pick the side', () => {
    expect(pickJob(at(7, 8, 11, 13, 10)).job).toBe('elementalist');
    expect(pickJob(at(7, 8, 11, 13, 14)).job).toBe('cleric');
    expect(pickJob(at(14, 9, 5, 5, 6)).job).toBe('striker');
    expect(pickJob(at(14, 5, 5, 5, 9)).job).toBe('guardian');
    expect(pickJob(at(5, 12, 9, 5, 5)).job).toBe('ranger');
  });

  it('every pair of top attributes ends on a job, even ones not next to each other', () => {
    // STR and INT are not neighbours: STR is highest, so its higher neighbour decides
    expect(pickJob(at(14, 6, 5, 12, 7)).job).toBe('guardian');
    expect(pickJob(at(14, 8, 5, 12, 7)).job).toBe('striker');
    for (let i = 0; i < 200; i++) {
      const a = at(
        5 + (i % 7),
        5 + ((i * 3) % 5),
        5 + ((i * 7) % 6),
        5 + ((i * 11) % 4),
        5 + (i % 3),
      );
      expect(ATTR.jobs.map((j) => j.id)).toContain(pickJob(a).job);
    }
  });

  it('a tie goes to the way the player fights, then to the wheel order', () => {
    const tie = at(5, 5, 11, 13, 11); // INT top, DEX and VIT both 11
    expect(pickJob(tie).ties).toEqual(['elementalist', 'cleric']);
    expect(pickJob(tie).job).toBe('elementalist');
    // STR top, AGI and VIT tie: a near fighter, so the wheel order picks Striker first
    const t2 = at(12, 9, 5, 5, 9);
    expect(pickJob(t2, { range: 'near' }).job).toBe('striker');
    expect(pickJob(at(5, 12, 9, 5, 5), { range: 'near' }).ties).toEqual([]);
    // AGI top, STR and DEX tie: the near fighter gets Striker, the far one Ranger
    const t3 = at(9, 12, 9, 5, 5);
    expect(pickJob(t3, { range: 'near' }).job).toBe('striker');
    expect(pickJob(t3, { range: 'far' }).job).toBe('ranger');
  });

  it('the secret job needs even attributes and the three-hands task', () => {
    const even = at(10, 11, 10, 9, 10);
    expect(pickJob(even).job).not.toBe('freelancer');
    expect(pickJob(even, { trio: true }).job).toBe('freelancer');
    expect(pickJob(at(10, 12, 10, 9, 10), { trio: true }).job).not.toBe('freelancer');
  });

  it('leans towards the highest attribute', () => {
    expect(leaning(at(7, 8, 11, 13, 10))).toBe('int');
    expect(leaning(baseAttrs())).toBe('str');
  });
});

describe('what attributes do', () => {
  it('VIT adds health, INT energy, the highest one skill power', () => {
    const a = at(5, 5, 5, 9, 8);
    const b = attrBonus(a);
    expect(b.hp).toBe(3 * ATTR.effects.hpPerVit);
    expect(b.energy).toBe(4 * ATTR.effects.energyPerInt);
    expect(b.power).toBeCloseTo(1 + 4 * ATTR.effects.powerPerPoint);
    expect(attrBonus(baseAttrs())).toEqual({ hp: 0, energy: 0, power: 1 });
    expect(maxHp(3, undefined, a)).toBe(maxHp(3) + b.hp);
    expect(maxEnergy(3, undefined, a)).toBe(maxEnergy(3) + b.energy);
  });

  it('a level up fills health to the new maximum with the attributes counted', () => {
    const s = newStats(1, undefined, at(5, 5, 5, 5, 9));
    expect(s.hp).toBe(maxHp(1) + 4 * ATTR.effects.hpPerVit);
    gainExp(s, 1e6);
    expect(s.hp).toBe(maxHp(s.level, undefined, s.attrs));
  });
});
