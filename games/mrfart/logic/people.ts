// People: each is data with a tiny state machine (walk to waypoint, dwell, next) driven by game-clock timestamps.
import { NO_BODY } from '../physics/PhysicsApi';
import { TILE } from './map';
import { PS_DWELL, PS_FLEE, PS_STARTLED, PS_WALK, TAG_PERSON, tagOf } from './types';
import type { Person, PersonDef } from './types';
import type { Sim } from './sim';

/** A person from data: a fixed `loop` (tile coords) if given, else a daily route built from home and anchors. */
export function createPerson(idx: number, def: PersonDef, route: number[] = []): Person {
  if (route.length === 0) for (const [tx, ty, dwell] of def.loop ?? []) route.push((tx + 0.5) * TILE, (ty + 0.5) * TILE, dwell);
  if (route.length === 0) route.push(TILE, TILE, 1000);
  return {
    idx, def, x: route[0]!, y: route[1]!, px: route[0]!, py: route[1]!, h: NO_BODY, facing: 0,
    state: PS_WALK, until: 0, wp: route.length > 3 ? 1 : 0, route, pushedAt: -1e9, intol: 0, flees: false,
  };
}

export function spawnPersonBody(sim: Sim, p: Person): void {
  const r = sim.deps.rules.people;
  p.h = sim.deps.physics.addBody({
    kind: 'person', shape: 'circle', x: p.x, y: p.y, r: r.radius, mass: r.mass, damping: r.damping, lockRotation: true, tag: tagOf(TAG_PERSON, p.idx),
  });
}

/** Pass-through points count as reached a little early; stops at doors are spread by person so a crowd does not queue on one pixel. */
const ARRIVE_PASS = 8;
const arriveAt = (idx: number) => 3 + (idx % 6) * 3;
const distSq = (ax: number, ay: number, bx: number, by: number) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

/** Decide where each person heads this step and tell physics (or move the ledger position when there is no body). */
export function stepPeople(sim: Sim): void {
  const { physics, rules } = sim.deps;
  const dt = 1 / 60;
  const lowRep = sim.meters.reputation < rules.reputation.fleeBelow;
  const fleeSee2 = rules.witness.fleeSee * rules.witness.fleeSee;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    let vx = 0, vy = 0;
    if (p.state === PS_STARTLED) {
      if (sim.now >= p.until) {
        p.state = p.flees ? PS_FLEE : PS_WALK;
        p.until = sim.now + rules.witness.fleeMs;
      }
    } else if (p.state === PS_FLEE) {
      const dx = p.x - sim.player.x, dy = p.y - sim.player.y;
      const d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * p.def.speed * rules.witness.fleeMult;
      vy = (dy / d) * p.def.speed * rules.witness.fleeMult;
      p.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0;
      if (sim.now >= p.until) p.state = PS_WALK;
    } else if (lowRep && distSq(p.x, p.y, sim.player.x, sim.player.y) < fleeSee2) {
      p.state = PS_FLEE;
      p.until = sim.now + rules.witness.fleeMs;
      continue;
    } else if (p.state === PS_WALK) {
      const tx = p.route[p.wp * 3]!, ty = p.route[p.wp * 3 + 1]!;
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < (p.route[p.wp * 3 + 2]! === 0 ? ARRIVE_PASS : arriveAt(p.idx))) {
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
