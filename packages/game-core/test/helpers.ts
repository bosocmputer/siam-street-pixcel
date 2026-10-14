import {
  absorb,
  createNewPlayer,
  defaultConfig as cfg,
  grantTutorialCores,
  type PlayerState,
} from '../src';

export { cfg };

export function fresh(home = 'wiang', now = 0): PlayerState {
  return createNewPlayer(cfg, home, now);
}

/** A player who has absorbed the first monster's skill (as in the 60-second tutorial). */
export function afterTutorial(): PlayerState {
  const s = grantTutorialCores(fresh(), cfg);
  const r = absorb(s, 'brick_imp', 'all', cfg);
  if (!r.ok) throw new Error('tutorial absorb failed');
  return r.state;
}

/** Give a state plenty of progress without going through claim(). */
export function strong(level = 40): PlayerState {
  const s = fresh();
  s.level = level;
  s.statPoints = 0;
  s.stats = { str: level, agi: level / 2, vit: level, int: level / 2 };
  return s;
}
