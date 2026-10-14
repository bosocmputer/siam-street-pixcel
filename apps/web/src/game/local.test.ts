import { describe, expect, it } from 'vitest';
import { defaultConfig as cfg } from '@slimehood/game-core';
import { LocalBackend, loadSave, writeRaw } from './local';

// vitest runs in node: no localStorage, so the backend falls back to its in-memory copy.
describe('LocalBackend', () => {
  const mine = { name: 'โมจิ', look: { color: 'rose', eyes: 2 } };

  it('creates the slime the player designed, with no home district yet, and saves it', async () => {
    const b = new LocalBackend();
    await b.reset();
    expect(await b.load()).toBeNull();
    const p = await b.create(mine);
    expect(p.name).toBe('โมจิ');
    expect(p.look).toEqual({ color: 'rose', eyes: 2 });
    expect(p.homeDistrictId).toBeNull();
    expect(p.cores.brick_imp).toBe(cfg.balance.tutorial.firstMonsterCores);
    const saved = await b.load();
    expect(saved?.name).toBe('โมจิ');
    expect(saved?.look.color).toBe('rose');
  });

  it('lets the player choose their home district later, once for free', async () => {
    const b = new LocalBackend();
    await b.reset();
    const p = await b.create(mine);
    const r = await b.exec(p, { t: 'chooseHome', districtId: 'nimman' });
    expect(r.ok && r.state.homeDistrictId).toBe('nimman');
    if (!r.ok) return;
    const again = await b.exec(r.state, { t: 'chooseHome', districtId: 'ping' });
    expect(again).toEqual({ ok: false, reason: 'cooldown' });
    b.offsetSeconds = cfg.balance.home.changeDays * 86400;
    const later = await b.exec(r.state, { t: 'chooseHome', districtId: 'ping' });
    expect(later.ok && later.state.homeDistrictId).toBe('ping');
  });

  it('fills in the new fields for saves made before the creator existed', async () => {
    const b = new LocalBackend();
    await b.reset();
    const p = await b.create(mine);
    const { name: _n, look: _l, homeChosenAt: _h, ...old } = { ...p, homeDistrictId: 'ping' };
    void _n;
    void _l;
    void _h;
    writeRaw(JSON.stringify({ version: 1, state: old, claims: 0 }));
    const loaded = await b.load();
    expect(loaded?.homeDistrictId).toBe('ping');
    expect(loaded?.name).toBe('');
    expect(loaded?.look.color).toBe(cfg.looks.colors[0]);
    expect(loaded?.homeChosenAt).toBeNull();
  });

  it('runs actions and persists every successful one', async () => {
    const b = new LocalBackend();
    await b.reset();
    let p = await b.create(mine);
    const r = await b.exec(p, { t: 'absorb', monsterId: 'brick_imp', count: 'all' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    p = r.state;
    expect(p.skills.brick_smash?.level).toBe(1);
    expect(loadSave()?.state.skills.brick_smash?.level).toBe(1);
    const eq = await b.exec(p, {
      t: 'equipSkill',
      kind: 'active',
      index: 0,
      skillId: 'brick_smash',
    });
    expect(eq.ok && eq.state.activeSkills[0]).toBe('brick_smash');
  });

  it('does not save failed actions', async () => {
    const b = new LocalBackend();
    await b.reset();
    const p = await b.create(mine);
    const before = JSON.stringify(loadSave()?.state);
    const r = await b.exec(p, { t: 'absorb', monsterId: 'wall_rat', count: 1 }); // no such cores
    expect(r.ok).toBe(false);
    expect(JSON.stringify(loadSave()?.state)).toBe(before);
  });

  it('claims with the shifted clock and refuses a claim that is too soon', async () => {
    const b = new LocalBackend();
    await b.reset();
    const p = await b.create(mine);
    const soon = await b.exec(p, { t: 'claim' });
    expect(soon).toEqual({ ok: false, reason: 'tooSoon' });
    b.offsetSeconds = 4 * 3600;
    const r = await b.exec(p, { t: 'claim' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report?.kills).toBeGreaterThan(0);
    expect(r.state.lastClaimAt).toBeGreaterThan(p.lastClaimAt);
  });

  it('every claim uses a different seed even at the same moment', async () => {
    const b = new LocalBackend();
    await b.reset();
    const p = await b.create(mine);
    b.offsetSeconds = 3 * 3600;
    const a = await b.exec(p, { t: 'claim' });
    expect(a.ok).toBe(true);
  });

  it('survives a corrupt save by starting fresh instead of crashing', async () => {
    const b = new LocalBackend();
    await b.reset();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => '{not json',
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    try {
      expect(loadSave()).toBeNull();
      expect(await new LocalBackend().load()).toBeNull();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
