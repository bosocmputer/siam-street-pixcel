import { describe, expect, it } from 'vitest';
import {
  absorb,
  allocateStat,
  addExp,
  comboMods,
  computeDerived,
  elementMult,
  elementThatBeats,
  equipItem,
  equipSkill,
  expToNext,
  getSkill,
  resetStats,
  totalStatPoints,
  unequipSlot,
} from '../src';
import { afterTutorial, cfg, fresh, strong } from './helpers';

describe('elements', () => {
  it('follows the ring: water>fire>wind>earth>water', () => {
    expect(elementMult('water', 'fire', cfg)).toBe(cfg.balance.combat.elementAdvantage);
    expect(elementMult('fire', 'wind', cfg)).toBe(cfg.balance.combat.elementAdvantage);
    expect(elementMult('wind', 'earth', cfg)).toBe(cfg.balance.combat.elementAdvantage);
    expect(elementMult('earth', 'water', cfg)).toBe(cfg.balance.combat.elementAdvantage);
  });
  it('is disadvantaged in the reverse direction and neutral otherwise', () => {
    expect(elementMult('fire', 'water', cfg)).toBe(cfg.balance.combat.elementDisadvantage);
    expect(elementMult('water', 'wind', cfg)).toBe(1);
    expect(elementMult('water', 'water', cfg)).toBe(1);
    expect(elementMult(null, 'fire', cfg)).toBe(1);
    expect(elementMult('fire', null, cfg)).toBe(1);
  });
  it('finds the element that beats a target', () => {
    expect(elementThatBeats('fire', cfg)).toBe('water');
    expect(elementThatBeats('earth', cfg)).toBe('wind');
  });
});

describe('derived stats', () => {
  it('matches the documented formulas for a level-1 player', () => {
    const d = computeDerived(fresh(), cfg);
    const sword = 6; // starter paddle sword, common, +0
    expect(d.hp).toBeCloseTo(50 + 8, 5);
    expect(d.atk).toBeCloseTo(5 + 1.5 + sword, 5);
    expect(d.atkSpeed).toBeCloseTo(1, 5);
    expect(d.crit).toBeCloseTo(0.05, 5);
    expect(d.def).toBe(0);
  });

  it('applies stat points', () => {
    const s = fresh();
    s.stats = { str: 10, agi: 10, vit: 10, int: 10 };
    const d = computeDerived(s, cfg);
    expect(d.hp).toBeCloseTo(50 + 10 * 12 + 8, 5);
    expect(d.def).toBeCloseTo(10, 5);
    expect(d.atkSpeed).toBeCloseTo(1.2, 5);
    expect(d.cdr).toBeCloseTo(0.05, 5);
    expect(d.skillPow).toBeCloseTo(1.3, 5);
  });

  it('caps speed, crit and cooldown reduction', () => {
    const s = strong(80);
    s.stats = { str: 0, agi: 5000, vit: 0, int: 5000 };
    const d = computeDerived(s, cfg);
    expect(d.atkSpeed).toBeLessThanOrEqual(cfg.balance.stats.atkSpeedMax);
    expect(d.crit).toBeLessThanOrEqual(cfg.balance.stats.critMax);
    expect(d.cdr).toBeLessThanOrEqual(cfg.balance.stats.cdrMax);
  });

  it('weapon style changes the attack: staff trades attack for skill power', () => {
    const s = fresh();
    const staffUid = 'staff1';
    s.items.push({ uid: staffUid, defId: 'ladle_staff', rarity: 'common', upgrade: 0 });
    const staff = equipItem(s, staffUid, cfg);
    expect(staff.ok && computeDerived(staff.state, cfg).style.skillMult).toBeGreaterThan(1);
    expect(computeDerived(s, cfg).style.skillMult).toBe(1);
  });

  it('rarity and upgrade level scale item bonuses', () => {
    const base = fresh();
    const rare = structuredClone(base);
    const first = rare.items[0];
    if (first) first.rarity = 'legend';
    expect(computeDerived(rare, cfg).atk).toBeGreaterThan(computeDerived(base, cfg).atk);
    const up = structuredClone(base);
    const u0 = up.items[0];
    if (u0) u0.upgrade = 5;
    expect(computeDerived(up, cfg).atk).toBeGreaterThan(computeDerived(base, cfg).atk);
  });

  it('removing equipment removes its bonus', () => {
    const s = fresh();
    expect(computeDerived(unequipSlot(s, 'weapon'), cfg).atk).toBeLessThan(
      computeDerived(s, cfg).atk,
    );
  });

  it('caps resistance', () => {
    const s = fresh();
    s.items.push({ uid: 'k', defId: 'mist_skin', rarity: 'legend', upgrade: 5 });
    const eq = equipItem(s, 'k', cfg);
    if (!eq.ok) throw new Error('equip');
    for (const e of ['earth', 'water', 'fire', 'wind'] as const) {
      expect(computeDerived(eq.state, cfg).resist[e]).toBeLessThanOrEqual(
        cfg.balance.combat.resistCap,
      );
    }
  });
});

describe('experience and stat points', () => {
  it('exp needed is positive and increasing from level 10 on', () => {
    for (let l = 1; l < 80; l++) expect(expToNext(l, cfg)).toBeGreaterThan(0);
    for (let l = cfg.balance.exp.earlyLevels; l < 79; l++) {
      expect(expToNext(l + 1, cfg)).toBeGreaterThan(expToNext(l, cfg));
    }
  });

  it('levels up, hands out stat points, and respects the level cap', () => {
    const s = fresh();
    const gained = addExp(s, 1e12, cfg);
    expect(gained).toBe(cfg.balance.maxLevel - 1);
    expect(s.level).toBe(cfg.balance.maxLevel);
    expect(s.statPoints).toBe(totalStatPoints(cfg.balance.maxLevel, cfg));
    expect(addExp(s, 1000, cfg)).toBe(0);
  });

  it('allocates points and rejects bad requests', () => {
    const s = fresh();
    const ok = allocateStat(s, 'str', 2);
    expect(ok.ok && ok.state.stats.str).toBe(2);
    expect(ok.ok && ok.state.statPoints).toBe(s.statPoints - 2);
    expect(allocateStat(s, 'str', 99).ok).toBe(false);
    expect(allocateStat(s, 'str', 0).ok).toBe(false);
    expect(allocateStat(s, 'str', 1.5).ok).toBe(false);
  });

  it('resets stat points for free and returns every point', () => {
    let s = fresh();
    const a = allocateStat(s, 'vit', 3);
    if (!a.ok) throw new Error('alloc');
    s = a.state;
    const r = resetStats(s);
    expect(r.stats).toEqual({ str: 0, agi: 0, vit: 0, int: 0 });
    expect(r.statPoints).toBe(totalStatPoints(1, cfg));
  });
});

describe('skills', () => {
  it('unlocks a skill after the required cores and keeps the bestiary + element counters', () => {
    const s = afterTutorial();
    expect(s.skills.brick_smash).toEqual({ level: 1, progress: 0 });
    expect(s.bestiary.brick_imp).toBe(cfg.balance.tutorial.firstMonsterCores);
    expect(s.absorbedElements.earth).toBe(cfg.balance.tutorial.firstMonsterCores);
    expect(s.cores.brick_imp).toBeUndefined();
  });

  it('partial absorbs accumulate progress', () => {
    const s = fresh();
    s.cores.brick_imp = 3;
    const r = absorb(s, 'brick_imp', 3, cfg);
    expect(r.ok && r.unlocked).toBe(false);
    expect(r.ok && r.state.skills.brick_smash).toEqual({ level: 0, progress: 3 });
    const s2 = r.ok ? r.state : s;
    s2.cores.brick_imp = 2;
    const r2 = absorb(s2, 'brick_imp', 2, cfg);
    expect(r2.ok && r2.unlocked).toBe(true);
  });

  it('levels skills up and stops at max level but still consumes cores', () => {
    const s = fresh();
    s.cores.brick_imp = 100000;
    const r = absorb(s, 'brick_imp', 'all', cfg);
    expect(r.ok && r.level).toBe(cfg.balance.skills.maxLevel);
    expect(r.ok && r.state.cores.brick_imp).toBeUndefined();
    expect(r.ok && r.state.bestiary.brick_imp).toBe(100000);
  });

  it('rejects absorbing cores you do not have', () => {
    const s = fresh();
    expect(absorb(s, 'brick_imp', 1, cfg).ok).toBe(false);
    expect(absorb(s, 'brick_imp', 'all', cfg).ok).toBe(false);
    s.cores.brick_imp = 2;
    expect(absorb(s, 'brick_imp', 5, cfg).ok).toBe(false);
    expect(absorb(s, 'brick_imp', 0, cfg).ok).toBe(false);
  });

  it('equips skills into the right kind of slot only', () => {
    const s = afterTutorial();
    expect(equipSkill(s, 'active', 0, 'brick_smash', cfg).ok).toBe(true);
    expect(equipSkill(s, 'passive', 0, 'brick_smash', cfg).ok).toBe(false);
    expect(equipSkill(s, 'active', 9, 'brick_smash', cfg).ok).toBe(false);
    expect(equipSkill(s, 'active', 0, 'wall_gnaw', cfg).ok).toBe(false); // not owned
    expect(equipSkill(s, 'active', 0, 'nope', cfg).ok).toBe(false);
  });

  it('never equips the same skill twice', () => {
    const s = afterTutorial();
    const a = equipSkill(s, 'active', 0, 'brick_smash', cfg);
    if (!a.ok) throw new Error('equip');
    expect(equipSkill(a.state, 'active', 1, 'brick_smash', cfg).ok).toBe(false);
    expect(equipSkill(a.state, 'active', 0, 'brick_smash', cfg).ok).toBe(true); // same slot is fine
    const cleared = equipSkill(a.state, 'active', 0, null, cfg);
    expect(cleared.ok && cleared.state.activeSkills[0]).toBeNull();
  });

  it('combos trigger at 2 and 3 matching tags', () => {
    const earth = ['brick_smash', 'wall_gnaw', 'clay_armor'].map((id) => getSkill(cfg, id));
    expect(comboMods(earth.slice(0, 1), cfg).dmgMult).toBe(1);
    expect(comboMods(earth.slice(0, 2), cfg).dmgMult).toBeCloseTo(1.15);
    const three = comboMods(earth, cfg);
    expect(three.dmgMult).toBeCloseTo(1.3);
    expect(three.critAdd).toBeCloseTo(0.05);
    const crit = ['weave_slash', 'peck_burst'].map((id) => getSkill(cfg, id));
    expect(comboMods(crit, cfg).critAdd).toBeCloseTo(0.1);
  });
});
