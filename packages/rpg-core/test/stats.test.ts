import { describe, expect, it } from 'vitest';
import {
  PLAYER,
  expToNext,
  gainExp,
  hurt,
  maxEnergy,
  maxHp,
  newStats,
  readPlayer,
  spend,
  stepStats,
} from '../src/stats';
import playerJson from '../config/player.json';

describe('player stats', () => {
  it('starts full, and each level needs a little more experience', () => {
    const s = newStats();
    expect(s.hp).toBe(maxHp(1));
    expect(s.energy).toBe(maxEnergy(1));
    expect(maxHp(3)).toBe(PLAYER.hp.base + 2 * PLAYER.hp.perLevel);
    expect(expToNext(1)).toBe(PLAYER.exp.base);
    expect(expToNext(5)).toBeGreaterThan(expToNext(4));
  });

  it('levels up, carries spare experience over, and fills up on a new level', () => {
    const s = newStats();
    s.hp = 10;
    s.energy = 0;
    expect(gainExp(s, expToNext(1) - 1)).toBe(0);
    expect(s.hp).toBe(10);
    expect(gainExp(s, 1 + expToNext(2) + 5)).toBe(2);
    expect(s.level).toBe(3);
    expect(s.exp).toBe(5);
    expect(s.hp).toBe(maxHp(3));
    expect(s.energy).toBe(maxEnergy(3));
    expect(gainExp(s, -50)).toBe(0);
  });

  it('stops at the top level', () => {
    const s = newStats(PLAYER.maxLevel - 1);
    expect(gainExp(s, 1e9)).toBe(1);
    expect(s.level).toBe(PLAYER.maxLevel);
    expect(s.exp).toBe(0);
    expect(gainExp(s, 100)).toBe(0);
  });

  it('spends energy only when there is enough, and it refills over time', () => {
    const s = newStats();
    s.energy = 20;
    expect(spend(s, 25)).toBe(false);
    expect(s.energy).toBe(20);
    expect(spend(s, 10)).toBe(true);
    expect(s.energy).toBe(10);
    stepStats(s, 1);
    expect(s.energy).toBeCloseTo(10 + PLAYER.energy.regen);
    stepStats(s, 100);
    expect(s.energy).toBe(maxEnergy(1));
  });

  it('is safe for a moment after a hit, and health refills only after a quiet while', () => {
    const s = newStats();
    expect(hurt(s, 30)).toBe('hurt');
    expect(s.hp).toBe(maxHp(1) - 30);
    expect(hurt(s, 30)).toBe('ignored');
    stepStats(s, PLAYER.invulnerable + 0.01);
    expect(hurt(s, 10)).toBe('hurt');
    const hp = s.hp;
    stepStats(s, PLAYER.hpRegen.delay - 0.5);
    expect(s.hp).toBe(hp);
    stepStats(s, 1);
    expect(s.hp).toBeGreaterThan(hp);
  });

  it('goes down when health runs out, then gets up full, with nothing lost', () => {
    const s = newStats(2);
    s.exp = 7;
    s.hp = 5;
    expect(hurt(s, 8)).toBe('down');
    expect(s.hp).toBe(0);
    expect(s.down).toBe(PLAYER.downTime);
    expect(spend(s, 1)).toBe(false);
    expect(hurt(s, 8)).toBe('ignored');
    expect(stepStats(s, PLAYER.downTime / 2)).toBeNull();
    expect(stepStats(s, PLAYER.downTime)).toBe('up');
    expect(s.hp).toBe(maxHp(2));
    expect(s.energy).toBe(maxEnergy(2));
    expect(s.level).toBe(2);
    expect(s.exp).toBe(7);
    expect(s.safe).toBeGreaterThan(0);
  });

  it('checks the config, including that every button names a real skill', () => {
    expect(readPlayer(playerJson).slots).toEqual(['fireball', 'waterball']);
    expect(() => readPlayer({ ...playerJson, slots: ['fireball', 'thunder'] })).toThrow(/thunder/);
    expect(() => readPlayer({ ...playerJson, hp: { base: 0, perLevel: 1 } })).toThrow(
      /player.hp.base/,
    );
  });
});
