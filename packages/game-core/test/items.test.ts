import { describe, expect, it } from 'vitest';
import {
  applyPreset,
  capacity,
  equipItem,
  itemPower,
  rarityWeights,
  rollItem,
  salvageItems,
  savePreset,
  setAutoSalvage,
  createRng,
  unequipSlot,
  upgradeCost,
  upgradeItem,
  usedSlots,
  equipSkill,
  allocateStat,
} from '../src';
import { afterTutorial, cfg, fresh } from './helpers';

describe('items', () => {
  it('rolls only items available at that stage, with a valid rarity', () => {
    const rng = createRng('items');
    for (let i = 0; i < 300; i++) {
      const it = rollItem(3, cfg, rng, `u${i}`);
      const def = cfg.items.find((d) => d.id === it.defId);
      expect(def).toBeDefined();
      expect(def?.minStage ?? 99).toBeLessThanOrEqual(3);
      expect(['common', 'good', 'rare', 'legend']).toContain(it.rarity);
      expect(it.upgrade).toBe(0);
    }
  });

  it('better rarities become likelier at later stages, never impossible at stage 1', () => {
    const early = rarityWeights(1, cfg);
    const late = rarityWeights(100, cfg);
    expect(early.every((w) => w > 0)).toBe(true);
    expect((late[3] ?? 0) / (late[0] ?? 1)).toBeGreaterThan((early[3] ?? 0) / (early[0] ?? 1));
  });

  it('item power rises with rarity and upgrades', () => {
    const base = { uid: 'a', defId: 'win_helmet', rarity: 'common' as const, upgrade: 0 };
    expect(itemPower({ ...base, rarity: 'legend' }, cfg)).toBeGreaterThan(itemPower(base, cfg));
    expect(itemPower({ ...base, upgrade: 3 }, cfg)).toBeGreaterThan(itemPower(base, cfg));
  });
});

describe('upgrade (never breaks)', () => {
  const rich = () => {
    const s = fresh();
    s.coins = 1e9;
    s.materials = { jelly: 1e6, old_brick: 1e6 };
    return s;
  };

  it('costs coins, jelly and the district material, and always succeeds with resources', () => {
    const s = rich();
    const cost = upgradeCost(s.items[0]!, cfg);
    const r = upgradeItem(s, 'i1', cfg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.items[0]?.upgrade).toBe(1);
    expect(r.state.coins).toBe(s.coins - cost.coins);
    expect(r.state.materials.jelly).toBe(1e6 - cost.jelly);
    expect(r.state.materials.old_brick).toBe(1e6 - cost.material.qty);
  });

  it('refuses without resources and past the max level', () => {
    const poor = fresh();
    expect(upgradeItem(poor, 'i1', cfg)).toEqual({ ok: false, reason: 'noCoins' });
    const noJelly = rich();
    noJelly.materials = { old_brick: 99 };
    expect(upgradeItem(noJelly, 'i1', cfg)).toEqual({ ok: false, reason: 'noJelly' });
    const noMat = rich();
    noMat.materials = { jelly: 99 };
    expect(upgradeItem(noMat, 'i1', cfg)).toEqual({ ok: false, reason: 'noMaterial' });
    expect(upgradeItem(rich(), 'zzz', cfg)).toEqual({ ok: false, reason: 'notFound' });
    let s = rich();
    for (let i = 0; i < cfg.balance.items.upgradeMax; i++) {
      const r = upgradeItem(s, 'i1', cfg);
      if (!r.ok) throw new Error('upgrade');
      s = r.state;
    }
    expect(upgradeItem(s, 'i1', cfg)).toEqual({ ok: false, reason: 'maxed' });
  });

  it('does not mutate the input state', () => {
    const s = rich();
    const copy = structuredClone(s);
    upgradeItem(s, 'i1', cfg);
    expect(s).toEqual(copy);
  });
});

describe('salvage and inventory', () => {
  it('never salvages an equipped item', () => {
    const s = fresh();
    expect(salvageItems(s, ['i1'], cfg)).toEqual({ ok: false, reason: 'equipped' });
  });

  it('salvages spare items into jelly and coins', () => {
    const s = fresh();
    s.items.push({ uid: 'x', defId: 'ngob', rarity: 'rare', upgrade: 0 });
    const r = salvageItems(s, ['x'], cfg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jelly).toBe(cfg.balance.rewards.salvageJelly.rare);
    expect(r.state.items.some((i) => i.uid === 'x')).toBe(false);
    expect(r.state.materials.jelly).toBe(r.jelly);
    expect(salvageItems(s, ['nope'], cfg)).toEqual({ ok: false, reason: 'notFound' });
  });

  it('capacity grows with level and equipped items do not use a slot', () => {
    const s = fresh();
    const c1 = capacity(s, cfg);
    s.level = 50;
    expect(capacity(s, cfg)).toBeGreaterThan(c1);
    expect(usedSlots(fresh())).toBe(0);
  });

  it('equips into the slot defined by the item and can unequip', () => {
    const s = fresh();
    s.items.push({ uid: 'h', defId: 'ngob', rarity: 'common', upgrade: 0 });
    const r = equipItem(s, 'h', cfg);
    expect(r.ok && r.slot).toBe('head');
    expect(r.ok && r.state.equipment.head).toBe('h');
    expect(equipItem(s, 'nope', cfg).ok).toBe(false);
    if (r.ok) expect(unequipSlot(r.state, 'head').equipment.head).toBeUndefined();
  });

  it('auto salvage setting is stored', () => {
    expect(setAutoSalvage(fresh(), 'good').autoSalvageBelow).toBe('good');
    expect(setAutoSalvage(fresh(), null).autoSalvageBelow).toBeNull();
  });
});

describe('presets', () => {
  it('saves and restores skills, equipment and stat allocation', () => {
    let s = afterTutorial();
    const eq = equipSkill(s, 'active', 0, 'brick_smash', cfg);
    if (!eq.ok) throw new Error('equip');
    s = eq.state;
    const al = allocateStat(s, 'vit', 3);
    if (!al.ok) throw new Error('alloc');
    s = al.state;
    const saved = savePreset(s, 0, cfg);
    if (!saved.ok) throw new Error('save');
    // change everything
    const changed = structuredClone(saved.state);
    changed.activeSkills = [null, null, null];
    changed.equipment = {};
    changed.statPoints += changed.stats.vit;
    changed.stats.vit = 0;
    const back = applyPreset(changed, 0, cfg);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.activeSkills[0]).toBe('brick_smash');
    expect(back.state.equipment.weapon).toBe('i1');
    expect(back.state.stats.vit).toBe(3);
    expect(back.state.statPoints).toBe(0);
  });

  it('drops things that no longer exist instead of failing', () => {
    let s = afterTutorial();
    const eq = equipSkill(s, 'active', 0, 'brick_smash', cfg);
    if (!eq.ok) throw new Error('equip');
    const saved = savePreset(eq.state, 1, cfg);
    if (!saved.ok) throw new Error('save');
    s = saved.state;
    s.skills = {};
    s.items = [];
    s.equipment = {};
    const r = applyPreset(s, 1, cfg);
    expect(r.ok && r.state.activeSkills[0]).toBeNull();
    expect(r.ok && r.state.equipment.weapon).toBeUndefined();
  });

  it('never creates stat points from nothing', () => {
    let s = fresh();
    const a = allocateStat(s, 'str', 3);
    if (!a.ok) throw new Error('alloc');
    s = a.state;
    const saved = savePreset(s, 2, cfg);
    if (!saved.ok) throw new Error('save');
    const poor = structuredClone(saved.state);
    poor.statPoints = 0;
    poor.stats = { str: 1, agi: 0, vit: 0, int: 0 }; // fewer points than the preset wants
    const r = applyPreset(poor, 2, cfg);
    expect(r.ok && r.state.stats.str).toBe(1);
  });

  it('rejects bad slots and empty presets', () => {
    const s = fresh();
    expect(savePreset(s, 7, cfg).ok).toBe(false);
    expect(savePreset(s, -1, cfg).ok).toBe(false);
    expect(applyPreset(s, 0, cfg)).toEqual({ ok: false, reason: 'empty' });
    expect(applyPreset(s, 9, cfg)).toEqual({ ok: false, reason: 'badSlot' });
  });
});
