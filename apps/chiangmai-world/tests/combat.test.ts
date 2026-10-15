import { describe, expect, it } from 'vitest';
import { CombatSimulation, type CombatPose } from '../src/combat';

const pose: CombatPose = { position: [0, 0], yaw: 0, pitch: 0, blocking: false };
const open = () => false;
const advance = (sim: CombatSimulation, seconds: number, player = pose) => {
  for (let t = 0; t < seconds; t += 0.02) sim.step(0.02, player, open);
};

describe('first-person swordsman combat', () => {
  it('only damages a slime in front, in sword reach, once per swing', () => {
    const sim = new CombatSimulation([
      [0, -2],
      [0, 2],
      [0, -9],
    ]);
    expect(sim.attack(pose, open)).toBe(true);
    advance(sim, 0.25);
    expect(sim.slimes[0].hp).toBe(44);
    expect(sim.slimes[1].hp).toBe(70);
    expect(sim.slimes[2].hp).toBe(70);
    expect(sim.attack(pose, open)).toBe(false);
    advance(sim, 0.15);
    expect(sim.slimes[0].hp).toBe(44);
  });
  it('cannot hit through an intervening mapped wall', () => {
    const sim = new CombatSimulation([[0, -2]]);
    const wall = (p: [number, number]) => p[1] < -0.8 && p[1] > -1.2;
    sim.attack(pose, wall);
    for (let i = 0; i < 15; i++) sim.step(0.02, pose, wall);
    expect(sim.slimes[0].hp).toBe(70);
  });
  it('lets the player dodge the telegraphed slime attack by leaving its reach', () => {
    const sim = new CombatSimulation([[0, -1.2]]);
    advance(sim, 0.1);
    expect(sim.slimes[0].mode).toBe('windup');
    advance(sim, 0.8, { ...pose, position: [0, 8] });
    expect(sim.player.hp).toBe(100);
  });
  it('deals contact damage after a windup and blocking reduces frontal damage', () => {
    const normal = new CombatSimulation([[0, -1.2]]);
    advance(normal, 0.85);
    expect(normal.player.hp).toBe(88);
    const blocked = new CombatSimulation([[0, -1.2]]);
    advance(blocked, 0.85, { ...pose, blocking: true });
    expect(blocked.player.hp).toBe(97);
    expect(blocked.drainEvents().some((e) => e.kind === 'block')).toBe(true);
  });
  it('rewards each defeated slime once and respawns it only after the delay', () => {
    const sim = new CombatSimulation([[0, -2]]);
    sim.slimes[0].hp = 20;
    sim.attack(pose, open);
    advance(sim, 0.25);
    expect(sim.slimes[0].mode).toBe('dead');
    expect(sim.kills).toBe(1);
    expect(sim.player.xp).toBe(20);
    advance(sim, 2);
    expect(sim.slimes[0].mode).toBe('dead');
    expect(sim.kills).toBe(1);
    advance(sim, 7, { ...pose, position: [0, 30] });
    expect(sim.slimes[0].hp).toBe(70);
    expect(sim.slimes[0].mode).not.toBe('dead');
    expect(sim.kills).toBe(1);
  });
  it('prevents damage spam, attacks after defeat, and restores a clean run', () => {
    const sim = new CombatSimulation([
      [0, -1.2],
      [0.5, -1.2],
      [-0.5, -1.2],
    ]);
    advance(sim, 0.85);
    expect(sim.player.hp).toBe(88);
    advance(sim, 25);
    expect(sim.player.hp).toBe(0);
    expect(sim.attack(pose, open)).toBe(false);
    sim.reset();
    expect(sim.player.hp).toBe(100);
    expect(sim.slimes.every((s) => s.hp === 70)).toBe(true);
    expect(sim.kills).toBe(0);
  });
  it('keeps monsters out of mapped obstacles', () => {
    const sim = new CombatSimulation([[0, -6]]);
    const wall = (p: [number, number]) => p[1] > -4 && p[1] < -3;
    for (let i = 0; i < 500; i++) {
      sim.step(0.02, pose, wall);
      expect(wall(sim.slimes[0].position)).toBe(false);
    }
  });
  it('a hit interrupts the slime windup and buys a moment to retreat', () => {
    const sim = new CombatSimulation([[0, -1.2]]);
    advance(sim, 0.05);
    expect(sim.slimes[0].mode).toBe('windup');
    sim.attack(pose, open);
    advance(sim, 0.3);
    expect(sim.slimes[0].mode).toBe('stunned');
    expect(sim.player.hp).toBe(100);
  });
  it('levels up after three kills and only carries unspent XP forward', () => {
    const sim = new CombatSimulation([
      [0, -2],
      [0.4, -2],
      [-0.4, -2],
    ]);
    sim.player.hp = 50;
    sim.slimes.forEach((slime) => {
      slime.hp = 20;
    });
    sim.attack(pose, open);
    advance(sim, 0.25);
    expect(sim.kills).toBe(3);
    expect(sim.player).toMatchObject({ level: 2, xp: 0, damage: 30, maxHp: 110, hp: 80 });
  });
  it('cannot block attacks from behind or without enough stamina', () => {
    const behind = new CombatSimulation([[0, 1.2]]);
    advance(behind, 0.85, { ...pose, blocking: true });
    expect(behind.player.hp).toBe(88);
    const exhausted = new CombatSimulation([[0, -1.2]]);
    exhausted.player.stamina = 0;
    advance(exhausted, 0.85, { ...pose, blocking: true });
    expect(exhausted.player.hp).toBe(88);
    expect(exhausted.player.stamina).toBeGreaterThanOrEqual(0);
  });
});
