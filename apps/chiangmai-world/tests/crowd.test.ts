import { describe, expect, it } from 'vitest';
import { CombatSimulation } from '../src/combat';
import { CrowdSimulation } from '../src/crowd';

const open = () => false;
const origin: [number, number] = [0, 0];
function run(crowd: CrowdSimulation, seconds: number): void {
  for (let i = 0; i < seconds * 50; i++) crowd.step(0.02, open);
}

describe('shared farming crowd', () => {
  it('spawns exactly ten distinct swordsmen sharing one enemy population', () => {
    const crowd = new CrowdSimulation(origin, (p) => p);
    crowd.configure(10);
    expect(crowd.bots).toHaveLength(10);
    expect(new Set(crowd.bots.map((b) => b.position.join(','))).size).toBe(10);
    expect(crowd.world.slimes).toHaveLength(30);
    expect(crowd.bots.every((b) => b.combat.slimes === crowd.world.slimes)).toBe(true);
  });
  it('actually farms, earns XP and casts skills without duplicate enemy rewards', () => {
    const crowd = new CrowdSimulation(origin, (p) => p);
    crowd.configure(10);
    run(crowd, 30);
    expect(crowd.totals.kills).toBeGreaterThan(30);
    expect(crowd.totals.swings).toBeGreaterThan(20);
    expect(crowd.totals.casts).toBeGreaterThan(5);
    const credited = crowd.bots.reduce((sum, b) => sum + b.lifetimeKills, 0);
    expect(credited).toBe(crowd.totals.kills);
  });
  it('updates enemy AI once per world tick and attacks the nearest living swordsman', () => {
    const world = new CombatSimulation([[0, -1.2]]);
    const near = new CombatSimulation([]),
      far = new CombatSimulation([]);
    for (let i = 0; i < 45; i++)
      world.step(0.02, { position: [99, 99], yaw: 0, pitch: 0, blocking: false }, open, {
        targets: [
          { simulation: near, pose: { position: origin, yaw: 0, pitch: 0, blocking: false } },
          { simulation: far, pose: { position: [20, 20], yaw: 0, pitch: 0, blocking: false } },
        ],
      });
    expect(near.player.hp).toBe(88);
    expect(far.player.hp).toBe(100);
    expect(world.player.hp).toBe(100);
    expect(world.time).toBeCloseTo(0.9);
  });
  it('keeps fighters out of obstacles and restarts a clean, repeatable baseline', () => {
    const crowd = new CrowdSimulation(origin, (p) => p);
    const wall = (p: [number, number]) => p[0] > -0.3 && p[0] < 0.3;
    crowd.configure(10);
    const initial = crowd.bots.map((b) => [...b.position]);
    for (let i = 0; i < 300; i++) {
      crowd.step(0.02, wall);
      expect(crowd.bots.every((b) => !wall(b.position))).toBe(true);
    }
    crowd.configure(1);
    expect(crowd.bots).toHaveLength(1);
    expect(crowd.totals.kills).toBe(0);
    expect(crowd.bots[0].position).toEqual(initial[0]);
    expect(crowd.world.slimes.every((s) => s.hp === 70)).toBe(true);
  });
});
