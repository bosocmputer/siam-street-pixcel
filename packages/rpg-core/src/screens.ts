// Which screen the game is on, and what moves it to the next one.

export type Screen = 'loading' | 'failed' | 'intro' | 'create' | 'play' | 'menu' | 'paused';
export type ScreenEvent =
  | 'loaded'
  | 'loadFailed'
  | 'create'
  | 'start'
  | 'menu'
  | 'close'
  | 'hide'
  | 'show';

const NEXT: Partial<Record<Screen, Partial<Record<ScreenEvent, Screen>>>> = {
  loading: { loaded: 'intro', loadFailed: 'failed' },
  // a new game makes the character first
  intro: { start: 'play', create: 'create' },
  create: { start: 'play' },
  // the game stops while the page is hidden (another app, a locked phone) and carries on after
  play: { hide: 'paused', menu: 'menu' },
  // a window over the game (the status window) stops the world until it closes
  menu: { close: 'play' },
  paused: { show: 'play' },
};

/** The screen after `event`; events that do not apply leave it where it is. */
export function nextScreen(now: Screen, event: ScreenEvent): Screen {
  return NEXT[now]?.[event] ?? now;
}

/** Does the world move on this screen? */
export const worldRuns = (s: Screen): boolean => s === 'play';
