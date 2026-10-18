import { describe, expect, it } from 'vitest';
import soundsJson from '../config/sounds.json';
import { ConfigError } from '../src/config';
import { COMBO, FOOTSTEPS, SOUNDS, SPATIAL, SOUND_LIMITS, readSounds, sound } from '../src/sounds';

type Cfg = {
  sounds: Record<string, Record<string, unknown> & { layers: Record<string, unknown>[] }>;
  spatial: Record<string, number>;
  footsteps: Record<string, unknown>;
};
const copy = (): Cfg => structuredClone(soundsJson) as unknown as Cfg;
const bad = (change: (c: Cfg) => void) => {
  const c = copy();
  change(c);
  return () => readSounds(c);
};

describe('sound recipes', () => {
  it('has every sound the game plays, with sensible lengths', () => {
    for (const id of [
      'ui.click',
      'ui.deny',
      'fire.gather',
      'fire.release',
      'fire.impact',
      'water.gather',
      'water.release',
      'water.impact',
      'hit.weak',
      'hit.resist',
      'slime.hop',
      'slime.watch',
      'slime.attack',
      'slime.hurt',
      'slime.melt',
      'slime.respawn',
      'player.hurt',
      'player.down',
      'player.up',
      'player.levelup',
      'item.drop',
      'item.pickup',
      'step.walk',
      'step.run',
      'step.bike',
    ])
      expect(SOUNDS[id], id).toBeDefined();
    for (const s of Object.values(SOUNDS)) {
      expect(s.length).toBeGreaterThan(0.04);
      expect(s.length).toBeLessThan(2); // short effects, never a long clip
    }
    expect(SOUND_LIMITS.voices).toBeGreaterThan(4);
    expect(SPATIAL.far).toBeGreaterThan(SPATIAL.near);
    expect(FOOTSTEPS.run).toBeLessThan(FOOTSTEPS.walk);
    expect(COMBO.max).toBeGreaterThan(1);
  });

  it('the gathering sounds are about as long as the gathering of each skill', () => {
    // the game stretches a sound to fit, but a recipe that is far off would sound squeezed
    expect(sound('fire.gather').length).toBeGreaterThan(0.45);
    expect(sound('fire.gather').length).toBeLessThan(0.75);
    expect(sound('water.gather').length).toBeGreaterThan(0.25);
    expect(sound('water.gather').length).toBeLessThan(0.55);
  });

  it('a layer fills in what the recipe leaves out, and the length counts every layer', () => {
    const click = sound('ui.click');
    const layer = click.layers[0]!;
    expect(layer.kind).toBe('osc');
    expect(layer.wave).toBe('sine');
    expect(layer.env.hold).toBe(0);
    expect(layer.env.peak).toBe(1);
    expect(layer.at).toBe(0);
    expect(layer.repeat).toEqual({ count: 1, spread: 0 });
    expect(layer.freq!.curve).toBe('exp');
    expect(layer.filter).toBeNull();
    expect(click.spatial).toBe(false);
    expect(click.alert).toBe(false);
    expect(click.length).toBeCloseTo(0.053);
    // a late layer, and a repeated one spread over time, both stretch the whole sound
    const deny = sound('ui.deny');
    expect(deny.length).toBeCloseTo(0.13 + 0.005 + 0.05 + 0.09);
    const melt = sound('slime.melt');
    expect(melt.length).toBeGreaterThan(1);
    expect(sound('slime.hop').spatial).toBe(true);
    expect(sound('player.levelup').alert).toBe(true);
    expect(sound('player.levelup').duck).toBeLessThan(1);
  });

  it('refuses mistakes, naming the exact place', () => {
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.kind = 'laser'))).toThrow(
      /ui.click.layers\[0\].kind/,
    );
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.wave = 'zigzag'))).toThrow(/wave/);
    expect(bad((c) => delete c.sounds['ui.click']!.layers[0]!.freq)).toThrow(
      /freq: expected an object/,
    );
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.freq = { from: 0, to: 100 }))).toThrow(
      /freq.from/,
    );
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.freq = { from: 50000, to: 100 }))).toThrow(
      /20000 Hz/,
    );
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.env = { attack: 0, release: 0 }))).toThrow(
      /release/,
    );
    expect(
      bad((c) => (c.sounds['ui.click']!.layers[0]!.env = { attack: 0, release: 1, peak: 5 })),
    ).toThrow(/peak/);
    expect(
      bad((c) => (c.sounds['ui.click']!.layers[0]!.filter = { type: 'notch', from: 100, to: 100 })),
    ).toThrow(/filter.type/);
    expect(
      bad(
        (c) =>
          (c.sounds['ui.click']!.layers[0]!.filter = {
            type: 'lowpass',
            from: 100,
            to: 100,
            q: 99,
          }),
      ),
    ).toThrow(/q up to 30/);
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.repeat = { count: 2.5 }))).toThrow(
      /whole number/,
    );
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.repeat = { count: 99 }))).toThrow(
      /whole number/,
    );
    expect(bad((c) => (c.sounds['ui.click']!.layers[0]!.jitter = 2))).toThrow(/jitter/);
    expect(bad((c) => (c.sounds['ui.click']!.layers = []))).toThrow(/at least one layer/);
    expect(bad((c) => (c.sounds['ui.click']!.priority = 7))).toThrow(/priority/);
    expect(bad((c) => (c.sounds['ui.click']!.volume = 9))).toThrow(/volume/);
    expect(bad((c) => (c.sounds['ui.click']!.spatial = 'yes'))).toThrow(
      /spatial: expected true or false/,
    );
    expect(bad((c) => (c.sounds['player.down']!.duck = 2))).toThrow(/duck: expected 0..1/);
    expect(bad((c) => delete c.sounds['player.down']!.duck)).toThrow(/an alert needs a duck/);
    expect(bad((c) => (c.spatial.far = 2))).toThrow(/far to be more than near/);
    expect(bad((c) => delete c.sounds['step.bike'])).toThrow(/missing step.bike/);
    expect(bad((c) => (c.sounds = {}))).toThrow(/no sounds/);
    expect(() => readSounds(null)).toThrow(ConfigError);
    expect(() => sound('boom')).toThrow(/unknown sound/);
  });
});
