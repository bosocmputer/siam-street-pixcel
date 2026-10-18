// How the sounds are grouped on the listening page. Every sound is in exactly one group.

export const SOUND_GROUPS: { key: string; ids: string[] }[] = [
  { key: 'ui', ids: ['ui.click', 'ui.deny'] },
  { key: 'fire', ids: ['fire.gather', 'fire.release', 'fire.flight', 'fire.impact'] },
  { key: 'water', ids: ['water.gather', 'water.release', 'water.impact'] },
  { key: 'hit', ids: ['hit.weak', 'hit.resist'] },
  {
    key: 'slime',
    ids: ['slime.hop', 'slime.watch', 'slime.attack', 'slime.hurt', 'slime.melt', 'slime.respawn'],
  },
  {
    key: 'player',
    ids: [
      'player.hurt',
      'player.down',
      'player.up',
      'player.levelup',
      'step.walk',
      'step.run',
      'step.bike',
    ],
  },
  { key: 'item', ids: ['item.drop', 'item.pickup'] },
];
