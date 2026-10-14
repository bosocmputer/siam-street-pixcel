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

  it('different seeds can differ in drops and lucky golden monsters, but never in kills', () => {
    const a = must(claim(fresh(), 4 * H, 'seed-a', cfg));
    const b = must(claim(fresh(), 4 * H, 'seed-b', cfg));
    expect(a.report.kills).toBe(b.report.kills);
    expect(a.report.exp / b.report.exp).toBeGreaterThan(0.7); // only golden-monster luck differs
    expect(a.report.exp / b.report.exp).toBeLessThan(1.4);
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

describe('claim: the offline cap and rested time', () => {
  const idle = cfg.balance.idle;

  it('time beyond the cap still counts, but at a reduced rate', () => {
    const capped = must(claim(fresh(), idle.capSeconds, 's', cfg)).report;
    const away = must(claim(fresh(), idle.capSeconds + 6 * H, 's', cfg)).report;
    expect(capped.restedSeconds).toBe(0);
    expect(away.restedSeconds).toBeCloseTo(6 * H * idle.restedRate);
    expect(away.effectiveSeconds).toBeGreaterThan(capped.effectiveSeconds);
    expect(away.effectiveSeconds).toBeLessThan(idle.capSeconds + 6 * H);
  });

  it('rested time is limited, so a very long absence cannot be farmed', () => {
    const r = must(claim(fresh(), 60 * 86400, 's', cfg)).report;
    expect(r.restedSeconds).toBeCloseTo(idle.restedMaxSeconds * idle.restedRate);
    expect(r.effectiveSeconds).toBeLessThanOrEqual(
      idle.capSeconds + idle.restedMaxSeconds * idle.restedRate + 1e-6,
    );
  });

  it('opening the app often is never worse per hour than being away', () => {
    // 3 days away: frequent players earn far more than one big late claim
    let s = fresh();
    let often = 0;
    for (let h = 8; h <= 72; h += 8) {
      const r = must(claim(s, h * H, `o${h}`, cfg));
      s = r.state;
      often += r.report.exp;
    }
    const once = must(claim(fresh(), 72 * H, 's', cfg)).report.exp;
    expect(often).toBeGreaterThan(once);
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
    expect(state.frontierKills.wiang ?? 0).toBeGreaterThanOrEqual(0);
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

describe('partial stage progress', () => {
  it('is kept per district when you switch away and back', () => {
    let s = fresh();
    s.progress.wiang = 2;
    s.frontierKills.wiang = 40;
    const toPing = setFarmTarget(s, 'ping', 1, cfg);
    if (!toPing.ok) throw new Error('switch');
    s = toPing.state;
    expect(s.frontierKills.wiang).toBe(40);
    const back = setFarmTarget(s, 'wiang', 3, cfg);
    expect(back.ok && back.state.frontierKills.wiang).toBe(40);
  });

  it('is saved when a claim ends mid-stage and used by the next claim', () => {
    const first = must(claim(fresh(), 2 * H, 's1', cfg));
    const mid = first.state.frontierKills.wiang ?? 0;
    const need = killsForStage((first.state.progress.wiang ?? 0) + 1, cfg, 1);
    expect(mid).toBeLessThan(need);
    const second = must(claim(first.state, 4 * H, 's2', cfg));
    expect(second.report.kills).toBeGreaterThan(0);
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
          cfg.balance.idle.capSeconds +
            cfg.balance.idle.restedMaxSeconds * cfg.balance.idle.restedRate +
            1e-6
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

describe('golden monsters', () => {
  const lucky = structuredClone(cfg);
  lucky.balance.rewards.golden.chance = 1; // every kill is golden
  const none = structuredClone(cfg);
  none.balance.rewards.golden.chance = 0;

  it('are counted, deterministic and never negative', () => {
    const a = must(claim(fresh(), 4 * H, 's', lucky));
    const b = must(claim(fresh(), 4 * H, 's', lucky));
    expect(a.report.golden.count).toBeGreaterThan(0);
    expect(a.report.golden).toEqual(b.report.golden);
    const byMonster = Object.values(a.report.golden.byMonster).reduce((x, y) => x + y, 0);
    expect(byMonster).toBe(a.report.golden.count);
  });

  it('give a burst of exp, coins and cores compared with no golden monsters', () => {
    const base = must(claim(fresh(), 4 * H, 's', none)).report;
    const gold = must(claim(fresh(), 4 * H, 's', lucky)).report;
    expect(base.golden.count).toBe(0);
    expect(gold.exp).toBeGreaterThan(base.exp * 3);
    expect(gold.coins).toBeGreaterThan(base.coins * 3);
    const coresOf = (r: ClaimReport) => Object.values(r.cores).reduce((x, y) => x + y, 0);
    expect(coresOf(gold)).toBeGreaterThan(coresOf(base));
  });
});

describe('stage milestones', () => {
  // make monsters trivial and stages short so one claim clears many stages
  const easy = structuredClone(cfg);
  easy.balance.combat.hpStep = 0;
  easy.balance.combat.atkStep = 0;
  easy.balance.idle.killsPerStage = 1;
  easy.balance.idle.killsPerStageGrowth = 1;
  easy.balance.rewards.itemDropChance = 0; // every item below comes from a milestone
  easy.balance.rewards.golden.chance = 0;
  for (const d of easy.districts) d.killMult = 1;

  it('pay out on every 5th stage and on the last stage', () => {
    const s = strong(60);
    const r = must(claim(s, 8 * H, 's', easy)).report;
    const stages = r.milestones.map((m) => m.stage);
    expect(stages.length).toBeGreaterThan(0);
    for (const m of r.milestones) {
      expect(m.stage % 5 === 0 || m.final).toBe(true);
      expect(r.stagesCleared).toContain(m.stage);
    }
  });

  it('guarantee at least a good item, and at least a rare one for finishing the district', () => {
    const s = strong(80);
    s.autoSalvageBelow = null;
    for (let i = 0; i < 100; i++)
      s.items.push({ uid: `x${i}`, defId: 'ngob', rarity: 'common', upgrade: 0 });
    s.progress.wiang = 25;
    s.farm.stage = 26;
    // a roomy bag so nothing is salvaged
    easy.balance.inventory.baseCapacity = 500;
    const r = must(claim(s, 8 * H, 's', easy)).report;
    const rank = ['common', 'good', 'rare', 'legend'];
    expect(r.items.length).toBe(r.milestones.length);
    r.items.forEach((it, i) => {
      const final = r.milestones[i]?.final ?? false;
      expect(rank.indexOf(it.rarity)).toBeGreaterThanOrEqual(rank.indexOf(final ? 'rare' : 'good'));
    });
    expect(r.milestones.some((m) => m.final)).toBe(true);
  });

  it('also give cores of every monster in the district', () => {
    const s = strong(60);
    const r = must(claim(s, 8 * H, 's', easy)).report;
    for (const m of getDistrict(easy, 'wiang').monsters)
      expect(r.cores[m.id] ?? 0).toBeGreaterThan(0);
  });
});
