// A simple autopilot used by tests ("every level is completable") and the dev ?bot=1 param. Pure.
import { beatDistMs, type Sim } from './sim';
import { segAt, hasSeg } from './track';
import type { DriveInput } from './types';

/** Fill `inp` for this step: hold accelerate, tap on the beat, stay centred, jump ramps that lead into a gap. */
export function botInput(sim: Sim, inp: DriveInput, nowMs: number): void {
  const car = sim.car;
  const idx = Math.floor(car.s / sim.segLen);
  inp.accel = true;
  inp.brake = false;
  inp.usePressed = false;
  inp.accelPressed = beatDistMs(sim, nowMs) < 8.4 && nowMs - sim.beat.edgeMs < sim.beat.periodMs * 0.5;
  const err = -car.lane;
  inp.steer = Math.abs(err) < 0.04 ? 0 : Math.max(-1, Math.min(1, err * 4));
  inp.jumpPressed = false;
  if (hasSeg(sim.track, idx) && hasSeg(sim.track, idx + 1)) {
    const seg = segAt(sim.track, idx);
    if (seg.ramp && segAt(sim.track, idx + 1).gap && !car.airborne) inp.jumpPressed = true;
  }
}
