// Prop bodies: created and removed as the player comes and goes (see stream.ts).
import { TAG_PROP, tagOf } from './types';
import type { Prop } from './types';
import type { Sim } from './sim';

export function spawnPropBody(sim: Sim, p: Prop): void {
  const d = p.def;
  p.h = sim.deps.physics.addBody({
    kind: 'prop', shape: 'box', x: p.x, y: p.y, angle: p.angle, hw: d.w / 2, hh: d.h / 2, mass: d.mass, damping: d.damping, angularDamping: 4, tag: tagOf(TAG_PROP, p.idx),
  });
}
