import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  readAssist,
  readFound,
  readPrefs,
  writeAssist,
  writeFound,
  writePrefs,
} from './storage';

/** A tiny stand-in for the browser's storage. */
function fakeStorage(initial: Record<string, string> = {}, broken = false) {
  const data = { ...initial };
  const fail = () => {
    if (broken) throw new Error('storage blocked');
  };
  return {
    data,
    api: {
      getItem: (k: string) => (fail(), data[k] ?? null),
      setItem: (k: string, v: string) => (fail(), void (data[k] = v)),
      removeItem: (k: string) => (fail(), void delete data[k]),
    },
  };
}
const install = (s: ReturnType<typeof fakeStorage>) =>
  Object.defineProperty(globalThis, 'localStorage', { value: s.api, configurable: true });

afterEach(() => Reflect.deleteProperty(globalThis, 'localStorage'));

describe('sound settings on this device', () => {
  it('start at the defaults when nothing is stored, even where storage does not exist', () => {
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
    install(fakeStorage());
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.muted).toBe(false);
  });

  it('keep what was written', () => {
    const s = fakeStorage();
    install(s);
    writePrefs({ muted: true, volume: 0.3 });
    expect(readPrefs()).toEqual({ muted: true, volume: 0.3 });
  });

  it('ignore anything damaged or out of range', () => {
    for (const bad of [
      'not json',
      '[1]',
      '{"muted":"yes","volume":0.5}',
      '{"muted":true,"volume":3}',
      '{"muted":true}',
      'null',
    ]) {
      install(fakeStorage({ 'citywalk.sound': bad }));
      expect(readPrefs()).toEqual(DEFAULT_PREFS);
    }
  });

  it('carry on without storing when storage refuses', () => {
    install(fakeStorage({}, true));
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
    expect(() => writePrefs({ muted: true, volume: 0.2 })).not.toThrow();
  });
});

describe('combos found on this device', () => {
  it('are remembered, and anything damaged or blocked counts as none found', () => {
    expect(readFound().size).toBe(0);
    const s = fakeStorage();
    install(s);
    writeFound(new Set(['finisher', 'counter']));
    expect([...readFound()].sort()).toEqual(['counter', 'finisher']);
    install(fakeStorage({ 'citywalk.combos': '{"a":1}' }));
    expect(readFound().size).toBe(0);
    install(fakeStorage({ 'citywalk.combos': '["dashStrike", 3]' }));
    expect([...readFound()]).toEqual(['dashStrike']);
    install(fakeStorage({}, true));
    expect(readFound().size).toBe(0);
    expect(() => writeFound(new Set(['x']))).not.toThrow();
  });
});

describe('combo help on this device', () => {
  it('is off until turned on, and stays as chosen', () => {
    expect(readAssist()).toBe(false);
    install(fakeStorage());
    writeAssist(true);
    expect(readAssist()).toBe(true);
    writeAssist(false);
    expect(readAssist()).toBe(false);
    install(fakeStorage({}, true));
    expect(readAssist()).toBe(false);
    expect(() => writeAssist(true)).not.toThrow();
  });
});
