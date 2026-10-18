import { describe, expect, it } from 'vitest';
import {
  SKILLS,
  readSkills,
  skill,
  skillDamage,
  splashed,
  chooseTarget,
  launch,
  readyCooldowns,
  spent,
  stepShot,
  tickCooldowns,
  useSkill,
  type Vec3,
} from '../src/skills';
import { DEFAULT_SPECIES, monster } from '../src/monsters';
import { damage, hittable, newVitals, stepVitals } from '../src/slimeBrain';

const VITALS = { ...monster(DEFAULT_SPECIES).vitals, hp: monster(DEFAULT_SPECIES).hp };

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('skill shots', () => {
  for (const id of ['fireball', 'waterball'])
    it(`a ${id} flies straight and always reaches its target`, () => {
      const aim: Vec3 = [0, 0.4, 15];
      const shot = launch(skill(id), [0, 1.3, 0], 0, aim, 2);
      // a straight line from the hand down to the target
      expect(shot.dir[0]).toBeCloseTo(0);
      expect(shot.dir[2]).toBeGreaterThan(0.99);
      let closest = Infinity;
      for (let t = 0; t < 3; t += 1 / 60) {
        stepShot(shot, 1 / 60, aim);
        closest = Math.min(closest, dist(shot.pos, aim));
      }
      expect(closest).toBeLessThan(0.3);
    });

  it('flies straight ahead with no target and fades out after its range', () => {
    const shot = launch(skill('fireball'), [0, 1, 0], Math.PI / 2, null, null);
    expect(shot.dir[0]).toBeCloseTo(1);
    for (let i = 0; i < 400 && !spent(shot); i++) stepShot(shot, 1 / 30, null);
    expect(spent(shot)).toBe(true);
    expect(shot.pos[2]).toBeCloseTo(0);
    expect(shot.pos[0]).toBeGreaterThan(skill('fireball').range);
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

  it('a burst catches the other slimes close by, not the one hit or those far away', () => {
    const slimes = [
      { x: 0, z: 0, alive: true }, // hit directly
      { x: 2, z: 0, alive: true },
      { x: 0, z: -2.5, alive: false }, // already melting
      { x: 4, z: 0, alive: true },
    ];
    expect(splashed([0, 0.4, 0], slimes, 2.8, 0)).toEqual([1]);
    expect(splashed([0, 0.06, 0], slimes, 2.8, null)).toEqual([0, 1]);
  });

  it('gathers water faster than fire, and water flies faster', () => {
    const fire = skill('fireball'),
      water = skill('waterball');
    expect(water.charge).toBeLessThan(fire.charge);
    expect(water.speed).toBeGreaterThan(fire.speed * 2);
    expect(water.cost).toBeLessThan(fire.cost);
    expect(fire.element).toBe('fire');
    expect(Object.keys(SKILLS)).toEqual(['fireball', 'waterball']);
  });

  it('waits for the cooldown between uses', () => {
    const cd = readyCooldowns();
    expect(useSkill(cd, 'fireball')).toBe(true);
    expect(useSkill(cd, 'fireball')).toBe(false);
    expect(useSkill(cd, 'waterball')).toBe(true); // each skill has its own
    tickCooldowns(cd, skill('fireball').cooldown + 0.01);
    expect(useSkill(cd, 'fireball')).toBe(true);
  });

  it('a new skill is only a new entry in the config', () => {
    const raw = {
      autoRange: 30,
      hitRadius: 0.6,
      skills: { spark: { ...skillsEntry(), element: 'fire' } },
    };
    const read = readSkills(raw);
    expect(read.skills.spark!.id).toBe('spark');
    expect(() =>
      readSkills({ ...raw, skills: { x: { ...skillsEntry(), element: 'wind' } } }),
    ).toThrow(/skills.x.element/);
    expect(() => readSkills({ ...raw, skills: {} })).toThrow(/no skills/);
    expect(() => skill('nope')).toThrow(/unknown skill/);
  });

  it('hits harder with each level and by how much of the element the monster takes', () => {
    expect(skillDamage(40, 1, 0.08)).toBe(40);
    expect(skillDamage(40, 6, 0.08)).toBe(56);
    expect(skillDamage(40, 1, 0.08, 1.5)).toBe(60);
    expect(skillDamage(40, 0, 0.08)).toBe(40);
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

function skillsEntry() {
  return {
    cost: 5,
    damage: 10,
    speed: 20,
    cooldown: 0.5,
    range: 20,
    side: 0,
    lift: 0,
    knock: 0.5,
    charge: 0.2,
    splash: null,
  };
}
