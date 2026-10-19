import { describe, expect, it } from 'vitest';
import {
  QUESTS,
  current,
  goalOf,
  newQuestLog,
  questEvent,
  readQuests,
  stepCount,
  validQuestLog,
} from '../src/quests';
import { ConfigError } from '../src/config';
import questsJson from '../config/quests.json';

type Cfg = typeof questsJson & Record<string, unknown>;
const copy = () => structuredClone(questsJson) as Cfg;

describe('story quests', () => {
  it('reads quests 1 to 4 in order, with Pa Saeng at her stall', () => {
    expect(QUESTS.first).toBe('wake');
    const order: string[] = [];
    for (let id: string | null = QUESTS.first; id; id = QUESTS.quests[id]!.next) order.push(id);
    expect(order).toEqual(['wake', 'pa_saeng', 'street', 'dodge']);
    expect(QUESTS.npcs.pa_saeng!.look.body).toBe('f');
    expect(QUESTS.npcs.pa_saeng!.look.name).toBe('');
  });

  it('plays through: walk there, talk, beat a water slime, talk, then five of anything, then dodge', () => {
    const log = newQuestLog();
    expect(goalOf(log)).toEqual(QUESTS.places.pa_saeng);
    // the wrong place or thing does nothing
    expect(questEvent(log, { kind: 'reach', place: 'nowhere' })).toEqual({
      stepped: false,
      finished: null,
    });
    expect(questEvent(log, { kind: 'dodge' }).stepped).toBe(false);
    const wake = questEvent(log, { kind: 'reach', place: 'pa_saeng' });
    expect(wake.finished?.id).toBe('wake');
    expect(log).toMatchObject({ id: 'pa_saeng', step: 0, done: ['wake'] });
    // talking leads to Pa Saeng; beating something leads nowhere in particular
    expect(goalOf(log)).toEqual(QUESTS.places.pa_saeng);
    expect(questEvent(log, { kind: 'talk', npc: 'pa_saeng' })).toEqual({
      stepped: true,
      finished: null,
    });
    expect(goalOf(log)).toBeNull();
    expect(stepCount(log)).toEqual([0, 1]);
    // a fire slime is not the water slime she asked for
    expect(questEvent(log, { kind: 'defeat', species: 'slime_fire' }).stepped).toBe(false);
    expect(questEvent(log, { kind: 'defeat', species: 'slime_water' }).stepped).toBe(true);
    const thanks = questEvent(log, { kind: 'talk', npc: 'pa_saeng' });
    expect(thanks.finished?.reward).toEqual({ exp: 40, learn: 'strike' });
    // five of anything
    for (let i = 0; i < 4; i++)
      expect(questEvent(log, { kind: 'defeat', species: 'slime_mini' }).stepped).toBe(false);
    expect(stepCount(log)).toEqual([4, 5]);
    expect(questEvent(log, { kind: 'defeat', species: 'slime_fire' }).finished?.id).toBe('street');
    // three dodges, and that is all for now
    questEvent(log, { kind: 'dodge' });
    questEvent(log, { kind: 'dodge' });
    expect(questEvent(log, { kind: 'dodge' }).finished?.id).toBe('dodge');
    expect(log.id).toBeNull();
    expect(current(log)).toBeNull();
    expect(goalOf(log)).toBeNull();
    expect(stepCount(log)).toEqual([0, 0]);
    expect(questEvent(log, { kind: 'dodge' }).stepped).toBe(false);
    expect(log.done).toEqual(['wake', 'pa_saeng', 'street', 'dodge']);
  });

  it('reads a saved log back only if it still fits', () => {
    const good = { id: 'street', step: 0, count: 3, done: ['wake', 'pa_saeng'] };
    expect(validQuestLog(good)).toEqual(good);
    expect(validQuestLog({ ...good, id: null })).toMatchObject({ id: null });
    for (const bad of [
      null,
      [],
      { ...good, id: 'gone' },
      { ...good, step: 4 },
      { ...good, step: -1 },
      { ...good, step: 0.5 },
      { ...good, count: -2 },
      { ...good, done: ['gone'] },
      { ...good, done: 'wake' },
    ])
      expect(validQuestLog(bad)).toBeNull();
  });

  it('refuses mistakes, naming the place', () => {
    const bad = (change: (c: Cfg) => void) => {
      const c = copy();
      change(c);
      return () => readQuests(c);
    };
    const q = (c: Cfg) => c.quests as Record<string, Record<string, unknown>>;
    const steps = (c: Cfg, id: string) => q(c)[id]!.steps as Record<string, unknown>[];
    expect(bad((c) => (c.places = { pa_saeng: [1] } as never))).toThrow(/places.pa_saeng/);
    expect(bad((c) => (c.npcs.pa_saeng.place = 'moon'))).toThrow(/no place called moon/);
    expect(bad((c) => (c.npcs.pa_saeng.look.hair = 'mohawk'))).toThrow(/look/);
    expect(bad((c) => (q(c).wake!.steps = []))).toThrow(/list of steps/);
    expect(bad((c) => (steps(c, 'wake')[0]!.place = 'moon'))).toThrow(/no place called moon/);
    expect(bad((c) => (steps(c, 'wake')[0]!.do = 'fly'))).toThrow(/expected one of/);
    expect(bad((c) => (steps(c, 'pa_saeng')[0]!.npc = 'ghost'))).toThrow(/no npc called/);
    expect(bad((c) => (steps(c, 'pa_saeng')[0]!.line = ''))).toThrow(/line/);
    expect(bad((c) => (steps(c, 'pa_saeng')[1]!.species = 'dragon'))).toThrow(/no monster/);
    expect(bad((c) => (steps(c, 'street')[0]!.count = 1.5))).toThrow(/whole number/);
    expect(bad((c) => (steps(c, 'dodge')[0]!.count = 0))).toThrow(/count/);
    expect(bad((c) => (q(c).wake!.next = 'nope'))).toThrow(/no quest called nope/);
    expect(bad((c) => (q(c).wake!.reward = { exp: -1, learn: null }))).toThrow(/exp/);
    expect(bad((c) => (c.first = 'nope'))).toThrow(/quests.first/);
    expect(() => readQuests(null)).toThrow(ConfigError);
  });
});
