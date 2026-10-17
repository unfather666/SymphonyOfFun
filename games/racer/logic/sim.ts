// The whole simulation as plain data and one step function. No core imports; index.ts feeds it input and beats.
import { carMaxSpeed, newCar, placeCar, savePrev, stepCar, type Car, type CarEnv } from './car';
import { cruiseSpeed, hopBeats, levelBars, segmentLength } from './level';
import { foldHash, HASH_START, hash32 } from './rng';
import { createTrack, ensure, generateNext, restartAt, type Track } from './track';
import { STEP_S, type DriveInput, type KindDef, type LevelDef, type Rules, type ThemeDef } from './types';

export const PHASE_RUN = 0;
export const PHASE_DYING = 1;
export const PHASE_FINISHED = 2;

export interface Beat {
  /** Game ms of the last beat edge as the player hears it (event time + audio latency). */
  edgeMs: number;
  periodMs: number;
  index: number;
}

export interface Sim {
  rules: Rules;
  level: LevelDef;
  theme: ThemeDef;
  seed: number;
  bpm: number;
  meter: number;
  segLen: number;
  cruise: number;
  totalBars: number;
  totalBeats: number;
  track: Track;
  car: Car;
  env: CarEnv;
  beat: Beat;
  phase: number;
  phaseUntilMs: number;
  nowMs: number;
  runMs: number;
  /** Beats where a press landed on the beat. */
  syncedBeats: number;
  lastSyncBeat: number;
  deaths: number;
  /** Set to a bar when the music should seek there; index.ts clears it. */
  seekBar: number;
  distance: number;
}

export interface SimOpts {
  rules: Rules;
  level: LevelDef;
  theme: ThemeDef;
  kinds: readonly KindDef[];
  runSeed: number;
  bpm: number;
  meter?: number;
}

export function createSim(o: SimOpts): Sim {
  const meter = o.meter ?? 4;
  const segLen = segmentLength(o.level, o.rules, o.bpm);
  const seed = hash32(o.runSeed, o.level.no);
  const track = createTrack({ seed, kinds: o.kinds, theme: o.theme, rules: o.rules, segLen, sectionBeats: o.rules.sectionBars * meter, rampCooldown: hopBeats(o.level, o.rules, o.theme.gravity, segLen) });
  const car = newCar();
  const totalBars = levelBars(o.rules.levelSeconds, o.bpm, meter);
  const sim: Sim = {
    rules: o.rules, level: o.level, theme: o.theme, seed, bpm: o.bpm, meter, segLen, cruise: cruiseSpeed(o.level, o.rules),
    totalBars, totalBeats: totalBars * meter, track, car,
    env: { track, rules: o.rules, maxSpeed: o.level.maxSpeed, gravity: o.theme.gravity },
    beat: { edgeMs: -1e9, periodMs: 60000 / o.bpm, index: -1 },
    phase: PHASE_RUN, phaseUntilMs: 0, nowMs: 0, runMs: 0, syncedBeats: 0, lastSyncBeat: -2, deaths: 0, seekBar: -1, distance: 0,
  };
  resetCar(sim, 0);
  return sim;
}

/** Put the car at the start of segment `beat` at cruise speed, road regenerated from there. */
function resetCar(sim: Sim, beat: number): void {
  const c = sim.car;
  const start = restartAt(sim.track, beat);
  c.s = start * sim.segLen;
  c.lane = 0;
  c.speed = sim.cruise;
  c.h = 0;
  c.vh = 0;
  c.airborne = false;
  c.offroad = false;
  c.fell = false;
  c.landed = false;
  c.syncStacks = 0;
  c.syncUntilMs = 0;
  c.boostUntilMs = 0;
  c.roll = 0;
  ensure(sim.track, start);
  placeCar(c, sim.env);
  savePrev(c);
}

/** Distance in ms to the nearest beat edge. */
export function beatDistMs(sim: Sim, nowMs: number): number {
  const p = sim.beat.periodMs;
  let d = (nowMs - sim.beat.edgeMs) % p;
  if (d < 0) d += p;
  return Math.min(d, p - d);
}

/** A core beat edge arrived (every 4th 16th step). `step` is the song step. */
export function onBeat(sim: Sim, step: number, nowMs: number): void {
  sim.beat.edgeMs = nowMs + sim.rules.audioLatencyMs;
  sim.beat.index = step >> 2;
}

export function stepSim(sim: Sim, inp: DriveInput, nowMs: number): void {
  sim.nowMs = nowMs;
  const car = sim.car;
  if (sim.phase === PHASE_DYING) {
    if (nowMs >= sim.phaseUntilMs) respawn(sim);
    return;
  }
  if (sim.phase !== PHASE_RUN) return;

  savePrev(car);
  ensure(sim.track, Math.floor(car.s / sim.segLen));
  if (inp.accelPressed && beatDistMs(sim, nowMs) <= sim.rules.syncWindowMs) {
    car.syncStacks = Math.min(sim.rules.syncMaxStacks, car.syncStacks + 1);
    car.syncUntilMs = nowMs + sim.meter * sim.beat.periodMs;
    if (sim.beat.index !== sim.lastSyncBeat) {
      sim.syncedBeats++;
      sim.lastSyncBeat = sim.beat.index;
    }
  }
  if (nowMs >= car.syncUntilMs) car.syncStacks = 0;
  stepCar(car, inp, nowMs, sim.env);
  sim.runMs += STEP_S * 1000;
  sim.distance = car.s;
  if (car.fell) kill(sim, nowMs);
  else if (car.s >= sim.totalBeats * sim.segLen - 2 * sim.segLen) sim.phase = PHASE_FINISHED;
}

function kill(sim: Sim, nowMs: number): void {
  sim.phase = PHASE_DYING;
  sim.phaseUntilMs = nowMs + sim.rules.deathMs;
  sim.deaths++;
  sim.car.speed = 0;
}

function respawn(sim: Sim): void {
  const beat = Math.floor(sim.car.s / sim.segLen);
  const sectionStart = Math.floor(beat / sim.track.sectionBeats) * sim.track.sectionBeats;
  resetCar(sim, sectionStart);
  sim.seekBar = sectionStart / sim.meter;
  sim.phase = PHASE_RUN;
}

/** Dev only: jump the car to the start of beat `beat` (generates the road up to it). */
export function warpTo(sim: Sim, beat: number): void {
  ensure(sim.track, beat);
  sim.car.s = beat * sim.segLen;
  placeCar(sim.car, sim.env);
  savePrev(sim.car);
}

/** Dev only: warp to three beats before the first segment of kind `id` after beat 12. Returns false if none in 2000 beats. */
export function warpToKind(sim: Sim, id: string, kinds: readonly KindDef[]): boolean {
  for (let i = 0; i < 2000; i++) {
    const seg = generateNext(sim.track);
    if (seg && seg.index > 12 && kinds[seg.kind]!.id === id) {
      warpTo(sim, seg.index - 3);
      return true;
    }
  }
  return false;
}

/** The song ended: the level is over. */
export function songEnded(sim: Sim): void {
  if (sim.phase === PHASE_RUN) sim.phase = PHASE_FINISHED;
}

/** Stable hash of everything that should be identical between two runs with the same seed and inputs. */
export function hashSim(sim: Sim): number {
  const c = sim.car;
  let h = HASH_START;
  for (const v of [c.s, c.lane, c.speed, c.h, c.vh, c.health, c.syncStacks, sim.phase, sim.deaths, sim.syncedBeats, sim.track.next, c.x, c.y, c.z, c.yaw]) h = foldHash(h, v);
  return h >>> 0;
}

export { carMaxSpeed };
