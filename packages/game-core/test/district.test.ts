import { describe, expect, it } from 'vitest';
import {
  bestiaryBonus,
  bossMaxHp,
  completedSets,
  chooseHome,
  createNewPlayer,
  evolutionOptions,
  homeCooldownDays,
  normalizeLook,
  sanitizeName,
  grantTutorialCores,
  pickRuleOptions,
  seasonScore,
  tallyVotes,
  type PlayerState,
} from '../src';
import { cfg, fresh } from './helpers';

function chooseHomeOk(st: PlayerState, id: string, now: number): PlayerState {
  const r = chooseHome(st, id, now, cfg);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe('district boss and league', () => {
  it('boss HP scales with active players and has a floor', () => {
    expect(bossMaxHp(0, cfg)).toBe(cfg.balance.boss.minHp);
    expect(bossMaxHp(1000, cfg)).toBeGreaterThan(bossMaxHp(10, cfg));
    expect(bossMaxHp(-5, cfg)).toBe(cfg.balance.boss.minHp);
  });

  it('season score is per active player, shrunk so small districts are not unfairly strong or weak', () => {
    const big = seasonScore(1000, 100, cfg);
    const small = seasonScore(10, 1, cfg);
    expect(big).toBeGreaterThan(0);
    expect(small).toBeGreaterThan(0);
    // one star player does not beat a district that is just as strong per head
    expect(seasonScore(1000, 1, cfg)).toBeLessThan(1000);
    expect(seasonScore(0, 0, cfg)).toBe(0);
    // a district of 100 players each doing 10 beats a district of 1 player doing 10
    expect(seasonScore(100 * 10, 100, cfg)).toBeGreaterThan(seasonScore(10, 1, cfg));
  });
});

describe('weekly rules', () => {
  it('offers 3 distinct rules, the same every time for the same week', () => {
    const a = pickRuleOptions('2026-W42:wiang', cfg).map((r) => r.id);
    const b = pickRuleOptions('2026-W42:wiang', cfg).map((r) => r.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
    expect(pickRuleOptions('2026-W43:wiang', cfg).map((r) => r.id)).not.toEqual(a);
  });

  it('the vote winner has the most votes', () => {
    const options = ['flood_moat', 'big_market', 'doi_wind'];
    expect(tallyVotes({ big_market: 5, doi_wind: 2 }, options, 'w', cfg)).toBe('big_market');
  });

  it('breaks ties reproducibly and only among tied options', () => {
    const options = ['flood_moat', 'big_market', 'doi_wind'];
    const votes = { flood_moat: 3, big_market: 3, doi_wind: 1 };
    const w1 = tallyVotes(votes, options, 'w', cfg);
    expect(tallyVotes(votes, options, 'w', cfg)).toBe(w1);
    expect(['flood_moat', 'big_market']).toContain(w1);
    expect(options).toContain(tallyVotes({}, options, 'w', cfg));
  });

  it('rejects unknown rule ids and empty option lists', () => {
    expect(() => tallyVotes({}, ['nope'], 'w', cfg)).toThrow();
    expect(() => tallyVotes({}, [], 'w', cfg)).toThrow();
  });
});

describe('bestiary and new player', () => {
  it('a completed district set gives a small permanent bonus', () => {
    const s = fresh();
    expect(completedSets(s, cfg)).toEqual([]);
    expect(bestiaryBonus(s, cfg)).toEqual({ atkMult: 1, hpMult: 1 });
    s.bestiary = { brick_imp: 1, clay_pot: 4, wall_rat: 1 };
    expect(completedSets(s, cfg)).toEqual(['wiang']);
    const b = bestiaryBonus(s, cfg);
    expect(b.atkMult).toBeCloseTo(cfg.balance.bestiary.setAtkMult);
    s.bestiary.hyacinth_walker = 1; // incomplete set adds nothing
    expect(completedSets(s, cfg)).toEqual(['wiang']);
  });

  it('creates a valid new player and rejects unknown districts', () => {
    const s = createNewPlayer(cfg, 'ping', 123);
    expect(s.level).toBe(1);
    expect(s.lastClaimAt).toBe(123);
    expect(s.homeDistrictId).toBe('ping');
    expect(s.farm.districtId).toBe('wiang'); // everyone starts on the easiest district
    expect(s.equipment.weapon).toBe('i1');
    expect(s.activeSkills).toHaveLength(cfg.balance.skills.activeSlots);
    expect(s.passiveSkills).toHaveLength(cfg.balance.skills.passiveSlots);
    expect(s.presets).toHaveLength(cfg.balance.inventory.presetCount);
    expect(() => createNewPlayer(cfg, 'nope', 0)).toThrow();
  });

  it('tutorial cores come from the district everyone starts on and are enough to unlock a skill', () => {
    const s = grantTutorialCores(fresh(), cfg);
    expect(s.cores.brick_imp).toBe(cfg.balance.tutorial.firstMonsterCores);
    expect(cfg.balance.tutorial.firstMonsterCores).toBeGreaterThanOrEqual(
      cfg.balance.skills.unlockCores,
    );
  });

  it('a new player has no home district until they choose, and can choose once for free', () => {
    const s = createNewPlayer(cfg, null, 100, { name: 'บอส', look: { color: 'sky', eyes: 2 } });
    expect(s.homeDistrictId).toBeNull();
    expect(s.homeChosenAt).toBeNull();
    expect(s.name).toBe('บอส');
    expect(s.look).toEqual({ color: 'sky', eyes: 2 });
    const r = chooseHome(s, 'nimman', 200, cfg);
    expect(r.ok && r.state.homeDistrictId).toBe('nimman');
    expect(r.ok && r.state.homeChosenAt).toBe(200);
  });

  it('changing the home district waits for the cooldown, and rejects unknown or same ones', () => {
    const day = 86400;
    const s = chooseHomeOk(createNewPlayer(cfg, null, 0), 'ping', 0);
    expect(chooseHome(s, 'ping', 10, cfg)).toEqual({ ok: false, reason: 'same' });
    expect(chooseHome(s, 'nope', 10, cfg)).toEqual({ ok: false, reason: 'unknownDistrict' });
    expect(chooseHome(s, 'thapae', 10, cfg)).toEqual({ ok: false, reason: 'cooldown' });
    expect(homeCooldownDays(s, 0, cfg)).toBe(cfg.balance.home.changeDays);
    expect(homeCooldownDays(s, day * 10, cfg)).toBe(cfg.balance.home.changeDays - 10);
    const later = chooseHome(s, 'thapae', day * cfg.balance.home.changeDays, cfg);
    expect(later.ok && later.state.homeDistrictId).toBe('thapae');
    expect(homeCooldownDays(createNewPlayer(cfg, null, 0), 0, cfg)).toBe(0);
  });

  it('cleans up names and looks the player typed or picked', () => {
    expect(sanitizeName('  สไลม์\n\tน้อย  ', cfg)).toBe('สไลม์ น้อย');
    expect(Array.from(sanitizeName('ก'.repeat(50), cfg))).toHaveLength(cfg.looks.nameMaxLength);
    expect(sanitizeName('', cfg)).toBe('');
    expect(normalizeLook({ color: 'nope', eyes: 99 }, cfg)).toEqual({
      color: cfg.looks.colors[0],
      eyes: cfg.looks.eyes - 1,
    });
    expect(normalizeLook(undefined, cfg).eyes).toBe(0);
    expect(normalizeLook({ eyes: -3 }, cfg).eyes).toBe(0);
  });

  it('home element only opens a first evolution line when a home has been chosen', () => {
    const s = createNewPlayer(cfg, null, 0);
    s.level = 10;
    s.absorbedElements = { earth: 9, water: 0, fire: 0, wind: 0 };
    const lines = (st: typeof s) => evolutionOptions(st, cfg).map((f) => f.element);
    expect(lines(s)).toEqual(['earth']); // only what was absorbed
    const withHome = chooseHomeOk(s, 'nimman', 0);
    expect(lines(withHome)).toContain('wind');
  });
});
