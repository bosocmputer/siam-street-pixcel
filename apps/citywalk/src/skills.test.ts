import { describe, expect, it } from 'vitest';
import {
  SKILLS,
  chooseTarget,
  launch,
  readyCooldowns,
  spent,
  stepShot,
  tickCooldowns,
  useSkill,
  type Vec3,
} from './skills';
import { VITALS, damage, hittable, newVitals, stepVitals } from './slimeBrain';

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('skill shots', () => {
  for (const element of ['fire', 'water'] as const)
    it(`a ${element} shot swings out, then always reaches its target`, () => {
      const aim: Vec3 = [0, 0.4, 15];
      const shot = launch(element, [0, 1.3, 0], 0, aim, 2);
      // it leaves to one side and upwards, not straight at the target
      expect(Math.sign(shot.dir[0])).toBe(element === 'fire' ? -1 : 1);
      expect(shot.dir[1]).toBeGreaterThan(0);
      let closest = Infinity;
      for (let t = 0; t < 3; t += 1 / 60) {
        stepShot(shot, 1 / 60, aim);
        closest = Math.min(closest, dist(shot.pos, aim));
      }
      expect(closest).toBeLessThan(0.3);
    });

  it('flies straight ahead with no target and fades out after its range', () => {
    const shot = launch('fire', [0, 1, 0], Math.PI / 2, null, null);
    expect(shot.dir[0]).toBeCloseTo(1);
    for (let i = 0; i < 400 && !spent(shot); i++) stepShot(shot, 1 / 30, null);
    expect(spent(shot)).toBe(true);
    expect(shot.pos[2]).toBeCloseTo(0);
    expect(shot.pos[0]).toBeGreaterThan(SKILLS.fire.range);
  });

  it('picks the nearest slime in front before a nearer one behind', () => {
    const slimes = [
      { x: 0, z: -3, alive: true }, // behind, 3 m
      { x: 0, z: 5, alive: true }, // ahead, 5 m
      { x: 0, z: 2, alive: false }, // ahead but melting
      { x: 0, z: 50, alive: true }, // too far
    ];
    expect(chooseTarget({ x: 0, z: 0, heading: 0 }, slimes)).toBe(1);
    expect(chooseTarget({ x: 0, z: 0, heading: Math.PI }, slimes)).toBe(0);
    expect(chooseTarget({ x: 0, z: 0, heading: 0 }, [slimes[3]!])).toBeNull();
  });

  it('waits for the cooldown between uses', () => {
    const cd = readyCooldowns();
    expect(useSkill(cd, 'fire')).toBe(true);
    expect(useSkill(cd, 'fire')).toBe(false);
    expect(useSkill(cd, 'water')).toBe(true); // each skill has its own
    tickCooldowns(cd, SKILLS.fire.cooldown + 0.01);
    expect(useSkill(cd, 'fire')).toBe(true);
  });
});

describe('slime health', () => {
  it('flinches when hit, melts when out of hit points, and grows back later', () => {
    const v = newVitals();
    expect(damage(v, 30)).toBe('hurt');
    expect(v.hp).toBe(VITALS.hp - 30);
    expect(stepVitals(v, VITALS.hurt + 0.01)).toBe('alive');
    expect(damage(v, 500)).toBe('defeated');
    expect(v.hp).toBe(0);
    expect(hittable(v)).toBe(false);
    expect(damage(v, 10)).toBe('ignored');
    expect(stepVitals(v, VITALS.melt + 0.01)).toBe('gone');
    expect(stepVitals(v, VITALS.respawn / 2)).toBeNull();
    expect(stepVitals(v, VITALS.respawn / 2 + 0.01)).toBe('growing');
    expect(v.hp).toBe(VITALS.hp);
    expect(hittable(v)).toBe(false);
    expect(stepVitals(v, VITALS.grow + 0.01)).toBe('alive');
    expect(hittable(v)).toBe(true);
  });
});
