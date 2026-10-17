import { MAX_STEPS_PER_FRAME, STEP_MS } from '../api';

/**
 * Fixed 60 Hz accumulator. frame(dtMs) says how many steps to run this frame and the
 * interpolation alpha. More than MAX_STEPS_PER_FRAME of backlog is dropped (the game
 * slows down instead of spiralling).
 */
export interface FixedLoop {
  frame(dtMs: number): { steps: number; alpha: number; dropped: number };
  reset(): void;
}

export function createFixedLoop(stepMs = STEP_MS, maxSteps = MAX_STEPS_PER_FRAME): FixedLoop {
  let acc = 0;
  const out = { steps: 0, alpha: 0, dropped: 0 };
  return {
    frame(dtMs) {
      acc += dtMs > 0 && Number.isFinite(dtMs) ? dtMs : 0;
      let steps = Math.floor(acc / stepMs);
      let dropped = 0;
      if (steps > maxSteps) {
        dropped = steps - maxSteps;
        steps = maxSteps;
        acc = acc % stepMs;
      } else {
        acc -= steps * stepMs;
      }
      out.steps = steps;
      out.alpha = acc / stepMs;
      out.dropped = dropped;
      return out;
    },
    reset() {
      acc = 0;
    },
  };
}
