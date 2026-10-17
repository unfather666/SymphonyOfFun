// People: each is data with a tiny state machine (walk to waypoint, dwell, next) driven by game-clock timestamps.
import { NO_BODY } from '../physics/PhysicsApi';
import { TILE } from './map';
import { PS_DWELL, PS_WALK, TAG_PERSON, tagOf } from './types';
import type { Person, PersonDef } from './types';
import type { Sim } from './sim';

export function createPerson(idx: number, def: PersonDef): Person {
  const route: number[] = [];
  for (const [tx, ty, dwell] of def.loop ?? []) route.push((tx + 0.5) * TILE, (ty + 0.5) * TILE, dwell);
  if (route.length === 0) route.push(TILE, TILE, 1000);
  return {
    idx, def, x: route[0]!, y: route[1]!, px: route[0]!, py: route[1]!, h: NO_BODY, facing: 0,
    state: PS_WALK, until: 0, wp: route.length > 3 ? 1 : 0, route, pushedAt: -1e9,
  };
}

export function spawnPersonBody(sim: Sim, p: Person): void {
  const r = sim.deps.rules.people;
  p.h = sim.deps.physics.addBody({
    kind: 'person', shape: 'circle', x: p.x, y: p.y, r: r.radius, mass: r.mass, damping: r.damping, lockRotation: true, tag: tagOf(TAG_PERSON, p.idx),
  });
}

const ARRIVE = 3;

/** Decide where each person heads this step and tell physics (or move the ledger position when there is no body). */
export function stepPeople(sim: Sim): void {
  const { physics, rules } = sim.deps;
  const dt = 1 / 60;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    let vx = 0, vy = 0;
    if (p.state === PS_WALK) {
      const tx = p.route[p.wp * 3]!, ty = p.route[p.wp * 3 + 1]!;
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < ARRIVE) {
        p.state = PS_DWELL;
        p.until = sim.now + p.route[p.wp * 3 + 2]!;
      } else {
        vx = (dx / d) * p.def.speed;
        vy = (dy / d) * p.def.speed;
        p.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0;
      }
    } else if (sim.now >= p.until) {
      p.wp = (p.wp + 1) % (p.route.length / 3);
      p.state = PS_WALK;
    }
    if (p.h !== NO_BODY) physics.setTargetVelocity(p.h, vx, vy, rules.people.gain);
    else {
      p.x += vx * dt;
      p.y += vy * dt;
    }
  }
}
