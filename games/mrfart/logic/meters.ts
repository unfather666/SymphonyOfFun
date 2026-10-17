// Fart meter: fills by distance walked, empties as farts. Random farts roll on a timer; at max one always fires.
import { doFart, kindForMeter } from './farts';
import type { Sim } from './sim';
import type { SimInput } from './types';

export function scheduleRoll(sim: Sim): void {
  const m = sim.deps.rules.meter;
  sim.meters.nextRollAt = sim.now + sim.deps.rng.fart.range(m.randomMinMs, m.randomMaxMs);
}

/** Distance-based fill for one step (pure; exported for tests). */
export function walkFill(movedPx: number, running: boolean, perPx: number, runMult: number): number {
  return movedPx * perPx * (running ? runMult : 1);
}

export function stepMeters(sim: Sim, input: SimInput): void {
  const { rules, farts, rng } = sim.deps;
  const m = sim.meters;
  m.fart = Math.min(rules.meter.max, m.fart + walkFill(sim.player.moved, input.run, rules.meter.perPx, rules.meter.runMult));
  const ready = sim.now - m.lastFartAt >= rules.fart.cooldownMs;
  if (m.fart >= rules.meter.max) {
    if (ready) doFart(sim, kindForMeter(farts, m.fart));
    return;
  }
  if (sim.now >= m.nextRollAt) {
    scheduleRoll(sim);
    if (ready && rng.fart.chance(m.fart / rules.meter.randomDiv)) doFart(sim, kindForMeter(farts, m.fart));
  }
}
