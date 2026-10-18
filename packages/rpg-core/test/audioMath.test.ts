import { describe, expect, it } from 'vitest';
import {
  advanceSteps,
  duckGain,
  newCombo,
  newMixer,
  newStepClock,
  nextCombo,
  release,
  request,
  spatialize,
} from '../src/audioMath';
import { COMBO, FOOTSTEPS, SPATIAL, sound, type SoundSpec } from '../src/sounds';

/** a made-up sound for the rules, so they do not depend on the real recipes */
const fake = (id: string, priority: 1 | 2 | 3, cooldown = 0, alert = false): SoundSpec => ({
  ...sound('ui.click'),
  id,
  priority,
  cooldown,
  alert,
  duck: alert ? 0.4 : 1,
  length: 1,
});

describe('how many sounds play at once', () => {
  it('lets sounds play and counts them', () => {
    const m = newMixer();
    const a = request(m, fake('a', 1), 0);
    const b = request(m, fake('b', 1), 0);
    expect(a.play && b.play).toBe(true);
    expect(a.uid).not.toBe(b.uid);
    expect(m.voices).toHaveLength(2);
    // finished voices are forgotten
    request(m, fake('c', 1), 5);
    expect(m.voices).toHaveLength(1);
  });

  it('refuses the same sound again too soon', () => {
    const m = newMixer();
    const s = fake('step', 1, 0.1);
    expect(request(m, s, 0).play).toBe(true);
    expect(request(m, s, 0.05).play).toBe(false);
    expect(request(m, s, 0.11).play).toBe(true);
    expect(m.voices).toHaveLength(2);
  });

  it('when full, cuts the quietest one that ends soonest, and never for a less important sound', () => {
    const m = newMixer();
    // fill 3 slots with priorities 2, 1 and 1 (the first 1 ends sooner)
    request(m, fake('p2', 2), 0, 5, 3);
    const early = request(m, fake('p1a', 1), 0, 1, 3);
    request(m, fake('p1b', 1), 0, 4, 3);
    // an equal-priority sound takes the place of the one ending soonest
    const next = request(m, fake('p1c', 1), 0.1, 1, 3);
    expect(next.play).toBe(true);
    expect(next.steal).toBe(early.uid);
    expect(m.voices).toHaveLength(3);
    // a more important one cuts a priority-1 voice
    const big = request(m, fake('p3', 3), 0.2, 1, 3);
    expect(big.play && big.steal !== null).toBe(true);
    // but when everything left matters more, a priority-1 sound is simply not played
    const full = newMixer();
    request(full, fake('x', 3), 0, 5, 2);
    request(full, fake('y', 2), 0, 5, 2);
    expect(request(full, fake('z', 1), 0.1, 1, 2)).toEqual({ play: false, steal: null, uid: 0 });
    expect(full.voices).toHaveLength(2);
  });

  it('a held sound cut short frees its place after its fade', () => {
    const m = newMixer();
    const roar = request(m, fake('roar', 2), 0, 3, 1);
    // a held 3-second roar stopped at 1 s with a 0.1 s fade
    release(m, roar.uid, 1, 0.1);
    expect(m.voices[0]!.end).toBeCloseTo(1.1);
    expect(request(m, fake('next', 1), 1.2, 1, 1)).toMatchObject({ play: true, steal: null });
    // releasing never makes a sound last longer, and an unknown one is ignored
    release(m, 999, 5);
    release(m, m.voices[0]!.uid, 50);
    expect(m.voices[0]!.end).toBeCloseTo(2.2);
  });

  it('an alert holds the other sounds down only while it lasts', () => {
    const m = newMixer();
    expect(duckGain(m, 0)).toBe(1);
    request(m, fake('alert', 3, 0, true), 10, 2);
    expect(duckGain(m, 11)).toBe(0.4);
    expect(duckGain(m, 12.01)).toBe(1);
    // an ordinary sound does not duck anything
    const q = newMixer();
    request(q, fake('plain', 3), 0);
    expect(duckGain(q, 0.5)).toBe(1);
  });
});

describe('where a sound seems to come from', () => {
  const me = { x: 0, z: 0, yaw: 0 }; // looking towards -z, so +x is on the right

  it('is on the right for something to the right, and left for the left', () => {
    expect(spatialize(me, { x: 10, z: 0 }).pan).toBeGreaterThan(0.5);
    expect(spatialize(me, { x: -10, z: 0 }).pan).toBeLessThan(-0.5);
    // straight ahead or behind is in the middle
    expect(spatialize(me, { x: 0, z: -10 }).pan).toBeCloseTo(0);
    expect(spatialize(me, { x: 0, z: 10 }).pan).toBeCloseTo(0);
  });

  it('turns with the way the listener looks', () => {
    // looking east (yaw -π/2): something to the north (-z) is now on the left
    const east = { x: 0, z: 0, yaw: -Math.PI / 2 };
    expect(spatialize(east, { x: 0, z: -10 }).pan).toBeLessThan(-0.5);
    expect(spatialize(east, { x: 0, z: 10 }).pan).toBeGreaterThan(0.5);
  });

  it('is in the middle right on top of the listener, and leans in gradually near them', () => {
    expect(spatialize(me, { x: 0.2, z: 0 }).pan).toBe(0);
    const near = spatialize(me, { x: 1, z: 0 }).pan;
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(spatialize(me, { x: 5, z: 0 }).pan);
    expect(Math.abs(spatialize(me, { x: 99, z: 0 }).pan)).toBeLessThanOrEqual(0.85);
  });

  it('gets quieter with distance: full nearby, fading, silent far away', () => {
    const g = (d: number) => spatialize(me, { x: d, z: 0 }).gain;
    expect(g(1)).toBe(1);
    expect(g(SPATIAL.near)).toBe(1);
    expect(g(SPATIAL.near * 2)).toBeCloseTo(0.5);
    expect(g(10)).toBeGreaterThan(g(20));
    expect(g(20)).toBeGreaterThan(g(SPATIAL.far * 0.9));
    expect(g(SPATIAL.far)).toBe(0);
    expect(g(SPATIAL.far + 50)).toBe(0);
    for (let d = 0.1; d < SPATIAL.far; d += 0.7)
      expect(g(d + 0.7)).toBeLessThanOrEqual(g(d) + 1e-9);
  });
});

describe('footsteps', () => {
  it('fall on a steady beat, quicker when running', () => {
    const count = (mode: 'walk' | 'run' | 'bike') => {
      const c = newStepClock();
      let n = 0;
      for (let t = 0; t < 10; t += 1 / 60) n += advanceSteps(c, 1 / 60, true, mode);
      return n;
    };
    expect(count('walk')).toBeGreaterThanOrEqual(Math.floor(10 / FOOTSTEPS.walk) - 1);
    expect(count('walk')).toBeLessThanOrEqual(Math.ceil(10 / FOOTSTEPS.walk));
    expect(count('run')).toBeGreaterThan(count('walk'));
    expect(count('bike')).toBeGreaterThan(count('run') - 1);
  });

  it('start soon after starting to move, and stop when standing still', () => {
    const c = newStepClock();
    expect(advanceSteps(c, 0.1, false, 'walk')).toBe(0);
    let at = 0;
    for (let t = 0; t < 1; t += 1 / 60) {
      at += 1 / 60;
      if (advanceSteps(c, 1 / 60, true, 'walk') > 0) break;
    }
    expect(at).toBeLessThan(FOOTSTEPS.walk * 0.5);
    expect(advanceSteps(c, 5, false, 'walk')).toBe(0);
  });

  it('a long frame gives several steps rather than losing them', () => {
    const c = newStepClock();
    advanceSteps(c, 0, false, 'run');
    expect(advanceSteps(c, FOOTSTEPS.run * 3, true, 'run')).toBeGreaterThanOrEqual(3);
  });
});

describe('picking things up one after another', () => {
  it('each quick pickup is a little higher, up to a limit, and a pause starts over', () => {
    const c = newCombo();
    expect(nextCombo(c, 0)).toBe(1);
    expect(nextCombo(c, 0.5)).toBeCloseTo(1 + COMBO.step);
    expect(nextCombo(c, 1.0)).toBeCloseTo(1 + 2 * COMBO.step);
    let last = 0;
    for (let i = 0; i < 30; i++) last = nextCombo(c, 1.5 + i * 0.3);
    expect(last).toBeCloseTo(1 + COMBO.max * COMBO.step);
    expect(nextCombo(c, 100)).toBe(1);
  });
});
