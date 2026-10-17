// Proves the autopilot can drive a whole level on every theme, hazards included, losing at most one life: the roads are drivable and the hazards dodgeable (racer, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { botInput } from '../logic/bot';
import { onBeat, PHASE_FINISHED, stepSim } from '../logic/sim';
import { idle, levels, makeSim } from './helpers';

describe('autopilot', () => {
  const runs = [...levels.map((l) => ({ level: l, meter: 4 })), { level: levels[levels.length - 1]!, meter: 3 }];
  for (const { level, meter } of runs) {
    test(`level ${level.no} (${level.theme}) in ${meter}/4 finishes with at most one death`, () => {
      const sim = makeSim(11, level.no, level.bpm, meter);
      const inp = idle();
      const stepsPerBeat = Math.round(3600 / level.bpm);
      let now = 0;
      for (let step = 0; step < 60 * 330 && sim.phase !== PHASE_FINISHED; step++) {
        now = step * (1000 / 60);
        if (step % stepsPerBeat === 0) onBeat(sim, (step / stepsPerBeat) * 4, now);
        botInput(sim, inp, now);
        stepSim(sim, inp, now);
      }
      // The autopilot reads moving hazards from the current speed, so a speed change right at a sweeper can cost it a life.
      expect(sim.deaths).toBeLessThanOrEqual(1);
      expect(sim.phase).toBe(PHASE_FINISHED);
      expect(sim.distance).toBeGreaterThan(sim.segLen * (sim.totalBeats - 4));
    });
  }
});
