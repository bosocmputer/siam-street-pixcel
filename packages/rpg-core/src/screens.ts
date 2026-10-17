// Which screen the game is on, and what moves it to the next one.

export type Screen = 'loading' | 'failed' | 'intro' | 'play' | 'paused';
export type ScreenEvent = 'loaded' | 'loadFailed' | 'start' | 'hide' | 'show';

const NEXT: Partial<Record<Screen, Partial<Record<ScreenEvent, Screen>>>> = {
  loading: { loaded: 'intro', loadFailed: 'failed' },
  intro: { start: 'play' },
  // the game stops while the page is hidden (another app, a locked phone) and carries on after
  play: { hide: 'paused' },
  paused: { show: 'play' },
};

/** The screen after `event`; events that do not apply leave it where it is. */
export function nextScreen(now: Screen, event: ScreenEvent): Screen {
  return NEXT[now]?.[event] ?? now;
}

/** Does the world move on this screen? */
export const worldRuns = (s: Screen): boolean => s === 'play';
