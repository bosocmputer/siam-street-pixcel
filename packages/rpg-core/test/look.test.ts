import { describe, expect, it } from 'vitest';
import {
  APPEARANCE,
  LOOK_PARTS,
  checkName,
  choices,
  defaultLook,
  randomLook,
  readAppearance,
  validLook,
} from '../src/look';
import { ConfigError } from '../src/config';
import { seeded } from '../src/rng';
import appearanceJson from '../config/appearance.json';

describe('appearance config', () => {
  it('offers every hair shape to both bodies and has defaults for each', () => {
    expect(choices('hair')).toEqual(['spiky', 'undercut', 'fluffy', 'bob', 'long', 'ponytail']);
    for (const b of APPEARANCE.bodies) expect(validLook(defaultLook(b, 'ภาม'))).not.toBeNull();
    for (const p of LOOK_PARTS) expect(choices(p).length).toBeGreaterThan(1);
  });

  it('refuses broken choices', () => {
    const base = structuredClone(appearanceJson) as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => () => readAppearance({ ...base, ...patch });
    expect(bad({ bodies: ['f', 'm'] })).toThrow(ConfigError);
    expect(bad({ hair: [] })).toThrow(/hair/);
    expect(bad({ hairColors: { navy: 'blue' } })).toThrow(/rrggbb/);
    expect(bad({ eyes: {} })).toThrow(/empty/);
    expect(bad({ faces: {} })).toThrow(/faces/);
    expect(bad({ faces: { x: { ...appearanceJson.faces.sharp, smile: [1] } } })).toThrow(/smile/);
    expect(bad({ faces: { x: { ...appearanceJson.faces.sharp, tilt: 'up' } } })).toThrow(/tilt/);
    expect(
      bad({
        defaults: {
          ...appearanceJson.defaults,
          f: { ...appearanceJson.defaults.f, hair: 'mohawk' },
        },
      }),
    ).toThrow(/defaults\.f/);
  });
});

describe('names', () => {
  it('Thai, English and digits, up to the limit, spaces trimmed', () => {
    expect(checkName('ต้นข้าว')).toBe('ok');
    expect(checkName('  Pham 99 ')).toBe('ok');
    expect(checkName('   ')).toBe('empty');
    expect(checkName('ก'.repeat(APPEARANCE.nameMax + 1))).toBe('long');
    expect(checkName('a<b>')).toBe('letters');
    expect(checkName('two  spaces')).toBe('letters');
  });
});

describe('looks from a save', () => {
  it('keeps a good look and trims the name', () => {
    const l = { ...defaultLook('m'), hairColor: 'blond', name: ' ภาม ' };
    expect(validLook(l)).toEqual({ ...l, name: 'ภาม' });
  });

  it('refuses anything that is not a current choice', () => {
    const l = defaultLook('m', 'ภาม');
    expect(validLook({ ...l, body: 'x' })).toBeNull();
    expect(validLook({ ...l, eye: 'gold' })).toBeNull();
    expect(validLook({ ...l, name: '' })).toBeNull();
    expect(validLook({ ...l, name: 7 })).toBeNull();
    expect(validLook('ภาม')).toBeNull();
    expect(validLook(null)).toBeNull();
  });
});

describe('the dice', () => {
  it('always makes a valid look and keeps the name; the same seed gives the same look', () => {
    const r = seeded(7);
    for (let i = 0; i < 50; i++) expect(validLook(randomLook(r, 'มิ้นท์'))).not.toBeNull();
    expect(randomLook(seeded(3), 'a')).toEqual(randomLook(seeded(3), 'a'));
    expect(randomLook(() => 0.999999, 'a').skin).toBe('tone4');
  });
});
