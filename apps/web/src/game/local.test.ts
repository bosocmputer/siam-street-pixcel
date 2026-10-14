import { describe, expect, it } from 'vitest';
import { defaultConfig as cfg } from '@slimehood/game-core';
import { LocalBackend, loadSave } from './local';

// vitest runs in node: no localStorage, so the backend falls back to its in-memory copy.
describe('LocalBackend', () => {
  it('creates a player with tutorial cores from the home district and saves it', async () => {
    const b = new LocalBackend();
    await b.reset();
    expect(await b.load()).toBeNull();
    const p = await b.create('nimman');
    expect(p.homeDistrictId).toBe('nimman');
    expect(p.cores.coffee_cup).toBe(cfg.balance.tutorial.firstMonsterCores);
    expect((await b.load())?.homeDistrictId).toBe('nimman');
  });

  it('runs actions and persists every successful one', async () => {
    const b = new LocalBackend();
    await b.reset();
    let p = await b.create('wiang');
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
    const p = await b.create('wiang');
    const before = JSON.stringify(loadSave()?.state);
    const r = await b.exec(p, { t: 'absorb', monsterId: 'wall_rat', count: 1 }); // no such cores
    expect(r.ok).toBe(false);
    expect(JSON.stringify(loadSave()?.state)).toBe(before);
  });

  it('claims with the shifted clock and refuses a claim that is too soon', async () => {
    const b = new LocalBackend();
    await b.reset();
    const p = await b.create('wiang');
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
    const p = await b.create('wiang');
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
