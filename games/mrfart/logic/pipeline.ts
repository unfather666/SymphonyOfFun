// Job pipeline: a running job is a list of steps; each step runs one verb and ends in one `mrfart:step_done` event.
import { jobText } from './jobs';
import { SS_CARRIED, SS_DONE, SS_FLEE, SS_IDLE, SS_TREE } from './jobTypes';
import type { Job, JobOffer, ModifierDef, Zone } from './jobTypes';
import { chooseEnding, endRun } from './endings';
import { repPerTask, rollFound } from './items';
import { PR_BOARD, PR_NONE, VERBS } from './verbs';
import type { VerbCtx } from './verbs';
import { despawnSubject, spawnSubject } from './subjects';
import { inZone, originZone, placeZone } from './zones';
import type { Sim } from './sim';

const z = (): Zone => ({ x: 0, y: 0, r: 0 });

/** Take an offer: build zones, spawn the subjects, enter step 0. False when it cannot start. */
export function startJob(sim: Sim, offer: JobOffer): boolean {
  if (sim.job) return false;
  const { map, rules, catalog } = sim.deps;
  const type = catalog.types[offer.type]!;
  const subj = catalog.subjects[offer.subject]!;
  const job: Job = {
    id: sim.jobSeq + 1, offer, step: 0, startedAt: sim.now, stepStartedAt: sim.now, origin: z(), place: z(), tree: z(), subjects: [], lostSince: -1, noisy: 0, drops: 0, hits: 0,
  };
  originZone(map, offer.origin, rules.jobs.zoneR, job.origin);
  if (!placeZone(map, catalog.places[offer.place]!, offer.origin, rules.jobs.zoneR, job.place)) return false;
  const kind = catalog.places[offer.place]!.kind;
  if (kind === 'tree') {
    job.tree.x = job.place.x; job.tree.y = job.place.y; job.tree.r = job.place.r;
  }
  const at = type.spawn === 'place' ? job.place : type.spawn === 'tree' ? job.tree : job.origin;
  for (let i = 0; i < offer.count; i++) {
    const s = spawnSubject(sim, subj, at.x + (i - (offer.count - 1) / 2) * rules.jobs.spread, at.y - 6, type.spawn === 'tree' ? SS_TREE : type.runaway ? SS_FLEE : SS_IDLE);
    if (!s) break;
    job.subjects.push(s.idx);
  }
  if (job.subjects.length === 0) return false;
  sim.jobSeq++;
  sim.job = job;
  sim.deps.emit('mrfart:job_started', { job: job.id, type: offer.type, subject: offer.subject, count: job.subjects.length, tier: offer.tier });
  const c = ctxFor(sim, job, false);
  VERBS[type.steps[0]!.verb]!.enter(c);
  return true;
}

function ctxFor(sim: Sim, job: Job, press: boolean): VerbCtx {
  const c = sim.verbCtx;
  c.sim = sim;
  c.job = job;
  c.step = sim.deps.catalog.types[job.offer.type]!.steps[job.step]!;
  c.press = press;
  c.held = sim.hold;
  return c;
}

function endJob(sim: Sim, job: Job, ok: boolean): void {
  const type = sim.deps.catalog.types[job.offer.type]!;
  const c = ctxFor(sim, job, false);
  if (job.step < type.steps.length) VERBS[c.step.verb]!.exit(c);
  for (const i of job.subjects) {
    const s = sim.subjects[i]!;
    if (!s.active) continue;
    if (s.state === SS_DONE && s.leaveAt > 0) continue;
    despawnSubject(sim, s);
  }
  sim.job = null;
  if (!ok) sim.deps.emit('mrfart:job_failed', { job: job.id });
}

export function abandonJob(sim: Sim): void {
  if (sim.job) endJob(sim, sim.job, false);
}

/** Did the job meet its modifier ("quietly", "before the bus", ...)? Fire is its own risk, so finishing is enough. */
export function modMet(sim: Sim, job: Job, mod: ModifierDef): boolean {
  if (mod.cond === 'quiet') return job.noisy === 0;
  if (mod.cond === 'time') return sim.now - job.startedAt <= mod.limitMs;
  if (mod.cond === 'nodrop') return job.drops === 0;
  return true;
}

function reward(sim: Sim, job: Job): void {
  const { rules, catalog } = sim.deps;
  const jr = rules.jobs;
  const m = sim.meters;
  const tier = job.offer.tier;
  const mod = job.offer.mod >= 0 ? catalog.mods[job.offer.mod]! : null;
  const mult = mod && modMet(sim, job, mod) ? mod.bonus : 1;
  const rep = Math.round((jr.repBase + tier + repPerTask(sim)) * mult * 10) / 10;
  const coins = Math.round(jr.coinBase * (1 + tier) * job.subjects.length * mult);
  m.reputation = Math.min(rules.reputation.max, m.reputation + rep);
  sim.progress.coins += coins;
  sim.progress.tasksDone++;
  sim.deps.emit('mrfart:job_done', { job: job.id, tier, count: job.subjects.length, rep, coins, mult, tasks: sim.progress.tasksDone });
  rollFound(sim);
  if (sim.progress.tasksDone >= rules.ending.tasksWin) endRun(sim, chooseEnding(sim, 'tasks'));
}

/** "While it is on fire": standing close to the burning subject piles on stress. */
function stepFire(sim: Sim, job: Job): void {
  const mod = job.offer.mod >= 0 ? sim.deps.catalog.mods[job.offer.mod]! : null;
  if (!mod || mod.cond !== 'fire') return;
  const { rules } = sim.deps;
  const pl = sim.player;
  for (const i of job.subjects) {
    const s = sim.subjects[i]!;
    const near = s.active && Math.hypot(s.x - pl.x, s.y - pl.y) <= rules.jobs.fireRange;
    if (near) {
      sim.meters.stress = Math.min(rules.stress.max, sim.meters.stress + rules.jobs.fireStress / 60);
      return;
    }
  }
}

/** Run the active job one step: lost-subject check, verb update, step transitions. Also sets the A-button prompt. */
export function stepPipeline(sim: Sim, interact: boolean): void {
  sim.prompt = PR_NONE;
  const job = sim.job;
  let used = false;
  if (job) {
    const { rules, catalog } = sim.deps;
    const type = catalog.types[job.offer.type]!;
    const c = ctxFor(sim, job, interact);
    const verb = VERBS[c.step.verb]!;
    sim.prompt = verb.prompt(c);
    stepFire(sim, job);
    // Lost: every subject on the ground is far away for too long. Costs nothing but the time.
    let far = true;
    for (const i of job.subjects) {
      const s = sim.subjects[i]!;
      if (!s.active || s.state === SS_CARRIED) { far = false; break; }
      if (Math.hypot(s.x - sim.player.x, s.y - sim.player.y) < rules.jobs.lostDist) { far = false; break; }
    }
    if (!far) job.lostSince = -1;
    else if (job.lostSince < 0) job.lostSince = sim.now;
    else if (sim.now - job.lostSince >= rules.jobs.lostMs) {
      endJob(sim, job, false);
      return;
    }
    if (verb.update(c)) {
      used = interact;
      verb.exit(c);
      sim.deps.emit('mrfart:step_done', { job: job.id, step: job.step });
      job.step++;
      job.stepStartedAt = sim.now;
      if (job.step >= type.steps.length) {
        reward(sim, job);
        endJob(sim, job, true);
      } else {
        const c2 = ctxFor(sim, job, false);
        VERBS[c2.step.verb]!.enter(c2);
      }
    }
  }
  if (inZone(sim.boardZone, sim.player.x, sim.player.y)) {
    if (sim.prompt === PR_NONE) sim.prompt = PR_BOARD;
    if (interact && !used && sim.prompt === PR_BOARD) sim.wantBoard = true;
  }
}

export { jobText };
