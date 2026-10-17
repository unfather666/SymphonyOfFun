// Dev cheats (core's `dev:cheat` hook, dev builds only): quick ways to reach states without waiting.
import { doFart } from './farts';
import { checkLost } from './reputation';
import type { Sim } from './sim';

export function applyCheat(sim: Sim, id: string): boolean {
  const { rules, farts } = sim.deps;
  const m = sim.meters;
  switch (id) {
    case 'fart_full': m.fart = rules.meter.max; return true;
    case 'fart_loud': doFart(sim, farts.length - 1); return true;
    case 'rep_full': m.reputation = rules.reputation.max; return true;
    case 'rep_low': m.reputation = rules.reputation.fleeBelow - 5; return true;
    case 'rep_zero': m.reputation = 0; checkLost(sim); return true;
    case 'stress_max': m.stress = rules.stress.max; return true;
    default: return false;
  }
}
