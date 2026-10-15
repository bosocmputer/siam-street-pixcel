import { describe, expect, it } from 'vitest';
import { CombatSimulation, type CombatPose, type ObstacleCheck } from '../src/combat';

const pose: CombatPose = { position: [0, 0], yaw: 0, pitch: 0, blocking: false };
const open: ObstacleCheck = () => false;
function advance(sim: CombatSimulation, seconds: number, player = pose, blocked = open): void {
  for (let t = 0; t < seconds; t += 0.02) sim.step(0.02, player, blocked);
}

describe('charged spirit crescent', () => {
  it('absorbs spirit while charging, then damages enemies beyond melee range', () => {
    const sim = new CombatSimulation([[0, -10]]);
    expect(sim.castSkill(pose)).toBe(true);
    expect(sim.player.spirit).toBe(65);
    advance(sim, 0.6);
    expect(sim.slimes[0].hp).toBe(70);
    expect(sim.waves).toHaveLength(0);
    expect(sim.attack(pose, open)).toBe(false);
    advance(sim, 0.8);
    expect(sim.slimes[0].hp).toBe(0);
    expect(sim.kills).toBe(1);
    expect(sim.player.xp).toBe(20);
  });
  it('aims at release and never homes after the wave is fired', () => {
    const sim = new CombatSimulation([
      [10, 0],
      [0, -10],
    ]);
    sim.castSkill(pose);
    advance(sim, 0.94, { ...pose, yaw: -Math.PI / 2 });
    advance(sim, 0.7);
    expect(sim.slimes[0].hp).toBe(0);
    expect(sim.slimes[1].hp).toBe(70);
  });
  it('pierces enemies and damages each one only once per wave', () => {
    const sim = new CombatSimulation([
      [0, -6],
      [0.6, -9],
    ]);
    sim.slimes.forEach((slime) => {
      slime.hp = slime.maxHp = 200;
    });
    sim.castSkill(pose);
    advance(sim, 2.8);
    expect(sim.slimes.map((s) => s.hp)).toEqual([122, 122]);
    expect(sim.kills).toBe(0);
    expect(sim.waves).toHaveLength(0);
  });
  it('awards every pierced kill once, including level progression', () => {
    const sim = new CombatSimulation([
      [0, -6],
      [0, -9],
      [0, -11],
    ]);
    sim.castSkill(pose);
    advance(sim, 2);
    expect(sim.kills).toBe(3);
    expect(sim.player).toMatchObject({ level: 2, xp: 0, maxHp: 110, damage: 30 });
    advance(sim, 2);
    expect(sim.kills).toBe(3);
  });
  it('does not deal splash damage to a nearby enemy hidden behind a side wall', () => {
    const sim = new CombatSimulation([[1.5, -8]]);
    const wall = (p: [number, number]) => p[0] > 0.7 && p[0] < 1 && p[1] < -3;
    sim.castSkill(pose);
    advance(sim, 3, pose, wall);
    expect(sim.slimes[0].hp).toBe(70);
  });
  it('stops at thin walls even with slow frames and cannot damage through them', () => {
    const sim = new CombatSimulation([[0, -10]]);
    const wall = (p: [number, number]) => p[1] < -4 && p[1] > -4.25;
    sim.castSkill(pose);
    for (let i = 0; i < 30; i++) sim.step(0.1, pose, wall);
    expect(sim.slimes[0].hp).toBe(70);
    expect(sim.waves).toHaveLength(0);
  });
  it('misses enemies outside the wave and expires at its maximum range', () => {
    const sim = new CombatSimulation([
      [8, -10],
      [0, -40],
      [0, 5],
    ]);
    sim.castSkill(pose);
    advance(sim, 3);
    expect(sim.slimes.every((s) => s.hp === 70)).toBe(true);
    expect(sim.waves).toHaveLength(0);
  });
  it('enforces cooldown, spirit cost, blocking and defeat and resets all skill state', () => {
    const sim = new CombatSimulation([]);
    expect(sim.castSkill({ ...pose, blocking: true })).toBe(false);
    expect(sim.castSkill(pose)).toBe(true);
    expect(sim.castSkill(pose)).toBe(false);
    advance(sim, 2);
    expect(sim.castSkill(pose)).toBe(false);
    advance(sim, 4);
    sim.player.spirit = 0;
    expect(sim.castSkill(pose)).toBe(false);
    advance(sim, 5);
    expect(sim.castSkill(pose)).toBe(true);
    sim.player.hp = 0;
    sim.step(0.02, pose, open);
    expect(sim.castSkill(pose)).toBe(false);
    expect(sim.waves).toHaveLength(0);
    sim.reset();
    expect(sim.player.spirit).toBe(100);
    expect(sim.chargingAt).toBeNull();
    expect(sim.waves).toHaveLength(0);
    expect(sim.castSkill(pose)).toBe(true);
  });
});
