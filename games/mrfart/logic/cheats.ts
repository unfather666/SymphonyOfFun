// Dev cheats (core's `dev:cheat` hook, dev builds only): quick ways to reach states without waiting.
import { doFart } from './farts';
import { endRun } from './endings';
import { giveItem, itemIndex } from './items';
import { checkLost } from './reputation';
import { NO_BODY } from '../physics/PhysicsApi';
import { spawnPiece } from './pools';
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
    case 'load_test': {
      // Budget scene: fill the body cap with boxes around the player, fill the piece pool, then blast them about.
      const { physics } = sim.deps;
      const pl = sim.player;
      for (let k = 0; physics.stats().bodies < rules.caps.bodies && k < 400; k++) {
        const h = physics.addBody({ kind: 'prop', shape: 'box', x: pl.x + ((k % 16) - 8) * 12, y: pl.y + (Math.floor(k / 16) - 6) * 12, hw: 4, hh: 4, mass: 1, damping: 1, tag: 0 });
        if (h === NO_BODY) break;
      }
      for (let k = 0; k < rules.caps.pieces; k++) spawnPiece(sim.pieces, pl.x + (k % 16) * 6 - 48, pl.y + Math.floor(k / 16) * 6 - 48, (k % 7) * 20 - 60, (k % 5) * 20 - 40, 3, 4 + (k % 20), sim.now + 3600000);
      physics.impulseRadial(pl.x, pl.y, 400, 400, 0, pl.h);
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
