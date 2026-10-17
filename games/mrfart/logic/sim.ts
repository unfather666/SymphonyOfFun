// The simulation: one object, one step function. Reads input and the game clock; touches physics only through PhysicsApi.
import { NO_BODY } from '../physics/PhysicsApi';
import type { Pose } from '../physics/PhysicsApi';
import { TILE, nodePos } from './map';
import { dayIndexAt, hourAt } from './clock';
import { generateOffer } from './jobs';
import type { Job, JobOffer, Subject, Zone } from './jobTypes';
import { stepPipeline } from './pipeline';
import { createSubjects, stepSubjects } from './subjects';
import type { VerbCtx } from './verbs';
import { stepMeters, scheduleRoll } from './meters';
import { createPerson, spawnPersonBody, stepPeople } from './people';
import { createPieces, createPuffs, updatePieces, updatePuffs } from './pools';
import type { Pieces, Puffs } from './pools';
import { settleDay, stepWatchers } from './reputation';
import { STATUS_PLAYING, TAG_PLAYER, TAG_PROP, tagOf } from './types';
import type { FartInfo, Meters, Person, Player, Prop, SimDeps, SimInput } from './types';

export interface Sim {
  deps: SimDeps;
  now: number;
  steps: number;
  player: Player;
  people: Person[];
  props: Prop[];
  pieces: Pieces;
  puffs: Puffs;
  meters: Meters;
  /** In-game day number; the day changes at 00:00. */
  day: number;
  /** People close enough, with line of sight, to see Mr Fart. */
  watchers: number;
  subjects: Subject[];
  job: Job | null;
  jobSeq: number;
  /** Index of the subject being carried, -1 for none. */
  carrying: number;
  progress: { tasksDone: number; coins: number; absurd: number };
  board: { offers: JobOffer[]; hour: number };
  boardZone: Zone;
  /** A-button hint to show (PR_* in verbs.ts). */
  prompt: number;
  /** The player asked for the job board this step; the wiring layer opens it. */
  wantBoard: boolean;
  verbCtx: VerbCtx;
  /** 0 playing, 1 reputation ran out. */
  status: number;
  lastFart: FartInfo;
  qbuf: Int32Array;
  toBreak: Int32Array;
  toBreakN: number;
  pose: Pose;
}

export function createSim(deps: SimDeps): Sim {
  const { physics, rules, map } = deps;
  for (const [tx, ty, tw, th] of map.rects)
    physics.addBody({ kind: 'wall', shape: 'box', x: (tx + tw / 2) * TILE, y: (ty + th / 2) * TILE, hw: (tw * TILE) / 2, hh: (th * TILE) / 2 });

  const start = { x: 0, y: 0 };
  nodePos(map, 0, 0, start);
  const player: Player = { x: start.x, y: start.y, px: start.x, py: start.y, h: NO_BODY, facing: 0, moved: 0, running: false };
  player.h = physics.addBody({
    kind: 'player', shape: 'capsule', x: start.x, y: start.y, r: rules.player.radius, hh: 2, mass: rules.player.mass,
    damping: rules.player.damping, lockRotation: true, tag: tagOf(TAG_PLAYER, 0),
  });

  const props: Prop[] = [];
  for (const spawn of map.props) {
    const def = deps.props.find((d) => d.id === spawn.def);
    if (!def) throw new Error(`map.json: prop "${spawn.def}" has no definition.`);
    const idx = props.length;
    const h = physics.addBody({
      kind: 'prop', shape: 'box', x: spawn.x, y: spawn.y, hw: def.w / 2, hh: def.h / 2, mass: def.mass, damping: def.damping, angularDamping: 4,
      tag: tagOf(TAG_PROP, idx),
    });
    props.push({ idx, def, x: spawn.x, y: spawn.y, px: spawn.x, py: spawn.y, angle: 0, pangle: 0, h, knocked: false, broken: false });
  }

  const people: Person[] = [];
  deps.people.forEach((def, i) => {
    const p = createPerson(i, def);
    people.push(p);
  });

  const reduced = deps.reducedFx === true;
  const sim: Sim = {
    deps, now: 0, steps: 0, player, people, props,
    pieces: createPieces(reduced ? rules.caps.piecesReduced : rules.caps.pieces),
    puffs: createPuffs(reduced ? rules.caps.puffsReduced : rules.caps.puffs),
    meters: { fart: 0, stress: 0, reputation: rules.reputation.start, intolToday: 0, clenchSince: -1, ballooned: false, nextRollAt: 0, lastFartAt: -1e9 },
    day: dayIndexAt(0, rules.world.dayMs, rules.world.startHour), watchers: 0, status: STATUS_PLAYING,
    subjects: createSubjects(rules.caps.subjects), job: null, jobSeq: 0, carrying: -1, progress: { tasksDone: 0, coins: 0, absurd: 0 },
    board: { offers: [], hour: -1 }, boardZone: { x: start.x - 22, y: start.y, r: rules.jobs.boardR }, prompt: 0, wantBoard: false,
    verbCtx: { sim: null as unknown as Sim, job: null as unknown as Job, step: { verb: '', zone: 'subject' }, press: false },
    lastFart: { count: 0, kind: 0, x: 0, y: 0, force: 0, radius: 0, at: -1e9 },
    qbuf: new Int32Array(256), toBreak: new Int32Array(256), toBreakN: 0,
    pose: { x: 0, y: 0, angle: 0, vx: 0, vy: 0 },
  };
  for (const p of people) spawnPersonBody(sim, p);
  scheduleRoll(sim);
  refreshBoard(sim, true);
  return sim;
}

function readPoses(sim: Sim): void {
  const { physics } = sim.deps;
  const o = sim.pose;
  const pl = sim.player;
  if (physics.pose(pl.h, o)) {
    pl.moved = Math.hypot(o.x - pl.x, o.y - pl.y);
    pl.x = o.x;
    pl.y = o.y;
  }
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    if (p.h !== NO_BODY && physics.pose(p.h, o)) {
      p.x = o.x;
      p.y = o.y;
    }
  }
  for (let i = 0; i < sim.subjects.length; i++) {
    const p = sim.subjects[i]!;
    if (p.active && p.h !== NO_BODY && physics.pose(p.h, o)) {
      p.x = o.x;
      p.y = o.y;
    }
  }
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.h !== NO_BODY && physics.pose(p.h, o)) {
      p.x = o.x;
      p.y = o.y;
      p.angle = o.angle;
    }
  }
}

/** New offers on the board at the start and whenever the in-game hour changes. */
export function refreshBoard(sim: Sim, force: boolean): void {
  const { rules, catalog, map, rng } = sim.deps;
  const hour = Math.floor(hourAt(sim.now, rules.world.dayMs, rules.world.startHour));
  if (!force && hour === sim.board.hour) return;
  sim.board.hour = hour;
  sim.board.offers.length = 0;
  for (let i = 0; i < rules.jobs.offers; i++) {
    const o = generateOffer(catalog, map, rules, rng.jobs, sim.progress.tasksDone, sim.player.x, sim.player.y);
    if (o) sim.board.offers.push(o);
  }
}

function savePrev(sim: Sim): void {
  const pl = sim.player;
  pl.px = pl.x;
  pl.py = pl.y;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    p.px = p.x;
    p.py = p.y;
  }
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    p.px = p.x;
    p.py = p.y;
    p.pangle = p.angle;
  }
}

export function stepSim(sim: Sim, nowMs: number, input: SimInput): void {
  const { physics, rules } = sim.deps;
  sim.now = nowMs;
  sim.steps++;
  savePrev(sim);
  const pl = sim.player;
  const len = Math.hypot(input.mx, input.my);
  const carry = sim.carrying >= 0 ? sim.subjects[sim.carrying]!.def!.carryMult : 1;
  const sp = rules.player.speed * (input.run ? rules.player.runMult : 1) * carry;
  const nx = len > 1 ? input.mx / len : input.mx, ny = len > 1 ? input.my / len : input.my;
  physics.setTargetVelocity(pl.h, nx * sp, ny * sp, rules.player.gain);
  pl.running = input.run;
  if (len > 0.1) pl.facing = Math.abs(input.mx) > Math.abs(input.my) ? (input.mx < 0 ? 2 : 3) : input.my < 0 ? 1 : 0;
  stepPeople(sim);
  physics.step();
  readPoses(sim);
  stepWatchers(sim);
  stepSubjects(sim);
  stepPipeline(sim, input.interact);
  refreshBoard(sim, false);
  stepMeters(sim, input);
  const d = dayIndexAt(sim.now, rules.world.dayMs, rules.world.startHour);
  if (d > sim.day) settleDay(sim, d);
  updatePieces(sim.pieces, sim.now, 1 / 60, sim.deps.map);
  updatePuffs(sim.puffs, sim.now, 1 / 60);
}
