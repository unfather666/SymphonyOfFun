// Dev cheats (core's `dev:cheat` hook, dev builds only): quick ways to reach states without waiting.
import { doFart } from './farts';
import { endRun } from './endings';
import { giveItem, itemIndex } from './items';
import { checkLost } from './reputation';
import { zoneFor } from './verbs';
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
    case 'tp_subject': {
      const s = sim.job ? sim.subjects[sim.job.subjects[0]!]! : null;
      if (s) sim.deps.physics.setPosition(sim.player.h, s.x + 6, s.y);
      return true;
    }
    case 'tp_zone': {
      const step = sim.job ? sim.deps.catalog.types[sim.job.offer.type]!.steps[sim.job.step]! : null;
      const z = sim.job && step ? zoneFor(sim.job, step) : null;
      if (z) sim.deps.physics.setPosition(sim.player.h, z.x, z.y);
      return true;
    }
    case 'coins': sim.progress.coins += 100; return true;
    case 'tasks_500': sim.progress.tasksDone = 500; return true;
    case 'tasks_999': sim.progress.tasksDone = 999; return true;
    default:
      if (id.startsWith('ending_')) return endRun(sim, id.slice(7));
      if (id.startsWith('item_')) return giveItem(sim, itemIndex(sim, id.slice(5)));
      return false;
  }
}
