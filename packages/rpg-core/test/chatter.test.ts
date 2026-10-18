import { describe, expect, it } from 'vitest';
import { CHATTER, newVoice, readChatter, speak, stepVoice } from '../src/chatter';
import { seeded } from '../src/rng';
import chatterJson from '../config/chatter.json';

describe('chatter config', () => {
  it('reads the shipped file', () => {
    expect(CHATTER.chance.defeated).toBe(1);
    expect(CHATTER.emote.notice).toBe('excl');
    expect(CHATTER.idleEvery[0]).toBeLessThanOrEqual(CHATTER.idleEvery[1]);
  });

  it('refuses bad numbers', () => {
    const bad = (patch: Record<string, unknown>) => () => readChatter({ ...chatterJson, ...patch });
    expect(bad({ chance: { ...chatterJson.chance, idle: 2 } })).toThrow(/0..1/);
    expect(bad({ emote: { ...chatterJson.emote, hurt: 'heart' } })).toThrow(/one of/);
    expect(bad({ idleEvery: [9, 3] })).toThrow(/shortest/);
    expect(bad({ blinkEvery: 4 })).toThrow(/shortest/);
    expect(bad({ squash: {} })).toThrow(/breathe/);
  });
});

describe('a voice', () => {
  it('remarks and blinks now and then, within the configured times', () => {
    const rng = seeded(3);
    const v = newVoice(rng);
    let remarks = 0,
      blinks = 0;
    for (let t = 0; t < 120; t += 0.1) {
      const s = stepVoice(v, 0.1, rng);
      if (s.remark) remarks++;
      if (s.blink) blinks++;
    }
    expect(remarks).toBeGreaterThanOrEqual(Math.floor(120 / CHATTER.idleEvery[1]));
    expect(remarks).toBeLessThanOrEqual(Math.ceil(120 / CHATTER.idleEvery[0]));
    expect(blinks).toBeGreaterThanOrEqual(Math.floor(120 / CHATTER.blinkEvery[1]));
  });

  it('keeps quiet for a while after a line, except for what it must say', () => {
    const v = newVoice(seeded(1));
    const always = () => 0;
    expect(speak(v, 'attack', 3, always)).not.toBeNull();
    expect(speak(v, 'hurt', 3, always)).toBeNull();
    expect(speak(v, 'defeated', 3, always)).not.toBeNull();
    stepVoice(v, CHATTER.gap + 0.1, always);
    expect(speak(v, 'hurt', 3, always)).not.toBeNull();
  });

  it('never says the same line twice running, and nothing when it has no lines', () => {
    const v = newVoice(seeded(2));
    const rng = seeded(9);
    let last = -1;
    for (let n = 0; n < 40; n++) {
      const i = speak(v, 'defeated', 3, rng)!;
      expect(i).not.toBe(last);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(3);
      last = i;
    }
    expect(speak(v, 'defeated', 0, rng)).toBeNull();
    expect(speak(newVoice(rng), 'idle', 2, () => 0.99)).toBeNull();
  });
});
