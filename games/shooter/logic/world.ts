// World creation, spawning and small shared helpers. State changes go through these functions.
import { CUE, OUT_CAP } from './cues';
import { createGrid } from './grid';
import { createPool } from './pool';
import { newLightState } from './lightscript';
import type { Rng } from './rng';
import type { Rules } from './rules';
import { TILE, T_EXIT_SHUT, type TileMap } from './tiles';
import type { Bullet, CBrain, Enemy, EnemyDef, Ghost, LevelPlan, Particle, Pickup, Player, RoomState, ShotSpec, World } from './types';

function makeEnemy(dummyDef: EnemyDef, dummyBrain: CBrain): Enemy {
  return {
    alive: false, idx: -1, slot: 0, born: 0, def: dummyDef, brain: dummyBrain,
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, kx: 0, ky: 0, hp: 0, state: 0, stateAt: 0, heading: 0, nextActAt: 0,
    hurtAt: -1e9, burnUntil: 0, burnTickAt: 0, slowUntil: 0, blindUntil: 0, room: -1, elite: false, los: false, phase: 0,
  };
}
const makeBullet = (): Bullet => ({
  alive: false, idx: -1, slot: 0, born: 0, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 0, dieAt: 0, size: 0, grow: 0, pierce: 0,
  bounce: 0, homing: 0, kb: 0, hitMask: 0, killMask: 0, owner: 0, kind: 0, elem: 0, h0: -1, h1: -1, h2: -1, h3: -1,
});
const makeParticle = (): Particle => ({ alive: false, idx: -1, slot: 0, born: 0, x: 0, y: 0, vx: 0, vy: 0, dieAt: 0, colour: 0, size: 1, glow: 0 });
const makeGhost = (): Ghost => ({ alive: false, idx: -1, slot: 0, born: 0, x: 0, y: 0, vx: 0, vy: 0, dieAt: 0, kind: 0, arg: 0 });
const makePickup = (): Pickup => ({ alive: false, idx: -1, slot: 0, born: 0, x: 0, y: 0, kind: 0, arg: 0, dieAt: 0 });

export interface WorldInit {
  rules: Rules;
  rng: Rng;
  madRng: Rng;
  fxRng: Rng;
  plan: LevelPlan;
  defs: readonly EnemyDef[];
  brains: ReadonlyMap<string, CBrain>;
  shot: ShotSpec;
  now: number;
}

function newPlayer(rules: Rules, plan: LevelPlan, now: number): Player {
  return {
    x: plan.start.x, y: plan.start.y, px: plan.start.x, py: plan.start.y, aimX: 1, aimY: 0, hp: rules.player_hp, maxHp: rules.player_hp,
    iUntil: 0, dashUntil: 0, dashReadyAt: now, dashX: 0, dashY: 0, nextShotAt: 0, shotIdx: 0, flares: rules.flare_start, flareUntil: 0, overdriveUntil: 0, walk: 0,
  };
}

function roomMapOf(plan: LevelPlan): Int8Array {
  const rm = new Int8Array(plan.w * plan.h).fill(-1);
  plan.rooms.forEach((r, i) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) rm[y * plan.w + x] = i;
  });
  return rm;
}

const newRooms = (plan: LevelPlan): RoomState[] => plan.rooms.map((r) => ({ wave: 0, spawned: 0, begun: false, state: r.waves.length === 0 ? 2 : 0, nextWaveAt: 0 }));

export function createWorld(init: WorldInit): World {
  const { rules, plan } = init;
  const first = init.defs[0]!;
  const dummyBrain: CBrain = { start: 0, states: [] };
  const map: TileMap = { w: plan.w, h: plan.h, data: plan.tiles.slice() };
  const w: World = {
    rules, rng: init.rng, madRng: init.madRng, fxRng: init.fxRng, now: init.now, stepNo: 0, startedAt: init.now, status: 'play', plan, map,
    player: newPlayer(rules, plan, init.now),
    enemies: createPool(rules.cap_enemies, () => makeEnemy(first, dummyBrain), 'skip'),
    bullets: createPool(rules.cap_bullets, makeBullet, 'replaceOldest'),
    particles: createPool(rules.cap_particles, makeParticle, 'skip'),
    pickups: createPool(rules.cap_pickups, makePickup, 'replaceOldest'),
    ghosts: createPool(rules.cap_ghosts, makeGhost, 'skip'),
    defList: init.defs,
    defIndex: new Map(init.defs.map((d, i) => [d.id, i])),
    grid: createGrid(plan.w * TILE, plan.h * TILE, rules.grid_cell, rules.cap_enemies),
    defs: new Map(init.defs.map((d) => [d.id, d])),
    brains: init.brains,
    shot: init.shot,
    rooms: newRooms(plan), room: -1, exitOpen: false, score: 0, kills: 0, spawnCount: 0, waveCount: 0, combo: 0, comboUntil: 0, madness: 0, madnessIn: 0,
    light: newLightState(plan.ambient), inv: { phase: 0, at: 0 }, fxNextAt: 0, whisperAt: init.now + 3000,
    out: new Int32Array(OUT_CAP), outN: 0, scratch: new Int32Array(64),
    roomMap: roomMapOf(plan), roomAlive: new Int32Array(plan.rooms.length),
    flow: new Int16Array(plan.w * plan.h).fill(-1), flowQ: new Int32Array(plan.w * plan.h), flowAt: -1,
    gained: new Int32Array(8), gainedN: 0, dropItems: [],
  };
  closeExit(w);
  return w;
}

function closeExit(w: World): void {
  const e = w.plan.exit;
  if (e) w.map.data[Math.floor(e.y / TILE) * w.map.w + Math.floor(e.x / TILE)] = T_EXIT_SHUT;
}

/** Restart the same plan: pools emptied, tiles restored, player at the start, score kept at 0. */
export function resetWorld(w: World, now: number): void {
  w.enemies.clear();
  w.bullets.clear();
  w.particles.clear();
  w.pickups.clear();
  w.ghosts.clear();
  w.map.data.set(w.plan.tiles);
  w.player = newPlayer(w.rules, w.plan, now);
  w.rooms = newRooms(w.plan);
  w.room = -1;
  w.exitOpen = false;
  w.status = 'play';
  w.score = 0;
  w.kills = 0;
  w.spawnCount = 0;
  w.waveCount = 0;
  w.combo = 0;
  w.comboUntil = 0;
  w.madness = 0;
  w.madnessIn = 0;
  w.light = newLightState(w.plan.ambient);
  w.inv = { phase: 0, at: 0 };
  w.fxNextAt = 0;
  w.whisperAt = now + 3000;
  w.startedAt = now;
  w.now = now;
  w.outN = 0;
  w.gainedN = 0;
  w.flowAt = -1;
  closeExit(w);
}

export function cue(w: World, code: number): void {
  if (w.outN < OUT_CAP) w.out[w.outN++] = code;
}

export function spawnEnemy(w: World, defId: string, x: number, y: number, elite: boolean, room: number): Enemy | null {
  const def = w.defs.get(defId);
  const brain = def ? w.brains.get(def.brain) : undefined;
  if (!def || !brain) return null;
  const e = w.enemies.acquire();
  if (!e) return null;
  e.def = def;
  e.brain = brain;
  e.x = e.px = x;
  e.y = e.py = y;
  e.vx = e.vy = e.kx = e.ky = 0;
  e.hp = def.hp * (elite ? w.rules.elite_hp_mul : 1);
  e.state = brain.start;
  e.stateAt = w.now;
  e.heading = w.rng.float() * Math.PI * 2;
  e.phase = w.rng.float() * Math.PI * 2;
  e.nextActAt = 0;
  e.hurtAt = -1e9;
  e.burnUntil = e.slowUntil = e.blindUntil = 0;
  e.room = room;
  e.elite = elite;
  e.los = false;
  w.spawnCount++;
  return e;
}

export function spark(w: World, x: number, y: number, n: number, colour: number, glow: number): void {
  const r = w.fxRng;
  for (let i = 0; i < n; i++) {
    const p = w.particles.acquire();
    if (!p) return;
    const a = r.float() * Math.PI * 2;
    const s = 20 + r.float() * 60;
    p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
    p.dieAt = w.now + 200 + r.float() * 300;
    p.colour = colour; p.size = 1 + (r.float() < 0.3 ? 1 : 0); p.glow = glow;
  }
}

export function dropPickup(w: World, x: number, y: number, kind: number, arg: number): void {
  const p = w.pickups.acquire();
  if (!p) return;
  p.x = x; p.y = y; p.kind = kind; p.arg = arg; p.dieAt = w.now + w.rules.pickup_life_ms;
}

export { CUE };

/** The one door for changing the player's shot (rig edits, preset cycling). */
export function setShot(w: World, spec: ShotSpec): void {
  w.shot = spec;
  w.player.shotIdx = 0;
}
