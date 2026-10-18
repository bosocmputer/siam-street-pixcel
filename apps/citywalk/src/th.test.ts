import { describe, expect, it } from 'vitest';
import { CAMERA_MODES, ELEMENTS, ITEMS, MONSTERS, SKILLS } from '@newgame/rpg-core';
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
  it('every name is a non-empty string', () => {
    for (const group of [TH.monsters, TH.items, TH.skills, TH.elements, TH.cameraModes])
      for (const name of Object.values(group)) expect(name.trim().length).toBeGreaterThan(0);
  });
});
