// Verbs: the motions a step is made of. Each is a tiny state machine (enter / update / exit) that knows subjects and zones, never the job.
import { NO_BODY } from '../physics/PhysicsApi';
import { SS_CARRIED, SS_DONE, SS_FOLLOW, SS_IDLE, SS_TREE } from './jobTypes';
import type { Job, StepDef, Zone } from './jobTypes';
import { attachLeash, addSubjectBody, detachLeash, nearestSubject, pickUp, putDown } from './subjects';
import { inZone } from './zones';
import type { Sim } from './sim';

export const PR_NONE = 0, PR_GRAB = 1, PR_PLACE = 2, PR_TALK = 3, PR_BOARD = 4, PR_TREE = 5, PR_HAND = 6, PR_WORK = 7, PR_SHOP = 8;
export const PROMPT_KEYS = ['', 'prompt_grab', 'prompt_place', 'prompt_press', 'prompt_board', 'prompt_tree', 'prompt_hand', 'prompt_work', 'prompt_shop'];
const STILL_PX = 0.05;

export interface VerbCtx {
  sim: Sim;
  job: Job;
  step: StepDef;
  /** interact was pressed this step. */
  press: boolean;
  /** A is held down. */
  held: boolean;
}
export interface Verb {
  enter(c: VerbCtx): void;
  /** True when the step is finished. */
  update(c: VerbCtx): boolean;
  exit(c: VerbCtx): void;
  /** Which A-button prompt to show right now. */
  prompt(c: VerbCtx): number;
}

export function zoneFor(job: Job, step: StepDef): Zone | null {
  if (step.zone === 'place') return job.place;
  if (step.zone === 'origin') return job.origin;
  if (step.zone === 'tree') return job.tree;
  return null;
}

const near = (c: VerbCtx) => {
  const pl = c.sim.player;
  return nearestSubject(c.sim, c.job.subjects, pl.x, pl.y);
};
const reach = (c: VerbCtx) => {
  const s = near(c);
  if (!s) return null;
  const r = c.sim.deps.rules.jobs.reach + s.def!.r;
  const pl = c.sim.player;
  return (s.x - pl.x) * (s.x - pl.x) + (s.y - pl.y) * (s.y - pl.y) <= r * r ? s : null;
};
const carried = (c: VerbCtx) => (c.sim.carrying >= 0 && c.job.subjects.includes(c.sim.carrying) ? c.sim.subjects[c.sim.carrying]! : null);
const inStepZone = (c: VerbCtx) => {
  const z = zoneFor(c.job, c.step);
  return !!z && inZone(z, c.sim.player.x, c.sim.player.y);
};
/** Pick the subject up again after a loud fart made the player drop it. */
const regrab = (c: VerbCtx): boolean => {
  if (!c.press || c.sim.carrying >= 0) return false;
  const s = reach(c);
  if (!s || s.def!.carryMult === 0) return false;
  pickUp(c.sim, s);
  return true;
};
/** Is the player at the thing this step is about: next to a subject, or inside the zone? */
const atWork = (c: VerbCtx) => (c.step.zone === 'subject' ? reach(c) !== null : inStepZone(c));

export const VERBS: Record<string, Verb> = {
  /** Talk to a subject, shake the tree, or hand the carried subject over in a zone. */
  press: {
    enter() {},
    update(c) {
      if (!c.press) return false;
      if (c.step.zone === 'subject') return reach(c) !== null;
      if (!inStepZone(c)) return false;
      if (c.step.zone === 'tree') {
        for (const i of c.job.subjects) {
          const s = c.sim.subjects[i]!;
          if (s.state !== SS_TREE) continue;
          s.x = c.job.tree.x;
          s.y = c.job.tree.y;
          s.px = s.x; s.py = s.y;
          s.state = SS_FOLLOW;
          addSubjectBody(c.sim, s);
        }
        return true;
      }
      const s = carried(c);
      if (s) {
        putDown(c.sim, s, SS_DONE);
        s.leaveAt = c.sim.now + c.sim.deps.rules.jobs.despawnMs;
      }
      return true;
    },
    exit() {},
    prompt(c) {
      if (c.step.zone === 'subject') return reach(c) ? PR_TALK : PR_NONE;
      if (!inStepZone(c)) return PR_NONE;
      return c.step.zone === 'tree' ? PR_TREE : carried(c) ? PR_HAND : PR_WORK;
    },
  },
  grab: {
    enter() {},
    update(c) {
      if (!c.press || c.sim.carrying >= 0) return false;
      const s = reach(c);
      if (!s || s.def!.carryMult === 0) return false;
      pickUp(c.sim, s);
      return true;
    },
    exit() {},
    prompt(c) {
      const s = c.sim.carrying < 0 ? reach(c) : null;
      return s && s.def!.carryMult > 0 ? PR_GRAB : PR_NONE;
    },
  },
  carry: {
    enter() {},
    update(c) {
      if (!carried(c)) {
        regrab(c);
        return false;
      }
      return inStepZone(c);
    },
    exit() {},
    prompt: (c) => (!carried(c) && c.sim.carrying < 0 && reach(c) ? PR_GRAB : PR_NONE),
  },
  place: {
    enter() {},
    update(c) {
      const s = carried(c);
      if (!s) {
        regrab(c);
        return false;
      }
      if (!c.press || !inStepZone(c)) return false;
      putDown(c.sim, s, SS_DONE);
      s.leaveAt = c.sim.now + c.sim.deps.rules.jobs.despawnMs;
      return true;
    },
    exit() {},
    prompt: (c) => (carried(c) && inStepZone(c) ? PR_PLACE : !carried(c) && c.sim.carrying < 0 && reach(c) ? PR_GRAB : PR_NONE),
  },
  /** Shove a heavy subject into the zone by walking into it. The player's movement drives it so even a piano budges. */
  push: {
    enter() {},
    update(c) {
      const sim = c.sim, pl = sim.player, jr = sim.deps.rules.jobs;
      const z = zoneFor(c.job, c.step)!;
      let done = true;
      for (const i of c.job.subjects) {
        const s = sim.subjects[i]!;
        if (!s.active) continue;
        if (inZone(z, s.x, s.y, jr.pushSlack)) continue;
        done = false;
        const touch = s.def!.r + sim.deps.rules.player.radius + 4;
        const speed = Math.hypot(pl.ix, pl.iy), gap = Math.hypot(s.x - pl.x, s.y - pl.y);
        // Only when really walking into it: the push is the player's intent, so a blocked player still shoves a heavy thing along.
        if (s.h !== NO_BODY && speed > 1 && gap <= touch && (pl.ix * (s.x - pl.x) + pl.iy * (s.y - pl.y)) / (speed * (gap || 1)) > 0.3)
          sim.deps.physics.setTargetVelocity(s.h, pl.ix * jr.pushMult, pl.iy * jr.pushMult, 0.3);
      }
      return done;
    },
    exit() {},
    prompt: () => PR_NONE,
  },
  /** Stand still (or hold A) near the subject or in the zone for n seconds. Leaving, moving or (for 'still') farting restarts the count. */
  hold: {
    enter(c) {
      c.job.stepStartedAt = c.sim.now;
    },
    update(c) {
      const sim = c.sim;
      let ok = atWork(c);
      if (ok && c.step.mode === 'press') ok = c.held;
      else if (ok) ok = sim.player.moved <= STILL_PX && sim.lastFart.at <= c.job.stepStartedAt;
      if (!ok) {
        c.job.stepStartedAt = sim.now;
        return false;
      }
      return sim.now - c.job.stepStartedAt >= (c.step.n ?? 1) * 1000;
    },
    exit() {},
    prompt: () => PR_NONE,
  },
  /** Be in the zone for n seconds. */
  wait: {
    enter(c) {
      c.job.stepStartedAt = c.sim.now;
    },
    update(c) {
      if (!inStepZone(c)) {
        c.job.stepStartedAt = c.sim.now;
        return false;
      }
      return c.sim.now - c.job.stepStartedAt >= (c.step.n ?? 1) * 1000;
    },
    exit() {},
    prompt: () => PR_NONE,
  },
  /** Press A n times at the subject or in the zone (scrub, sweep, paint, water). */
  strike: {
    enter(c) {
      c.job.hits = 0;
    },
    update(c) {
      if (c.press && atWork(c)) {
        c.job.hits++;
        c.sim.deps.emit('mrfart:work_hit', { job: c.job.id, hits: c.job.hits });
      }
      return c.job.hits >= (c.step.n ?? 1);
    },
    exit() {},
    prompt: (c) => (atWork(c) ? PR_WORK : PR_NONE),
  },
  escort: {
    enter(c) {
      for (const i of c.job.subjects) {
        const s = c.sim.subjects[i]!;
        if (!s.active) continue;
        s.state = SS_FOLLOW;
        if (c.step.leash) attachLeash(c.sim, s);
      }
    },
    update(c) {
      const z = zoneFor(c.job, c.step)!;
      for (const i of c.job.subjects) {
        const s = c.sim.subjects[i]!;
        if (s.active && !inZone(z, s.x, s.y, 10)) return false;
      }
      return inZone(z, c.sim.player.x, c.sim.player.y);
    },
    exit(c) {
      for (const i of c.job.subjects) {
        const s = c.sim.subjects[i]!;
        if (!s.active) continue;
        detachLeash(c.sim, s);
        s.state = SS_IDLE;
      }
    },
    prompt: () => PR_NONE,
  },
};

export { SS_CARRIED };
