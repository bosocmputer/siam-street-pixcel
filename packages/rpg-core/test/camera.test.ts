import { describe, expect, it } from 'vitest';
import cameraJson from '../config/camera.json';
import { CAMERA, lockYaw, readCamera, rigFor, sideMetres, wrapAngle } from '../src/camera';
import { ConfigError } from '../src/config';

describe('camera', () => {
  it('sits further out and to the side in shoulder view, further back on a bike', () => {
    expect(rigFor('back', false).side).toBe(0);
    expect(rigFor('shoulder', false).side).toBeGreaterThan(0.2);
    expect(rigFor('shoulder', false).distance).toBeLessThan(rigFor('back', false).distance);
    expect(rigFor('back', true).distance).toBeGreaterThan(rigFor('back', false).distance);
    expect(rigFor('shoulder', true).distance).toBeGreaterThan(rigFor('shoulder', false).distance);
  });

  it('keeps the player the same share of the screen from the middle on any screen shape', () => {
    // a tall phone sees little sideways, so it needs less sideways shift than a wide screen
    const phone = sideMetres(0.35, 6, 60, 390 / 844);
    const wide = sideMetres(0.35, 6, 60, 1.6);
    expect(phone).toBeLessThan(wide);
    expect(phone).toBeGreaterThan(0.3);
    expect(phone).toBeLessThan(0.8);
    // the shift puts the player that share of the half-screen from the middle
    const halfWidth = Math.tan((60 * Math.PI) / 360) * (390 / 844) * 6;
    expect(phone / halfWidth).toBeCloseTo(0.35);
    expect(sideMetres(0.35, 6, 60, 10)).toBe(1.6); // capped
    expect(sideMetres(0, 6, 60, 1.6)).toBe(0);
    expect(sideMetres(0.35, 6, 60, 10, 3)).toBeGreaterThan(1.6);
  });

  it('wraps angles into -π..π', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI);
    expect(wrapAngle(2 * Math.PI + 0.3)).toBeCloseTo(0.3);
  });

  it('turns the view towards a target the short way round, and settles on it', () => {
    const me = { x: 0, z: 0 };
    // a target straight east: looking along (-sin yaw, -cos yaw) means yaw = -π/2
    const target = { x: 10, z: 0 };
    let yaw = 0;
    const first = lockYaw(yaw, me, target, 1 / 60);
    expect(first).toBeLessThan(yaw); // heads towards -π/2, not the long way
    for (let i = 0; i < 600; i++) yaw = lockYaw(yaw, me, target, 1 / 60);
    expect(yaw).toBeCloseTo(-Math.PI / 2, 1);
    // across the ±π seam it still takes the short way
    const behind = { x: 0, z: 10 }; // looking +z means yaw = π
    let y = 3.0;
    y = lockYaw(y, me, behind, 1 / 60);
    expect(y).toBeGreaterThan(3.0);
    let y2 = -3.0;
    y2 = lockYaw(y2, me, behind, 1 / 60);
    expect(y2).toBeLessThan(-3.0);
  });

  it('leaves the view alone for a target too far, too close, or already in front', () => {
    const me = { x: 0, z: 0 };
    expect(lockYaw(0.4, me, { x: 0, z: -CAMERA.lock.range - 1 }, 0.1)).toBe(0.4);
    expect(lockYaw(0.4, me, { x: 0.3, z: 0.3 }, 0.1)).toBe(0.4);
    expect(lockYaw(0, me, { x: 0, z: -10 }, 0.1)).toBe(0); // in front already
  });

  it('never overshoots, even on a long frame', () => {
    const y = lockYaw(0, { x: 0, z: 0 }, { x: 10, z: 0 }, 5);
    expect(y).toBeCloseTo(-Math.PI / 2);
  });

  it('refuses mistakes', () => {
    type Cfg = {
      shoulder: { distance: unknown; side: unknown };
      pitch: { min: unknown };
      lock: { range: unknown };
    };
    const bad = (change: (c: Cfg) => void) => {
      const c = structuredClone(cameraJson) as unknown as Cfg;
      change(c);
      return () => readCamera(c);
    };
    expect(bad((c) => (c.shoulder.distance = 'near'))).toThrow(/camera.shoulder.distance/);
    expect(bad((c) => (c.pitch.min = 2))).toThrow(/min ≤ start ≤ max/);
    expect(bad((c) => (c.shoulder.side = 1.5))).toThrow(/share of half the screen/);
    expect(bad((c) => (c.lock.range = 0))).toThrow(/camera.lock.range/);
    expect(() => readCamera(null)).toThrow(ConfigError);
  });
});
