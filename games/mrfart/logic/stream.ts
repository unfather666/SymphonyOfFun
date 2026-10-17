// Bodies only near the player. Everyone and everything else exists as ledger data (position, state) and costs no physics.
import { NO_BODY } from '../physics/PhysicsApi';
import { spawnPersonBody } from './people';
import { spawnPropBody } from './props';
import type { Sim } from './sim';

/** Every `stream.every` steps (or when forced): drop bodies far away, give bodies to things that came near. */
export function streamBodies(sim: Sim, force: boolean): void {
  const { rules, physics } = sim.deps;
  if (!force && sim.steps % rules.stream.every !== 0) return;
  const near2 = rules.stream.near * rules.stream.near, far2 = rules.stream.far * rules.stream.far;
  const px = sim.player.x, py = sim.player.y;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    const d2 = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
    if (p.h !== NO_BODY && d2 > far2) {
      physics.remove(p.h);
      p.h = NO_BODY;
    } else if (p.h === NO_BODY && d2 < near2) spawnPersonBody(sim, p);
  }
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.broken) continue;
    const d2 = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
    if (p.h !== NO_BODY && d2 > far2) {
      physics.remove(p.h);
      p.h = NO_BODY;
    } else if (p.h === NO_BODY && d2 < near2) spawnPropBody(sim, p);
  }
}
