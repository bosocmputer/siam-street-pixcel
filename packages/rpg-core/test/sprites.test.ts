import { describe, expect, it } from 'vitest';
import {
  SPRITES,
  frameAt,
  frameOfDistance,
  readSheetMeta,
  readSprites,
  sheetLayout,
  spriteDirection,
} from '../src/sprites';
import { ConfigError } from '../src/config';
import spritesJson from '../config/sprites.json';

const Q = Math.PI / 4;

describe('sprite config', () => {
  it('reads the shipped file', () => {
    expect(SPRITES.ppm).toBe(spritesJson.ppm);
    expect(SPRITES.dirs).toBe(5);
    expect(Object.keys(SPRITES.hero.anims)).toContain('walk');
  });

  it('refuses a broken file', () => {
    const base = structuredClone(spritesJson) as Record<string, unknown>;
    const hero = base.hero as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => () => readSprites({ ...base, ...patch });
    expect(bad({ dirs: 4 })).toThrow(/5 or 8/);
    expect(bad({ hero: { ...hero, proportions: { Head: [2, 2] } } })).toThrow(/x, y, z/);
    expect(bad({ outline: 2 })).toThrow(/0..1/);
    expect(bad({ maxRender: 4 })).toThrow(/maxRender/);
    expect(bad({ fxPixel: 0 })).toThrow(/fxPixel/);
    expect(bad({ hero: { ...hero, frame: [80] } })).toThrow(/frame/);
    expect(bad({ hero: { ...hero, anchor: [200, 10] } })).toThrow(/inside/);
    expect(bad({ hero: { ...hero, anims: { idle: { frames: 2, fps: 2 } } } })).toThrow(/walk/);
    expect(
      bad({
        hero: { ...hero, anims: { ...(hero.anims as object), idle: { frames: 1.5, fps: 2 } } },
      }),
    ).toThrow(ConfigError);
  });
});

describe('sheet layout', () => {
  it('gives each animation its own picture, one row per direction', () => {
    const l = sheetLayout([
      ['idle', { frames: 4, fps: 3, loop: true }],
      ['walk', { frames: 8, fps: 0, loop: true }],
    ]);
    expect(l.idle).toEqual({ page: 0, row: 0, frames: 4, fps: 3, loop: true });
    expect(l.walk!.page).toBe(1);
  });

  it('checks a sheet from files against its pictures', () => {
    const meta = {
      frame: [64, 64],
      anchor: [32, 60],
      ppm: 32,
      dirs: 8,
      anims: { idle: { row: 0, frames: 4, fps: 4 }, walk: { row: 8, frames: 6, fps: 0 } },
    };
    const m = readSheetMeta(meta, [{ width: 6 * 64, height: 16 * 64 }]);
    expect(m.anims.walk!.loop).toBe(true);
    expect(m.anims.walk!.page).toBe(0);
    expect(() => readSheetMeta(meta, [{ width: 5 * 64, height: 16 * 64 }])).toThrow(/picture 0/);
    const split = {
      ...meta,
      anims: { ...meta.anims, walk: { page: 1, row: 0, frames: 6, fps: 0 } },
    };
    expect(
      readSheetMeta(split, [
        { width: 256, height: 512 },
        { width: 384, height: 512 },
      ]).anims.walk!.page,
    ).toBe(1);
    expect(() => readSheetMeta(split, [{ width: 256, height: 512 }])).toThrow(/no picture 1/);
    expect(() => readSheetMeta({ ...meta, anims: { walk: meta.anims.walk } })).toThrow(/idle/);
    expect(() => readSheetMeta({ ...meta, dirs: 6 })).toThrow(/5 or 8/);
  });
});

describe('which way a sprite shows', () => {
  it('front when facing the camera, the side rows as it turns, mirrored on the left', () => {
    expect(spriteDirection(0, 0, 5)).toEqual({ row: 0, mirror: false });
    expect(spriteDirection(2 * Q, 0, 5)).toEqual({ row: 2, mirror: false });
    expect(spriteDirection(4 * Q, 0, 5)).toEqual({ row: 4, mirror: false });
    expect(spriteDirection(-2 * Q, 0, 5)).toEqual({ row: 2, mirror: true });
    expect(spriteDirection(-Q, 0, 5)).toEqual({ row: 1, mirror: true });
    expect(spriteDirection(-2 * Q, 0, 8)).toEqual({ row: 6, mirror: false });
    // only the difference matters, and it snaps to the nearest eighth
    expect(spriteDirection(3, 3 - 2 * Q - 0.1, 5)).toEqual({ row: 2, mirror: false });
    expect(spriteDirection(10 * Math.PI, 0, 5).row).toBe(0);
  });
});

describe('which frame', () => {
  it('runs on time, holding the last frame when it does not loop', () => {
    const loop = { frames: 4, fps: 4, loop: true };
    expect(frameAt(loop, 0)).toBe(0);
    expect(frameAt(loop, 0.5)).toBe(2);
    expect(frameAt(loop, 1.1)).toBe(0);
    expect(frameAt({ ...loop, loop: false }, 9)).toBe(3);
    expect(frameAt(loop, -1)).toBe(0);
  });

  it('a walk follows the distance, so the feet do not slide', () => {
    expect(frameOfDistance(8, 0, 2.5)).toBe(0);
    expect(frameOfDistance(8, 1.25, 2.5)).toBe(4);
    expect(frameOfDistance(8, 2.5 + 0.3, 2.5)).toBe(0);
    expect(frameOfDistance(8, -0.3, 2.5)).toBe(7);
  });
});
