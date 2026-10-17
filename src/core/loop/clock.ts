import { STEP_MS, type Clock } from '../api';

/** Game clock: time is steps * STEP_MS, so the sim never reads the wall clock. */
export interface GameClock extends Clock {
  advance(): void;
  reset(): void;
}

export function createClock(): GameClock {
  let steps = 0;
  return {
    nowMs: () => steps * STEP_MS,
    step: () => steps,
    advance() {
      steps++;
    },
    reset() {
      steps = 0;
    },
  };
}
