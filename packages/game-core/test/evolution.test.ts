import { describe, expect, it } from 'vitest';
import { createNewPlayer, dominantElements, evolutionOptions, evolve } from '../src';
import { cfg, fresh } from './helpers';

describe('evolution', () => {
  it('is not available before level 10 or before absorbing enough', () => {
    const s = fresh();
    s.absorbedElements.earth = 10;
    expect(evolutionOptions(s, cfg)).toEqual([]);
    s.level = 10;
    s.absorbedElements.earth = 0;
    expect(evolutionOptions(s, cfg)).toEqual([]);
  });

  it('opens the line of the most-absorbed element and of the home district', () => {
    const s = fresh(); // home: wiang (earth)
    s.level = 10;
    s.absorbedElements = { earth: 2, water: 9, fire: 1, wind: 0 };
    expect(dominantElements(s)).toEqual(['water']);
    expect(
      evolutionOptions(s, cfg)
        .map((f) => f.id)
        .sort(),
    ).toEqual(['slime_brick', 'slime_droplet']);
  });

  it('the home district alone is enough to open its line', () => {
    const s = createNewPlayer(cfg, 'nimman', 0);
    s.level = 10;
    s.absorbedElements = { earth: 9, water: 0, fire: 0, wind: 0 };
    expect(
      evolutionOptions(s, cfg)
        .map((f) => f.id)
        .sort(),
    ).toEqual(['slime_brick', 'slime_puff']);
  });

  it('offers a choice when elements tie', () => {
    const s = fresh();
    s.homeDistrictId = 'wiang';
    s.level = 10;
    s.absorbedElements = { earth: 5, water: 5, fire: 0, wind: 0 };
    expect(
      evolutionOptions(s, cfg)
        .map((f) => f.id)
        .sort(),
    ).toEqual(['slime_brick', 'slime_droplet']);
  });

  it('evolves, grants the form skill, and continues along the same line at level 30', () => {
    const s = fresh();
    s.level = 10;
    s.absorbedElements.fire = 6;
    const r = evolve(s, 'slime_ember', cfg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.formId).toBe('slime_ember');
    expect(r.state.skills.form_ember?.level).toBe(1);
    expect(evolutionOptions(r.state, cfg)).toEqual([]); // level 30 needed
    const s2 = structuredClone(r.state);
    s2.level = 30;
    expect(evolutionOptions(s2, cfg).map((f) => f.id)).toEqual(['slime_market_fire']);
    const r2 = evolve(s2, 'slime_market_fire', cfg);
    expect(r2.ok && r2.state.skills.form_blaze?.level).toBe(1);
  });

  it('refuses a form that is not on offer', () => {
    const s = fresh();
    s.level = 10;
    s.absorbedElements.fire = 6;
    expect(evolve(s, 'slime_puff', cfg)).toEqual({ ok: false, reason: 'notAvailable' });
    expect(evolve(fresh(), 'slime_ember', cfg).ok).toBe(false);
  });

  it('has no dominant element before any absorb', () => {
    expect(dominantElements(fresh())).toEqual([]);
  });
});
