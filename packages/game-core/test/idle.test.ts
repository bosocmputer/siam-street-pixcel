import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  claim,
  computeDerived,
  diagnoseStage,
  equipSkill,
  evaluateFight,
  getDistrict,
  getMonster,
  killsForStage,
  playerDps,
  setFarmTarget,
  bossDamage,
  type ClaimReport,
  type PlayerState,
} from '../src';
import { afterTutorial, cfg, fresh, strong } from './helpers';

const H = 3600;
const must = (r: ReturnType<typeof claim>) => {
  if (!r.ok) throw new Error('claim failed: ' + r.reason);
  return r;
};

describe('a new player can always farm stage 1', () => {
  it('survives every stage-1 monster of every district they can reach first', () => {
    const s = fresh();
    const d = computeDerived(s, cfg);
    const wiang = getDistrict(cfg, 'wiang');
    for (const m of wiang.monsters) {
      const f = evaluateFight(d, getMonster(cfg, m.id), 1, wiang.stageOffset, cfg);
      expect(f.survives).toBe(true);
      expect(f.ttk).toBeGreaterThan(0);
    }
  });
});

describe('claim: determinism and idempotence', () => {
  it('same state + time + seed gives the exact same result', () => {
    const a = must(claim(fresh(), 4 * H, 'seed-1', cfg));
    const b = must(claim(fresh(), 4 * H, 'seed-1', cfg));
    expect(a.state).toEqual(b.state);
    expect(a.report).toEqual(b.report);
  });

  it('different seeds can differ in drops but never in kills or exp', () => {
    const a = must(claim(fresh(), 4 * H, 'seed-a', cfg));
    const b = must(claim(fresh(), 4 * H, 'seed-b', cfg));
    expect(a.report.kills).toBe(b.report.kills);
    expect(a.report.exp).toBe(b.report.exp);
  });

  it('a second claim right away is refused and changes nothing', () => {
    const first = must(claim(fresh(), 4 * H, 's', cfg));
    const again = claim(first.state, 4 * H + 5, 's', cfg);
    expect(again).toEqual({ ok: false, reason: 'tooSoon' });
  });

  it('refuses when the clock goes backwards', () => {
    const s = fresh('wiang', 10 * H);
    expect(claim(s, 5 * H, 's', cfg)).toEqual({ ok: false, reason: 'tooSoon' });
  });

  it('does not mutate the input state', () => {
    const s = fresh();
    const copy = structuredClone(s);
    claim(s, 4 * H, 's', cfg);
    expect(s).toEqual(copy);
  });

  it('claiming in two halves earns about the same as one long claim (no free money from splitting)', () => {
    const long = must(claim(fresh(), 6 * H, 's', cfg));
    const half = must(claim(fresh(), 3 * H, 's1', cfg));
    const two = must(claim(half.state, 6 * H, 's2', cfg));
    const total = half.report.exp + two.report.exp;
    expect(total / long.report.exp).toBeGreaterThan(0.6);
    expect(total / long.report.exp).toBeLessThan(1.6);
  });
});

describe('claim: the offline cap and the welcome-back gift', () => {
  it('ignores time beyond the cap', () => {
    const capped = must(claim(fresh(), cfg.balance.idle.capSeconds, 's', cfg));
    const longer = must(claim(fresh(), cfg.balance.idle.capSeconds + 2 * H, 's', cfg));
    expect(longer.report.effectiveSeconds).toBe(cfg.balance.idle.capSeconds);
    expect(longer.report.exp).toBe(capped.report.exp);
  });

  it('gives a welcome-back bonus only after a long absence, and never more than what was lost', () => {
    const away = cfg.balance.idle.welcomeBackAfterSeconds + 6 * H;
    const r = must(claim(fresh(), away, 's', cfg)).report;
    expect(r.welcomeBackSeconds).toBeGreaterThan(0);
    expect(r.welcomeBackSeconds).toBeLessThanOrEqual(away - cfg.balance.idle.capSeconds);
    expect(r.welcomeBackSeconds).toBeLessThanOrEqual(cfg.balance.idle.welcomeBackMaxBonusSeconds);
    const normal = must(claim(fresh(), 2 * 86400, 's', cfg)).report;
    expect(normal.welcomeBackSeconds).toBe(0);
  });
});

describe('claim: rewards', () => {
  it('pays exp, coins, cores and materials and writes them into the new state', () => {
    const { state, report } = must(claim(fresh(), 8 * H, 's', cfg));
    expect(report.kills).toBeGreaterThan(0);
    expect(report.exp).toBeGreaterThan(0);
    expect(state.coins).toBeGreaterThanOrEqual(report.coins);
    expect(state.lastClaimAt).toBe(8 * H);
    expect(Object.keys(report.cores).length).toBeGreaterThan(0);
    for (const [id, n] of Object.entries(report.cores)) expect(state.cores[id]).toBe(n);
    expect(state.level).toBeGreaterThan(1);
    expect(state.statPoints).toBeGreaterThan(fresh().statPoints);
  });

  it('only drops the district monsters', () => {
    const wiang = new Set(getDistrict(cfg, 'wiang').monsters.map((m) => m.id));
    const { report } = must(claim(fresh(), 8 * H, 's', cfg));
    for (const id of Object.keys(report.cores)) expect(wiang.has(id)).toBe(true);
  });

  it('clears stages in order and keeps the frontier consistent', () => {
    const { state, report } = must(claim(fresh(), 8 * H, 's', cfg));
    const cleared = state.progress.wiang ?? 0;
    expect(report.stagesCleared).toEqual(Array.from({ length: cleared }, (_, i) => i + 1));
    expect(state.farm.stage).toBeLessThanOrEqual(Math.min(cleared + 1, 30));
    expect(state.farm.frontierKills).toBeGreaterThanOrEqual(0);
    expect(state.farm.killCarry).toBeGreaterThanOrEqual(0);
    expect(state.farm.killCarry).toBeLessThan(1);
  });

  it('auto-salvages items below the chosen rarity and when the bag is full', () => {
    const s = strong(60);
    s.autoSalvageBelow = 'legend';
    s.farm.stage = 1;
    const r = must(claim(s, 8 * H, 's', cfg));
    expect(r.report.items.every((i) => i.rarity === 'legend')).toBe(true);
    expect(r.state.items.some((i) => i.uid === 'i1')).toBe(true); // the equipped starter sword is never auto-salvaged
    expect(r.state.equipment.weapon).toBe('i1');
    const full = strong(60);
    for (let i = 0; i < 80; i++)
      full.items.push({ uid: `f${i}`, defId: 'ngob', rarity: 'common', upgrade: 0 });
    const r2 = must(claim(full, 8 * H, 's', cfg));
    expect(r2.state.items.filter((x) => x.uid !== 'i1').length).toBeLessThanOrEqual(
      Math.max(80, 40 + Math.floor(full.level / 5) * cfg.balance.inventory.capacityPerFiveLevels),
    );
  });

  it('an active rule changes the outcome in the expected direction', () => {
    const base = must(claim(fresh(), 8 * H, 's', cfg)).report;
    const market = must(claim(fresh(), 8 * H, 's', cfg, { rule: { coinMult: 2 } })).report;
    expect(market.coins).toBeGreaterThan(base.coins * 1.8);
    const study = must(claim(fresh(), 8 * H, 's', cfg, { rule: { expMult: 2 } })).report;
    expect(study.exp).toBeGreaterThan(base.exp * 1.8);
  });

  it('a carry helper makes the slime a bit faster, not twice as fast', () => {
    const s = afterTutorial();
    const dps = (carry: boolean) => playerDps(computeDerived(s, cfg), null, cfg, { carry });
    expect(dps(true)).toBeGreaterThan(dps(false));
    expect(dps(true) / dps(false)).toBeLessThan(1.2);
  });
});

describe('claim: walls, retreat and hints', () => {
  it('retreats to an easier stage instead of dying, and reports it', () => {
    const s = fresh();
    s.progress.wiang = 29;
    s.farm.stage = 30;
    const r = must(claim(s, 2 * H, 's', cfg)).report;
    expect(r.targetStage).toBe(30);
    if (r.stuck) expect(r.farmedStage).toBe(0);
    else expect(r.farmedStage).toBeLessThan(30);
    expect(r.hint).toBeDefined();
  });

  it('is stuck (earns nothing) in a district that is far too hard, with a usable hint', () => {
    const s = fresh();
    s.farm.districtId = 'nimman'; // far beyond a level-1 slime
    const r = must(claim(s, 8 * H, 's', cfg));
    expect(r.report.stuck).toBe(true);
    expect(r.report.kills).toBe(0);
    expect(r.state.exp).toBe(0);
    expect(r.report.hint?.suggestElement).toBeDefined();
  });

  it('suggests the element that beats a monster that out-elements us', () => {
    const s = strong(5);
    s.formId = 'slime_ember'; // fire form is beaten by water
    const h = diagnoseStage(computeDerived(s, cfg), 'ping', 25, cfg);
    expect(h?.reason).toBe('element');
    expect(h?.suggestElement).toBe('earth'); // earth beats water
  });

  it('never loops forever on a cleared district', () => {
    const s = strong(80);
    s.progress.wiang = 30;
    s.farm.stage = 30;
    const r = must(claim(s, 8 * H, 's', cfg));
    expect(r.report.stagesCleared).toEqual([]);
    expect(r.state.progress.wiang).toBe(30);
  });
});

describe('claim: boss contribution', () => {
  it('adds damage only when a boss is given, and element advantage matters', () => {
    const s = strong(40);
    const none = must(claim(s, 8 * H, 's', cfg)).report;
    expect(none.bossDamage).toBe(0);
    const withBoss = must(claim(s, 8 * H, 's', cfg, { bossId: 'boss_hyacinth' })).report;
    expect(withBoss.bossDamage).toBeGreaterThan(0);
    const fire = strong(40);
    fire.formId = 'slime_ember'; // fire beats wind, loses to water
    const d = computeDerived(fire, cfg);
    expect(bossDamage(d, 'boss_caffeine', 100, cfg)).toBeGreaterThan(
      bossDamage(d, 'boss_hyacinth', 100, cfg),
    );
  });
});

describe('setFarmTarget', () => {
  it('lets you pick any stage up to the frontier and nothing beyond', () => {
    const s = fresh();
    s.progress.wiang = 4;
    expect(setFarmTarget(s, 'wiang', 5, cfg).ok).toBe(true);
    expect(setFarmTarget(s, 'wiang', 6, cfg)).toEqual({ ok: false, reason: 'badStage' });
    expect(setFarmTarget(s, 'wiang', 0, cfg).ok).toBe(false);
    expect(setFarmTarget(s, 'wiang', 2.5, cfg).ok).toBe(false);
    const sw = setFarmTarget(s, 'ping', 1, cfg);
    expect(sw.ok && sw.state.farm.districtId).toBe('ping');
  });

  it('kills needed per stage grows but starts small', () => {
    expect(killsForStage(1, cfg)).toBeGreaterThanOrEqual(1);
    expect(killsForStage(30, cfg)).toBeGreaterThanOrEqual(killsForStage(1, cfg));
  });
});

describe('claim: invariants over random players and times (property-based)', () => {
  const arbState = fc
    .record({
      level: fc.integer({ min: 1, max: 80 }),
      district: fc.constantFrom('wiang', 'ping', 'thapae', 'nimman'),
      seconds: fc.integer({ min: 30, max: 40 * 86400 }),
      seed: fc.string(),
      stage: fc.integer({ min: 1, max: 30 }),
      cleared: fc.integer({ min: 0, max: 30 }),
    })
    .map(({ level, district, seconds, seed, stage, cleared }) => {
      const s = strong(level);
      s.farm = {
        districtId: district,
        stage: Math.min(stage, cleared + 1),
        frontierKills: 0,
        killCarry: 0,
      };
      s.progress[district] = cleared;
      return { s, seconds, seed };
    });

  it('never produces negative or non-finite numbers, and stays inside the rules', () => {
    fc.assert(
      fc.property(arbState, ({ s, seconds, seed }) => {
        const r = claim(s, seconds, seed, cfg);
        if (!r.ok) return false;
        const { state, report } = r;
        const nums: number[] = [
          state.coins,
          state.exp,
          state.level,
          state.statPoints,
          report.kills,
          report.exp,
          report.coins,
          report.bossDamage,
          ...Object.values(state.materials),
          ...Object.values(state.cores),
        ];
        if (!nums.every((n) => Number.isFinite(n) && n >= 0)) return false;
        if (state.level > cfg.balance.maxLevel || state.level < s.level) return false;
        if (
          report.effectiveSeconds >
          cfg.balance.idle.capSeconds + cfg.balance.idle.welcomeBackMaxBonusSeconds
        )
          return false;
        const district = getDistrict(cfg, state.farm.districtId);
        const cleared = state.progress[district.id] ?? 0;
        if (cleared < (s.progress[district.id] ?? 0) || cleared > district.stageCount) return false;
        if (state.farm.stage < 1 || state.farm.stage > district.stageCount) return false;
        if (state.farm.killCarry < 0 || state.farm.killCarry >= 1) return false;
        return true;
      }),
      { numRuns: 10_000 },
    );
  });

  it('is deterministic for any input', () => {
    fc.assert(
      fc.property(arbState, ({ s, seconds, seed }) => {
        const a = claim(s, seconds, seed, cfg) as {
          ok: true;
          state: PlayerState;
          report: ClaimReport;
        };
        const b = claim(s, seconds, seed, cfg) as {
          ok: true;
          state: PlayerState;
          report: ClaimReport;
        };
        return JSON.stringify(a.state) === JSON.stringify(b.state);
      }),
      { numRuns: 150 },
    );
  });

  it('equipping skills before a claim never breaks it', () => {
    const s = afterTutorial();
    const eq = equipSkill(s, 'active', 0, 'brick_smash', cfg);
    if (!eq.ok) throw new Error('equip');
    expect(claim(eq.state, 8 * H, 's', cfg).ok).toBe(true);
  });
});
