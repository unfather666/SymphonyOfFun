// The run's explicit phases: RUN, DYING, FINISHED, OVER. Each is enter/update/exit on the Sim; stepSim only dispatches.
import { savePrev, placeCar, stepCar } from './car';
import { calamityFor } from './calamity';
import { FX_BOOM, FX_FALL, FX_FINISH, FX_OVER, FX_RESPAWN, FX_JUMP, FX_LAND, pushFx } from './fx';
import { beatDistMs } from './beat';
import { interact } from './interact';
import { burst, clearPool, spawnPiece } from './pieces';
import { usePower } from './powerups';
import { randFloat, seedRand } from './rng';
import { PHASE_DYING, PHASE_FINISHED, PHASE_OVER, PHASE_RUN, STAGE_BOOM, STAGE_CAPTION, STAGE_SHARDS, type Sim } from './simtypes';
import { ensure, restartAt } from './track';
import { STEP_S, type DriveInput } from './types';

export interface Phase {
  enter(sim: Sim, nowMs: number): void;
  update(sim: Sim, inp: DriveInput, nowMs: number): void;
  exit(sim: Sim, nowMs: number): void;
}

/** Put the car at the start of segment `beat` at cruise speed, road regenerated from there. */
export function resetCar(sim: Sim, beat: number): void {
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
  c.slideUntilMs = 0;
  c.roll = 0;
  c.health = sim.rules.healthMax;
  sim.passedIdx = start - 1;
  ensure(sim.track, start);
  placeCar(c, sim.env);
  savePrev(c);
}

function emitSmoke(sim: Sim, nowMs: number): void {
  const c = sim.car;
  const hurt = 1 - c.health / sim.rules.smokeBelowHealth;
  if (hurt <= 0) return;
  sim.smokeAcc += hurt * sim.rules.smokePerSec * STEP_S;
  while (sim.smokeAcc >= 1) {
    sim.smokeAcc -= 1;
    const r = seedRand(sim.rand, sim.seed, Math.floor(nowMs / STEP_S / 1000), 9);
    const sx = Math.sin(c.yaw);
    const sz = -Math.cos(c.yaw);
    spawnPiece(sim.smoke, c.x - sx * 1.6 + (randFloat(r) - 0.5) * 0.6, c.y + 0.7, c.z - sz * 1.6 + (randFloat(r) - 0.5) * 0.6, sx * c.speed * 0.2, 1.4 + randFloat(r), sz * c.speed * 0.2, 0.5 + hurt * 0.6, 0, nowMs, 900, -1e9);
  }
}

/** First calamity that applies to this trigger, or -1. */
function trigger(sim: Sim, kind: string): number {
  return calamityFor(sim.calamities, kind, sim.theme.id);
}

function runEnter(): void {}

function runUpdate(sim: Sim, inp: DriveInput, nowMs: number): void {
  const car = sim.car;
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
  const wasAir = car.airborne;
  stepCar(car, inp, nowMs, sim.env);
  if (car.airborne && !wasAir) pushFx(sim.fx, FX_JUMP);
  if (car.landed) pushFx(sim.fx, FX_LAND);
  sim.runMs += STEP_S * 1000;
  sim.distance = car.s;
  if (inp.usePressed) usePower(sim, nowMs);
  interact(sim, nowMs);
  if (nowMs >= sim.power.shieldUntilMs) sim.power.shieldCharges = 0;
  emitSmoke(sim, nowMs);

  if (sim.pendingDeath < 0) {
    if (car.fell) sim.pendingDeath = trigger(sim, 'fall');
    else if (car.health <= 0) sim.pendingDeath = trigger(sim, 'health_zero');
    else if (car.s >= sim.totalBeats * sim.segLen - 2 * sim.segLen) {
      if (car.health < sim.rules.finishMinHealth && !sim.finishGagDone) {
        sim.finishGagDone = true;
        sim.pendingDeath = trigger(sim, 'finish_low');
      } else setPhase(sim, PHASE_FINISHED, nowMs);
    }
    // A fall or zero-health death whose trigger has no calamity still ends the run: use the first calamity as the fallback.
    if (sim.pendingDeath < 0 && (car.fell || car.health <= 0)) sim.pendingDeath = 0;
  }
  if (sim.pendingDeath >= 0 && sim.phase === PHASE_RUN) setPhase(sim, PHASE_DYING, nowMs);
}

function dyingEnter(sim: Sim, nowMs: number): void {
  const c = sim.car;
  const idx = sim.pendingDeath;
  sim.pendingDeath = -1;
  sim.calamity = idx;
  sim.deaths++;
  sim.lives--;
  sim.deathAtMs = nowMs;
  sim.dyingStage = STAGE_BOOM;
  const def = sim.calamities[idx];
  const falls = def !== undefined && def.camera === 'fall';
  c.speed = 0;
  c.boostUntilMs = 0;
  sim.power.held = -1;
  sim.power.shieldCharges = 0;
  sim.power.invulnUntilMs = 0;
  sim.power.magnetUntilMs = 0;
  if (def) {
    const r = seedRand(sim.rand, sim.seed, Math.floor(c.s), 5);
    burst(sim.pieces, r, def.pieces, c.x, c.y + 0.8, c.z, 9, 8, 0.45, 13, nowMs, def.cinematicMs * 0.6, c.y - c.h);
  }
  if (falls) {
    c.vh = 0;
    c.airborne = true;
    pushFx(sim.fx, FX_FALL, idx);
  } else {
    sim.carHidden = true;
    pushFx(sim.fx, FX_BOOM, idx);
  }
}

function dyingUpdate(sim: Sim, _inp: DriveInput, nowMs: number): void {
  const def = sim.calamities[sim.calamity];
  const cin = def ? def.cinematicMs : sim.rules.deathMs;
  const t = (nowMs - sim.deathAtMs) / cin;
  sim.dyingStage = t < 0.3 ? STAGE_BOOM : t < 0.6 ? STAGE_SHARDS : STAGE_CAPTION;
  const c = sim.car;
  savePrev(c);
  if (c.airborne && !sim.carHidden) {
    c.vh -= sim.rules.gravity * sim.env.gravity * STEP_S;
    c.h += c.vh * STEP_S;
    c.pitch -= 0.02;
    placeCar(c, sim.env);
  }
  if (t >= 1) {
    if (sim.lives > 0) respawn(sim, nowMs);
    else setPhase(sim, PHASE_OVER, nowMs);
  }
}

function respawn(sim: Sim, nowMs: number): void {
  const beat = Math.floor(sim.car.s / sim.segLen);
  const sectionStart = Math.floor(beat / sim.track.sectionBeats) * sim.track.sectionBeats;
  clearPool(sim.pieces);
  clearPool(sim.smoke);
  resetCar(sim, sectionStart);
  sim.carHidden = false;
  sim.hitUntilMs = nowMs + sim.rules.respawnGraceMs;
  sim.seekBar = sectionStart / sim.meter;
  pushFx(sim.fx, FX_RESPAWN);
  setPhase(sim, PHASE_RUN, nowMs);
}

function finishedEnter(sim: Sim): void {
  pushFx(sim.fx, FX_FINISH);
}

function overEnter(sim: Sim): void {
  pushFx(sim.fx, FX_OVER);
}

function idle(): void {}

export const PHASES: readonly Phase[] = [
  { enter: runEnter, update: runUpdate, exit: idle },
  { enter: dyingEnter, update: dyingUpdate, exit: idle },
  { enter: finishedEnter, update: idle, exit: idle },
  { enter: overEnter, update: idle, exit: idle },
];

export function setPhase(sim: Sim, phase: number, nowMs: number): void {
  if (sim.phase === phase) return;
  PHASES[sim.phase]!.exit(sim, nowMs);
  sim.phase = phase;
  PHASES[phase]!.enter(sim, nowMs);
}
