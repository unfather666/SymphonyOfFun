// The whole simulation as plain data and one step function. No core imports; index.ts feeds it input and beats.
import { carMaxSpeed, newCar, placeCar, savePrev, type CarEnv } from './car';
import { calamityIndex } from './calamity';
import { newFx } from './fx';
import { hazardWeights, type HazardCtx } from './hazards';
import { cruiseSpeed, hopBeats, levelBars, segmentLength } from './level';
import { createPool, stepPool } from './pieces';
import { PHASES, resetCar, setPhase } from './phases';
import { foldHash, HASH_START, hash32, newRand } from './rng';
import { PHASE_FINISHED, PHASE_RUN, type Sim } from './simtypes';
import { createTrack, ensure, generateNext } from './track';
import { STEP_S, type CalamityDef, type DriveInput, type HazardDef, type KindDef, type LevelDef, type PowerDef, type Rules, type ThemeDef } from './types';

export { beatDistMs, onBeat } from './beat';
export { PHASE_DYING, PHASE_FINISHED, PHASE_OVER, PHASE_RUN, STAGE_BOOM, STAGE_CAPTION, STAGE_SHARDS } from './simtypes';
export type { Beat, PowerState, Sim } from './simtypes';

export interface SimOpts {
  rules: Rules;
  level: LevelDef;
  theme: ThemeDef;
  kinds: readonly KindDef[];
  hazards?: readonly HazardDef[];
  powers?: readonly PowerDef[];
  calamities?: readonly CalamityDef[];
  runSeed: number;
  bpm: number;
  meter?: number;
  /** Pool caps; reducedFx lowers them. */
  piecesCap?: number;
  smokeCap?: number;
}

export function createSim(o: SimOpts): Sim {
  const meter = o.meter ?? 4;
  const hazards = o.hazards ?? [];
  const powers = o.powers ?? [];
  const segLen = segmentLength(o.level, o.rules, o.bpm);
  const seed = hash32(o.runSeed, o.level.no);
  const totalBars = levelBars(o.rules.levelSeconds, o.bpm, meter);
  const sectionBeats = o.rules.sectionBars * meter;
  const hz: HazardCtx | undefined = hazards.length
    ? { defs: hazards, weights: hazardWeights(hazards, o.theme.hazardWeights), powers, sections: Math.ceil(totalBars / o.rules.sectionBars), sectionBeats, meter }
    : undefined;
  const track = createTrack({ seed, kinds: o.kinds, theme: o.theme, rules: o.rules, segLen, sectionBeats, rampCooldown: hopBeats(o.level, o.rules, o.theme.gravity, segLen), hz });
  const sim: Sim = {
    rules: o.rules, level: o.level, theme: o.theme, seed, bpm: o.bpm, meter, segLen, cruise: cruiseSpeed(o.level, o.rules),
    totalBars, totalBeats: totalBars * meter, track, car: newCar(),
    env: { track, rules: o.rules, maxSpeed: o.level.maxSpeed, gravity: o.theme.gravity } as CarEnv,
    beat: { edgeMs: -1e9, periodMs: 60000 / o.bpm, index: -1 },
    hazards, powers, calamities: o.calamities ?? [],
    pieces: createPool(o.piecesCap ?? o.rules.piecesCap, o.rules.pieceGravity), smoke: createPool(o.smokeCap ?? o.rules.smokeCap, -2),
    fx: newFx(), rand: newRand(),
    phase: PHASE_RUN, nowMs: 0, runMs: 0, syncedBeats: 0, lastSyncBeat: -2, lives: o.rules.lives, deaths: 0, dodged: 0, broken: 0, coins: 0, distance: 0,
    power: { held: -1, shieldCharges: 0, shieldUntilMs: 0, magnetUntilMs: 0, invulnUntilMs: 0 },
    hitUntilMs: 0, passedIdx: -1, smokeAcc: 0, seekBar: -1, pendingDeath: -1, calamity: -1, deathAtMs: 0, dyingStage: 0, carHidden: false, finishGagDone: false,
  };
  resetCar(sim, 0);
  return sim;
}

export function stepSim(sim: Sim, inp: DriveInput, nowMs: number): void {
  sim.nowMs = nowMs;
  PHASES[sim.phase]!.update(sim, inp, nowMs);
  stepPieces(sim, nowMs);
}

function stepPieces(sim: Sim, nowMs: number): void {
  stepPool(sim.pieces, nowMs, STEP_S);
  stepPool(sim.smoke, nowMs, STEP_S);
}

/** Dev only: make the next step end the run with this calamity. Returns false for an unknown id. */
export function forceCalamity(sim: Sim, id: string): boolean {
  const i = calamityIndex(sim.calamities, id);
  if (i < 0) return false;
  sim.pendingDeath = i;
  return true;
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
  if (sim.phase === PHASE_RUN) setPhase(sim, PHASE_FINISHED, sim.nowMs);
}

/** Stable hash of everything that should be identical between two runs with the same seed and inputs. */
export function hashSim(sim: Sim): number {
  const c = sim.car;
  let h = HASH_START;
  for (const v of [c.s, c.lane, c.speed, c.h, c.vh, c.health, c.syncStacks, sim.phase, sim.deaths, sim.lives, sim.syncedBeats, sim.dodged, sim.broken, sim.coins, sim.pieces.n, sim.power.held, sim.track.next, c.x, c.y, c.z, c.yaw]) h = foldHash(h, v);
  return h >>> 0;
}

export { carMaxSpeed };
