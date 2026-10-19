import { afterEach, describe, expect, it } from 'vitest';
import { artMode } from './art';

function install(data: Record<string, string>, broken = false) {
  const api = {
    getItem: (k: string) => {
      if (broken) throw new Error('blocked');
      return data[k] ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error('blocked');
      data[k] = v;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: api, configurable: true });
}

describe('artMode', () => {
  afterEach(() => install({}));

  it('is pixel 3D unless asked otherwise', () => {
    install({});
    expect(artMode('')).toBe('pixel3d');
  });

  it('follows ?art= and remembers it', () => {
    const data: Record<string, string> = {};
    install(data);
    expect(artMode('?art=3d')).toBe('3d');
    expect(data['citywalk.art']).toBe('3d');
    expect(artMode('')).toBe('3d');
    expect(artMode('?art=pixel')).toBe('pixel');
    expect(artMode('?art=pixel3d')).toBe('pixel3d');
  });

  it('ignores an unknown choice', () => {
    install({ 'citywalk.art': 'oil-paint' });
    expect(artMode('?art=watercolour')).toBe('pixel3d');
  });

  it('still follows the address without storage', () => {
    install({}, true);
    expect(artMode('?art=3d')).toBe('3d');
    expect(artMode('')).toBe('pixel3d');
  });
});
