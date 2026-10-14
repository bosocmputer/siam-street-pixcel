import { describe, expect, it } from 'vitest';
import {
  absorb,
  awaken,
  awakenOptions,
  awakenReady,
  computeDerived,
  equipSkill,
  getSkill,
  playerDps,
  rollItemAtLeast,
  createRng,
  type PlayerState,
} from '../src';
import { cfg, fresh } from './helpers';

const max = cfg.balance.skills.maxLevel;
const gauge = cfg.balance.skills.awakenCores;

/** A player whose brick_smash is at max level with a full awakening gauge. */
function ready(skillId = 'brick_smash', monster = 'brick_imp'): PlayerState {
  const s = fresh();
  s.skills[skillId] = { level: max, progress: gauge };
  s.cores[monster] = 0;
  return s;
}

describe('awakening gauge', () => {
  it('cores beyond max level fill the gauge instead of being wasted, up to its size', () => {
    const s = fresh();
    s.skills.brick_smash = { level: max, progress: 0 };
    s.cores.brick_imp = 10;
    const r = absorb(s, 'brick_imp', 10, cfg);
    expect(r.ok && r.state.skills.brick_smash?.progress).toBe(10);
    expect(r.ok && r.awakenReady).toBe(false);
    const s2 = fresh();
    s2.skills.brick_smash = { level: max, progress: gauge - 5 };
    s2.cores.brick_imp = 100;
    const r2 = absorb(s2, 'brick_imp', 100, cfg);
    expect(r2.ok && r2.state.skills.brick_smash?.progress).toBe(gauge);
    expect(r2.ok && r2.awakenReady).toBe(true);
  });

  it('leveling up into max level carries the leftover cores into the gauge', () => {
    const s = fresh();
    s.skills.brick_smash = { level: max - 1, progress: 0 };
    const need = cfg.balance.skills.levelUpCoresBase * (max - 1);
    s.cores.brick_imp = need + 7;
    const r = absorb(s, 'brick_imp', 'all', cfg);
    expect(r.ok && r.state.skills.brick_smash).toEqual({ level: max, progress: 7 });
  });

  it('is not ready before max level or before the gauge is full', () => {
    const s = fresh();
    s.skills.brick_smash = { level: max - 1, progress: gauge };
    expect(awakenReady(s, 'brick_smash', cfg)).toBe(false);
    s.skills.brick_smash = { level: max, progress: gauge - 1 };
    expect(awakenReady(s, 'brick_smash', cfg)).toBe(false);
    expect(awakenReady(s, 'nope', cfg)).toBe(false);
    expect(awakenReady(ready(), 'brick_smash', cfg)).toBe(true);
  });
});

describe('awaken', () => {
  it('offers different choices for active and passive skills, never a tag the skill already has', () => {
    const active = awakenOptions(getSkill(cfg, 'brick_smash'), cfg);
    expect(active).toContain('power');
    expect(active).toContain('swift');
    expect(active).not.toContain('boost');
    const passive = awakenOptions(getSkill(cfg, 'clay_armor'), cfg);
    expect(passive).toContain('boost');
    expect(passive).not.toContain('power');
    expect(passive).not.toContain('tag:defense'); // clay_armor already has the defense tag
    for (const t of getSkill(cfg, 'weave_slash').tags) {
      expect(awakenOptions(getSkill(cfg, 'weave_slash'), cfg)).not.toContain(`tag:${t}`);
    }
  });

  it('applies the choice, empties the gauge, and cannot be done twice', () => {
    const r = awaken(ready(), 'brick_smash', 'power', cfg);
    expect(r.ok && r.state.skills.brick_smash).toEqual({
      level: max,
      progress: 0,
      awakened: 'power',
    });
    if (!r.ok) return;
    expect(awaken(r.state, 'brick_smash', 'swift', cfg)).toEqual({ ok: false, reason: 'notReady' });
    // more cores after awakening do nothing to the gauge
    const more = structuredClone(r.state);
    more.cores.brick_imp = 50;
    const a = absorb(more, 'brick_imp', 50, cfg);
    expect(a.ok && a.state.skills.brick_smash?.progress).toBe(0);
  });

  it('refuses bad requests', () => {
    expect(awaken(fresh(), 'brick_smash', 'power', cfg)).toEqual({ ok: false, reason: 'notOwned' });
    expect(awaken(ready(), 'nope', 'power', cfg)).toEqual({ ok: false, reason: 'notOwned' });
    const early = fresh();
    early.skills.brick_smash = { level: 3, progress: 0 };
    expect(awaken(early, 'brick_smash', 'power', cfg)).toEqual({ ok: false, reason: 'notReady' });
    expect(awaken(ready(), 'brick_smash', 'boost', cfg)).toEqual({
      ok: false,
      reason: 'badChoice',
    });
    expect(awaken(ready(), 'brick_smash', 'tag:earth', cfg)).toEqual({
      ok: false,
      reason: 'badChoice',
    });
  });

  const equipped = (s: PlayerState, kind: 'active' | 'passive', id: string) => {
    const r = equipSkill(s, kind, 0, id, cfg);
    if (!r.ok) throw new Error('equip ' + r.reason);
    return r.state;
  };
  const dps = (s: PlayerState) => playerDps(computeDerived(s, cfg), null, cfg);

  it('power and swift both raise damage output', () => {
    const base = equipped(ready(), 'active', 'brick_smash');
    const powered = awaken(base, 'brick_smash', 'power', cfg);
    const swift = awaken(base, 'brick_smash', 'swift', cfg);
    expect(powered.ok && dps(powered.state)).toBeGreaterThan(dps(base));
    expect(swift.ok && dps(swift.state)).toBeGreaterThan(dps(base));
  });

  it('boost strengthens a passive skill', () => {
    const base = equipped(ready('clay_armor', 'clay_pot'), 'passive', 'clay_armor');
    const boosted = awaken(base, 'clay_armor', 'boost', cfg);
    const defOf = (s: PlayerState) => computeDerived(s, cfg).def;
    const a = structuredClone(base);
    a.stats.vit = 20;
    const b = boosted.ok ? structuredClone(boosted.state) : a;
    b.stats.vit = 20;
    expect(defOf(b)).toBeGreaterThan(defOf(a));
  });

  it('a new tag creates combos across elements', () => {
    // brick_smash (earth, smash) + weave_slash (water, crit): no combo yet
    let s = ready();
    s.skills.weave_slash = { level: 1, progress: 0 };
    s = equipped(s, 'active', 'brick_smash');
    const e2 = equipSkill(s, 'active', 1, 'weave_slash', cfg);
    if (!e2.ok) throw new Error('equip');
    s = e2.state;
    expect(computeDerived(s, cfg).combo.critAdd).toBe(0);
    // awakening brick_smash with the crit tag pairs it with weave_slash
    const a = awaken(s, 'brick_smash', 'tag:crit', cfg);
    expect(a.ok && computeDerived(a.state, cfg).combo.critAdd).toBeCloseTo(0.1);
  });
});

describe('guaranteed-rarity item rolls', () => {
  it('never roll below the minimum', () => {
    const rng = createRng('min');
    for (let i = 0; i < 400; i++) {
      const it = rollItemAtLeast(10, cfg, rng, `u${i}`, 'rare');
      expect(['rare', 'legend']).toContain(it.rarity);
    }
  });
});
