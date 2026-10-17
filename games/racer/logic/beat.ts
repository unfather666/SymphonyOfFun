// The beat clock as the player hears it. Core publishes chip:beat; the sim keeps the last edge.
import type { Sim } from './simtypes';

/** Distance in ms to the nearest beat edge. */
export function beatDistMs(sim: Sim, nowMs: number): number {
  const p = sim.beat.periodMs;
  let d = (nowMs - sim.beat.edgeMs) % p;
  if (d < 0) d += p;
  return Math.min(d, p - d);
}

/** A core beat edge arrived (every 4th 16th step). `step` is the song step. */
export function onBeat(sim: Sim, step: number, nowMs: number): void {
  sim.beat.edgeMs = nowMs + sim.rules.audioLatencyMs;
  sim.beat.index = step >> 2;
}
