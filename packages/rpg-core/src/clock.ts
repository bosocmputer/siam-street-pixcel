// The game moves in fixed small steps, so it plays the same on a fast phone and a slow one:
// a frame that took longer simply runs more steps.

export interface FixedClock {
  /** seconds per step */
  readonly step: number;
  /** most steps to run for one frame; a very long pause is dropped rather than replayed */
  readonly maxSteps: number;
  /** time left over from earlier frames, less than one step */
  carry: number;
}

export function newClock(step = 1 / 60, maxSteps = 6): FixedClock {
  return { step, maxSteps, carry: 0 };
}

/** Add one frame's time; returns how many steps to run now. */
export function advance(c: FixedClock, dt: number): number {
  c.carry += Math.max(0, dt);
  let n = Math.floor(c.carry / c.step + 1e-9);
  c.carry -= n * c.step;
  if (n > c.maxSteps) {
    n = c.maxSteps;
    c.carry = 0;
  }
  return n;
}
