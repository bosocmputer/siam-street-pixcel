import { describe, expect, it } from 'vitest';
import { CAMERA_MODES, ELEMENTS, ITEMS, MONSTERS, SKILLS, SOUNDS } from '@newgame/rpg-core';
import { SOUND_GROUPS } from './audio/groups';
import { TH } from './th';

// Every kind of thing the game data can name must have a Thai name for the player, and no name
// may be left over for something that no longer exists.
describe('Thai names cover the game data', () => {
  const same = (names: Record<string, string>, ids: string[]) =>
    expect(Object.keys(names).sort()).toEqual([...ids].sort());

  it('monsters', () => same(TH.monsters, Object.keys(MONSTERS)));
  it('items', () => same(TH.items, Object.keys(ITEMS)));
  it('skills', () => same(TH.skills, Object.keys(SKILLS)));
  it('elements', () => same(TH.elements, ELEMENTS));
  it('camera views', () => same(TH.cameraModes, CAMERA_MODES));
  it('sounds', () => same(TH.sounds, Object.keys(SOUNDS)));
  it('sound groups', () =>
    same(
      TH.soundGroups,
      SOUND_GROUPS.map((g) => g.key),
    ));
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
    ])
      for (const name of Object.values(group)) expect(name.trim().length).toBeGreaterThan(0);
  });
});
