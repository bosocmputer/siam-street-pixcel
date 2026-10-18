import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, readPrefs, writePrefs } from './storage';

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
