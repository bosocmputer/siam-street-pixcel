import { describe, expect, it } from 'vitest';
import {
  APPEARANCE,
  ATTRS,
  CAMERA_MODES,
  COMBOS,
  QUESTS,
  ELEMENTS,
  ITEMS,
  JOB_IDS,
  LOOK_PARTS,
  MONSTERS,
  SKILLS,
  SOUNDS,
  choices,
  type ChatEvent,
} from '@newgame/rpg-core';
import { SOUND_GROUPS } from './audio/groups';
import { TH } from './th';

// Every kind of thing the game data can name must have a Thai name for the player, and no name
// may be left over for something that no longer exists.
describe('Thai names cover the game data', () => {
  const same = (names: Record<string, unknown>, ids: string[]) =>
    expect(Object.keys(names).sort()).toEqual([...ids].sort());

  it('monsters', () => same(TH.monsters, Object.keys(MONSTERS)));
  it('items', () => same(TH.items, Object.keys(ITEMS)));
  it('skills', () => same(TH.skills, Object.keys(SKILLS)));
  it('combos', () => same(TH.combos, [...COMBOS]));
  it('quests: a name and words for every step, and the lines every talk needs', () => {
    same(TH.quests, Object.keys(QUESTS.quests));
    same(TH.npcs, Object.keys(QUESTS.npcs));
    for (const q of Object.values(QUESTS.quests)) {
      expect(TH.quests[q.id]!.steps).toHaveLength(q.steps.length);
      if (q.reward.learn) expect(TH.learned[q.reward.learn]).toBeTruthy();
      for (const s of q.steps) {
        if (s.do !== 'talk') continue;
        const pages = TH.story[s.npc]?.[s.line];
        expect(pages, `${s.npc}.${s.line}`).toBeTruthy();
        for (const p of pages!) {
          expect(p.trim().length).toBeGreaterThan(0);
          // short enough for the box on the smallest phone
          expect([...p].length).toBeLessThanOrEqual(90);
        }
      }
    }
  });
  it('elements', () => same(TH.elements, ELEMENTS));
  it('camera views', () => same(TH.cameraModes, CAMERA_MODES));
  it('sounds', () => same(TH.sounds, Object.keys(SOUNDS)));
  it('sound groups', () =>
    same(
      TH.soundGroups,
      SOUND_GROUPS.map((g) => g.key),
    ));
  it('attributes and jobs', () => {
    same(TH.attrs, [...ATTRS]);
    same(TH.jobs, JOB_IDS);
    same(TH.jobRoles, JOB_IDS);
  });
  it('every choice on the character screen', () => {
    for (const p of LOOK_PARTS) same(TH.create.names[p]!, choices(p));
    same(TH.create.parts, [...LOOK_PARTS]);
    same(TH.create.bodies, APPEARANCE.bodies);
  });
  it('every monster has short lines for what happens to it', () => {
    same(TH.chatter, Object.keys(MONSTERS));
    for (const [id, lines] of Object.entries(TH.chatter)) {
      const needed: ChatEvent[] = ['idle', 'notice', 'attack', 'hurt', 'defeated', 'respawn'];
      // a boss also speaks as it starts its special moves
      const sp = MONSTERS[id]!.specials;
      if (sp.charge) needed.push('charge');
      if (sp.slam) needed.push('slam');
      same(lines, needed);
      for (const list of Object.values(lines))
        for (const line of list) {
          expect(line.trim().length).toBeGreaterThan(0);
          expect([...line].length).toBeLessThanOrEqual(22);
        }
    }
  });
  it('every sound is on the listening page exactly once', () => {
    const listed = SOUND_GROUPS.flatMap((g) => g.ids);
    expect([...listed].sort()).toEqual(Object.keys(SOUNDS).sort());
  });
  it('every name is a non-empty string', () => {
    for (const group of [
      TH.monsters,
      TH.items,
      TH.skills,
      TH.elements,
      TH.cameraModes,
      TH.sounds,
      TH.soundGroups,
      TH.attrs,
      TH.jobs,
      TH.jobRoles,
      ...Object.values(TH.create.names),
    ])
      for (const name of Object.values(group)) expect(name.trim().length).toBeGreaterThan(0);
  });
});
