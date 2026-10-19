import { describe, expect, it } from 'vitest';
import {
  COMBOS,
  MELEE,
  comboBonus,
  comboGauge,
  critChance,
  dashSpeed,
  landHit,
  newFighter,
  pressDash,
  pressStrike,
  readMelee,
  releaseGuard,
  stepFighter,
  strikeDamage,
  takeBlow,
  type Fighter,
  type MeleeSpec,
} from '../src/melee';
import { ConfigError } from '../src/config';
import combatJson from '../config/combat.json';

const DT = 1 / 60;
/** run the fighter's clocks for `t` seconds; returns every swing started and landed */
function run(f: Fighter, t: number, spec: MeleeSpec = MELEE) {
  const started: number[] = [];
  const landed: number[] = [];
  let drain = 0;
  for (let n = Math.round(t / DT); n > 0; n--) {
    const s = stepFighter(f, DT, spec);
    if (s.started) started.push(s.started.step);
    if (s.landed) landed.push(s.landed.step);
    drain += s.drain;
  }
  return { started, landed, drain };
}
const [h1, h2, h3] = MELEE.strike.hits as [
  (typeof MELEE.strike.hits)[0],
  (typeof MELEE.strike.hits)[0],
  (typeof MELEE.strike.hits)[0],
];

describe('combat config', () => {
  it('reads the numbers from the jobs book', () => {
    expect(MELEE.strike.hits).toHaveLength(3);
    expect(h3.damage).toBeGreaterThan(h1.damage);
    expect(h3.knock).toBeGreaterThan(h1.knock);
    expect(MELEE.strike.reach).toBe(2.5);
    expect(MELEE.strike.energyOnHit).toBe(2);
    expect(MELEE.dash.distance).toBe(4);
    expect(MELEE.guard.reduce).toBe(0.6);
    expect(MELEE.perfect.window).toBe(0.25);
    expect(MELEE.combo.ultimateAt).toBe(30);
    expect(dashSpeed()).toBeCloseTo(16);
  });

  it('refuses broken numbers', () => {
    const bad = (patch: (c: typeof combatJson) => unknown) =>
      readMelee(patch(structuredClone(combatJson)));
    expect(() => bad((c) => ({ ...c, strike: { ...c.strike, hits: [] } }))).toThrow(ConfigError);
    expect(() =>
      bad((c) => ({
        ...c,
        strike: { ...c.strike, hits: [{ damage: 1, knock: 0, time: 0.1, impact: 0.3 }] },
      })),
    ).toThrow(/after the swing/);
    expect(() => bad((c) => ({ ...c, dash: { ...c.dash, time: 0 } }))).toThrow(/above 0/);
    expect(() => bad((c) => ({ ...c, guard: { ...c.guard, reduce: 2 } }))).toThrow(/at most 1/);
    expect(() => bad((c) => ({ ...c, combo: { ...c.combo, step: 0 } }))).toThrow(/at least 1/);
    expect(() => bad((c) => ({ ...c, crit: { ...c.crit, chance: -1 } }))).toThrow(ConfigError);
    expect(() => bad((c) => ({ ...c, perfect: 3 }))).toThrow(/object/);
    expect(() => readMelee(null)).toThrow(ConfigError);
  });
});

describe('the strike chain', () => {
  it('lands each blow at its impact time and chains three hits, the third a finisher', () => {
    const f = newFighter();
    const a = pressStrike(f)!;
    expect(a).toMatchObject({ step: 1, multiplier: 1, combo: null });
    const first = run(f, h1.impact + DT);
    expect(first.landed).toEqual([1]);
    run(f, h1.time - h1.impact);
    expect(f.swing).toBeNull();
    expect(pressStrike(f)!.step).toBe(2);
    run(f, h2.time + DT);
    const fin = pressStrike(f)!;
    expect(fin).toMatchObject({ step: 3, combo: 'finisher' });
    run(f, h3.time + DT);
    // after the third the chain starts again
    expect(pressStrike(f)!.step).toBe(1);
  });

  it('starts again from the first hit after too long a pause', () => {
    const f = newFighter();
    pressStrike(f);
    run(f, h1.time + MELEE.strike.chainWindow + 0.1);
    expect(pressStrike(f)!.step).toBe(1);
  });

  it('combo help gives longer to press the next hit', () => {
    const f = newFighter(true);
    pressStrike(f);
    run(f, h1.time + MELEE.strike.chainWindow + 0.1);
    expect(pressStrike(f)!.step).toBe(2);
  });

  it('a press during a swing waits and follows straight after', () => {
    const f = newFighter();
    pressStrike(f);
    expect(pressStrike(f)).toBeNull();
    expect(f.queued).toBe(true);
    const r = run(f, h1.time + h2.time + 0.05);
    expect(r.started).toEqual([2]);
    expect(r.landed).toEqual([1, 2]);
  });
});

describe('dash and guard', () => {
  it('dashes while moving: safe for a moment, then waits for the cooldown', () => {
    const f = newFighter();
    expect(pressDash(f, true)).toBe('dash');
    expect(f.dash).toBe(MELEE.dash.time);
    expect(f.safe).toBe(MELEE.dash.safe);
    expect(pressDash(f, true)).toBeNull();
    run(f, MELEE.dash.cooldown + DT);
    expect(f.dash).toBe(0);
    expect(pressDash(f, true)).toBe('dash');
  });

  it('a dash breaks off a swing', () => {
    const f = newFighter();
    pressStrike(f);
    pressStrike(f);
    pressDash(f, true);
    expect(f.swing).toBeNull();
    expect(f.queued).toBe(false);
  });

  it('a strike out of a dash hits harder, once', () => {
    const f = newFighter();
    pressDash(f, true);
    run(f, MELEE.dashStrike.window - 0.1);
    const s = pressStrike(f)!;
    expect(s).toMatchObject({ combo: 'dashStrike', multiplier: MELEE.dashStrike.multiplier });
    expect(f.dash).toBe(0);
    run(f, s.hit.time + DT);
    expect(pressStrike(f)!.combo).toBeNull();
  });

  it('a strike long after a dash is an ordinary one', () => {
    const f = newFighter();
    pressDash(f, true);
    run(f, MELEE.dashStrike.window + 0.1);
    expect(pressStrike(f)!.combo).toBeNull();
  });

  it('guards while standing, using energy, and takes less from a blow', () => {
    const f = newFighter();
    pressStrike(f);
    expect(pressDash(f, false)).toBe('guard');
    expect(f.swing).toBeNull();
    const r = run(f, 1);
    expect(r.drain).toBeCloseTo(MELEE.guard.energyPerSecond);
    f.combo = 4;
    expect(takeBlow(f, 20)).toEqual({ result: 'guarded', damage: 8 });
    expect(f.combo).toBe(4);
    releaseGuard(f);
    expect(run(f, 1).drain).toBe(0);
    expect(takeBlow(f, 20).result).toBe('hit');
  });

  it('a strike ends the guard', () => {
    const f = newFighter();
    pressDash(f, false);
    pressStrike(f);
    expect(f.guarding).toBe(false);
  });
});

describe('blows and the perfect dodge', () => {
  it('a blow just after a dash starts is dodged perfectly: slow time, then a counter', () => {
    const f = newFighter();
    pressDash(f, true);
    run(f, MELEE.perfect.window - 0.05);
    expect(takeBlow(f, 30)).toEqual({ result: 'perfect', damage: 0 });
    expect(f.slow).toBe(MELEE.perfect.slow);
    run(f, MELEE.perfect.slow + DT);
    expect(f.slow).toBe(0);
    const s = pressStrike(f)!;
    expect(s).toMatchObject({ combo: 'counter', multiplier: MELEE.perfect.multiplier });
    expect(f.counter).toBe(false);
  });

  it('combo help widens the perfect dodge', () => {
    const late = MELEE.perfect.window + 0.1;
    const f = newFighter();
    pressDash(f, true);
    run(f, late);
    expect(takeBlow(f, 30).result).toBe('hit');
    const g = newFighter(true);
    pressDash(g, true);
    run(g, late);
    expect(takeBlow(g, 30).result).toBe('perfect');
  });

  it('a dash that keeps the player safe longer than the perfect window still dodges', () => {
    const spec: MeleeSpec = { ...MELEE, dash: { ...MELEE.dash, safe: 0.6 } };
    const f = newFighter();
    pressDash(f, true, spec);
    run(f, 0.4, spec);
    expect(takeBlow(f, 30, spec)).toEqual({ result: 'dodged', damage: 0 });
  });

  it('a blow that hits ends the combo and the chain', () => {
    const f = newFighter();
    pressStrike(f);
    landHit(f);
    landHit(f);
    expect(takeBlow(f, 12)).toEqual({ result: 'hit', damage: 12 });
    expect(f).toMatchObject({ combo: 0, chain: 0, swing: null });
    expect(f.best).toBe(2);
  });
});

describe('the combo count', () => {
  it('counts hits, gives energy back, and ends after a pause', () => {
    const f = newFighter();
    expect(landHit(f)).toBe(MELEE.strike.energyOnHit);
    landHit(f);
    expect(f.combo).toBe(2);
    run(f, MELEE.combo.resetAfter - 0.5);
    expect(f.combo).toBe(2);
    run(f, 1);
    expect(f.combo).toBe(0);
    expect(f.best).toBe(2);
  });

  it('auto play stops counting at its cap', () => {
    const f = newFighter();
    for (let i = 0; i < 25; i++) landHit(f, true);
    expect(f.combo).toBe(MELEE.combo.autoCap);
  });

  it('every ten hits add 5%, up to 25%, and thirty fill the ultimate gauge', () => {
    expect(comboBonus(9)).toBe(0);
    expect(comboBonus(10)).toBeCloseTo(0.05);
    expect(comboBonus(29)).toBeCloseTo(0.1);
    expect(comboBonus(500)).toBeCloseTo(0.25);
    expect(comboGauge(15)).toBeCloseTo(0.5);
    expect(comboGauge(45)).toBe(1);
  });

  it('names the three basic combos', () => {
    expect([...COMBOS]).toEqual(['finisher', 'dashStrike', 'counter']);
  });
});

describe('damage', () => {
  it('grows with level, power, the swing, the combo, weakness and a critical hit', () => {
    expect(strikeDamage(18, { level: 1 })).toBe(18);
    expect(strikeDamage(18, { level: 2 }, MELEE, 0.1)).toBe(20);
    expect(strikeDamage(18, { level: 1, power: 1.5 })).toBe(27);
    expect(strikeDamage(18, { level: 1, multiplier: 2 })).toBe(36);
    expect(strikeDamage(20, { level: 1, combo: 20 })).toBe(22);
    expect(strikeDamage(20, { level: 1, takes: 0.5 })).toBe(10);
    expect(strikeDamage(20, { level: 1, crit: true })).toBe(30);
    expect(strikeDamage(0, { level: 1 })).toBe(1);
  });

  it('DEX raises the chance of a critical hit', () => {
    expect(critChance(5)).toBeCloseTo(MELEE.crit.chance);
    expect(critChance(15)).toBeCloseTo(MELEE.crit.chance + 10 * MELEE.crit.perDex);
    expect(critChance(1000)).toBe(1);
  });
});
