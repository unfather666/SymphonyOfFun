// Subjects: the things a job is about (a cat, a goat, later an alligator). A fixed pool; bodies only while on the ground.
import { NO_BODY } from '../physics/PhysicsApi';
import { SS_CARRIED, SS_DONE, SS_FLEE, SS_FOLLOW, SS_IDLE, SS_NONE, SS_TREE } from './jobTypes';
import type { Subject, SubjectDef } from './jobTypes';
import { aimAt } from './trail';
import { TAG_SUBJECT, tagOf } from './types';
import type { Sim } from './sim';

export function createSubjects(n: number): Subject[] {
  const out: Subject[] = [];
  for (let i = 0; i < n; i++)
    out.push({ idx: i, active: false, def: null, x: 0, y: 0, px: 0, py: 0, h: NO_BODY, state: SS_NONE, leash: 0, tugAt: 0, tugX: 0, tugY: 0, tugUntil: 0, leaveAt: 0, aimX: 0, aimY: 0, aimUntil: 0 });
  return out;
}

export function addSubjectBody(sim: Sim, s: Subject): void {
  const d = s.def!;
  s.h = sim.deps.physics.addBody({
    kind: 'subject', shape: 'circle', x: s.x, y: s.y, r: d.r, mass: d.mass, damping: d.damping, lockRotation: true, tag: tagOf(TAG_SUBJECT, s.idx),
  });
}

/** Take a free slot. Full policy: no slot, no spawn (returns null). */
export function spawnSubject(sim: Sim, def: SubjectDef, x: number, y: number, state: number): Subject | null {
  const s = sim.subjects.find((q) => !q.active);
  if (!s) return null;
  s.active = true;
  s.def = def;
  s.x = x; s.y = y; s.px = x; s.py = y;
  s.state = state;
  s.leash = 0;
  s.leaveAt = 0;
  s.tugAt = sim.now + sim.deps.rng.jobs.range(1000, 3000);
  s.tugUntil = 0;
  s.aimUntil = 0;
  s.h = NO_BODY;
  if (state !== SS_TREE) addSubjectBody(sim, s);
  return s;
}

export function detachLeash(sim: Sim, s: Subject): void {
  if (s.leash) sim.deps.physics.removeLeash(s.leash);
  s.leash = 0;
}

export function despawnSubject(sim: Sim, s: Subject): void {
  detachLeash(sim, s);
  if (s.h !== NO_BODY) sim.deps.physics.remove(s.h);
  s.h = NO_BODY;
  s.active = false;
  s.def = null;
  s.state = SS_NONE;
  if (sim.carrying === s.idx) sim.carrying = -1;
}

export function attachLeash(sim: Sim, s: Subject): void {
  if (s.leash || s.h === NO_BODY) return;
  s.leash = sim.deps.physics.addLeash(sim.player.h, s.h, s.def!.leash);
}

export function pickUp(sim: Sim, s: Subject): void {
  detachLeash(sim, s);
  if (s.h !== NO_BODY) sim.deps.physics.remove(s.h);
  s.h = NO_BODY;
  s.state = SS_CARRIED;
  sim.carrying = s.idx;
}

/** Set a carried subject down in front of the player. */
export function putDown(sim: Sim, s: Subject, state: number): void {
  const pl = sim.player;
  const d = sim.deps.rules.jobs.dropDist;
  s.x = pl.x + (pl.facing === 3 ? d : pl.facing === 2 ? -d : 0);
  s.y = pl.y + (pl.facing === 0 ? d : pl.facing === 1 ? -d : 0);
  s.px = s.x; s.py = s.y;
  s.state = state;
  addSubjectBody(sim, s);
  sim.carrying = -1;
  sim.deps.emit('mrfart:subject_dropped', { subject: s.idx });
}

/** Per-step brain: followers keep near the player and tug at random; carried ones ride along; leavers vanish. */
export function stepSubjects(sim: Sim): void {
  const { physics, rng } = sim.deps;
  const pl = sim.player;
  for (let i = 0; i < sim.subjects.length; i++) {
    const s = sim.subjects[i]!;
    if (!s.active) continue;
    s.px = s.x;
    s.py = s.y;
    if (s.leaveAt > 0 && sim.now >= s.leaveAt) {
      despawnSubject(sim, s);
      continue;
    }
    const d = s.def!;
    if (s.state === SS_CARRIED) {
      s.x = pl.x;
      s.y = pl.y - 11;
      continue;
    }
    if (s.state === SS_TREE || s.h === NO_BODY) continue;
    let vx = 0, vy = 0;
    if (s.state === SS_FOLLOW && d.speed > 0) {
      const dist = Math.hypot(pl.x - s.x, pl.y - s.y);
      if (dist > d.followDist) {
        if (sim.now >= s.aimUntil) {
          aimAt(sim, s.x, s.y, d.r);
          s.aimX = sim.aim.x;
          s.aimY = sim.aim.y;
          s.aimUntil = sim.now + sim.deps.rules.jobs.aimMs;
        }
        const dx = s.aimX - s.x, dy = s.aimY - s.y;
        const ad = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, (dist - d.followDist) / 20) * d.speed;
        vx = (dx / ad) * k;
        vy = (dy / ad) * k;
      }
      if (d.tug > 0) {
        if (sim.now >= s.tugAt) {
          const a = rng.jobs.range(0, Math.PI * 2);
          s.tugX = Math.cos(a) * d.tug;
          s.tugY = Math.sin(a) * d.tug;
          s.tugUntil = sim.now + 400;
          s.tugAt = sim.now + rng.jobs.range(1500, 4000);
        }
        if (sim.now < s.tugUntil) {
          vx += s.tugX;
          vy += s.tugY;
        }
      }
    }
    if (s.state === SS_FLEE && d.speed > 0) {
      const dx = s.x - pl.x, dy = s.y - pl.y;
      const dist = Math.hypot(dx, dy);
      if (dist < sim.deps.rules.jobs.fleeRange && dist > 0.01) {
        // Away from the player with a sideways drift that swaps every two seconds, so it slides along walls instead of sticking.
        const side = ((sim.now / 2000) | 0) % 2 === (s.idx & 1) ? 0.7 : -0.7;
        const ax = dx / dist - (dy / dist) * side, ay = dy / dist + (dx / dist) * side;
        const k = (d.speed * sim.deps.rules.jobs.fleeMult) / Math.hypot(ax, ay);
        vx = ax * k;
        vy = ay * k;
      }
    }
    physics.setTargetVelocity(s.h, vx, vy, 0.2);
  }
}

/** The subject slots in a job that are still around and on the ground or carried. */
export function nearestSubject(sim: Sim, slots: readonly number[], x: number, y: number): Subject | null {
  let best: Subject | null = null, bd = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const s = sim.subjects[slots[i]!]!;
    if (!s.active || s.state === SS_CARRIED || s.state === SS_DONE) continue;
    const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export { SS_FOLLOW, SS_IDLE };
