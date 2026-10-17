// A simple autopilot used by tests ("every level is completable") and the dev ?bot=1 param. Pure.
// It plans one of three lanes for each hazard or pickup ahead (cheapest path) and steers to the first step.
import { beatDistMs, type Sim } from './sim';
import { hazardActive, hazardLane } from './hazards';
import { hasSeg, segAt } from './track';
import { HZ_ALIVE, type DriveInput } from './types';

const LANE_X = [-2 / 3, 0, 2 / 3];
/** Segments of road the planner looks at, and the most events it keeps. */
const ROWS = 6;
/** Seconds around a hazard's arrival time that are checked for contact. */
const SAMPLES = [-0.1, 0, 0.1];
/** Periodic hazards (trains, beams, pianos) get a wider berth: their window does not move with the car's speed changes. */
const WIDE = [-0.4, -0.2, 0, 0.2, 0.4];
const HIT_MAJOR = 1000;
/** Cost above which a hit is expected on the best path. */
const BLOCKED = 900;
const walls = { seen: false };

const cost = new Float64Array(ROWS * 3);
const value = new Float64Array((ROWS + 1) * 3);


/** Cost of changing lane by `d` lanes going into event `k`: later changes cost more, so the plan turns early. */
function shift(d: number, k: number): number {
  const n = Math.abs(d);
  if (n === 0) return 0;
  return (n > 1 ? 20 : 0.3) * (1 + 0.5 * k);
}

/** Add the event on `seg` (if any) as event `k`: cost per lane. Returns 1 if added, 0 if not. Pickups only break ties: chasing them cost more hits than they gave. */
function addEvent(sim: Sim, seg: ReturnType<typeof segAt>, k: number, nowMs: number): number {
  const car = sim.car;
  const beatMs = sim.beat.periodMs;
  const speed = Math.max(car.speed, 5);
  if (seg.hz >= 0 && seg.hzState === HZ_ALIVE) {
    const d = sim.hazards[seg.hz]!;
    const dist = (seg.index + seg.hzT) * sim.segLen - car.s;
    if (dist < -d.halfLen) return 0;
    const eta = Math.max(0, dist / speed);
    let lethal = 0;
    for (let l = 0; l < 3; l++) {
      cost[k * 3 + l] = 0;
      const samples = d.motion === 'periodic' ? WIDE : SAMPLES;
      for (let i = 0; i < samples.length; i++) {
        const t = nowMs + (eta + samples[i]!) * 1000;
        if (!hazardActive(d, seg, t, beatMs)) continue;
        if (Math.abs(LANE_X[l]! - hazardLane(d, seg, t, beatMs)) <= d.halfW + sim.rules.carHalfW + 0.1) {
          cost[k * 3 + l] = d.major ? HIT_MAJOR : 50 + d.damageMax * 2 + d.slideMs / 5;
          if (d.major) lethal++;
          break;
        }
      }
    }
    if (lethal === 3 && eta > 0.5) walls.seen = true;
    return 1;
  }
  if (seg.pk >= 0 && seg.pkState === HZ_ALIVE) {
    const l = Math.round(seg.pkLane / (2 / 3)) + 1;
    if ((seg.index + seg.pkT) * sim.segLen < car.s || l < 0 || l > 2) return 0;
    for (let i = 0; i < 3; i++) cost[k * 3 + i] = i === l ? -(sim.powers[seg.pk]!.coin ? 0.05 : 0.1) : 0;
    return 1;
  }
  return 0;
}

/** Fill `inp` for this step: hold accelerate, tap on the beat, dodge hazards, jump ramps that lead into a gap. */
export function botInput(sim: Sim, inp: DriveInput, nowMs: number): void {
  const car = sim.car;
  const idx = Math.floor(car.s / sim.segLen);
  inp.accelPressed = beatDistMs(sim, nowMs) < 8.4 && nowMs - sim.beat.edgeMs < sim.beat.periodMs * 0.5;

  walls.seen = false;
  let n = 0;
  for (let j = idx; j < idx + ROWS && n < ROWS; j++) if (hasSeg(sim.track, j)) n += addEvent(sim, segAt(sim.track, j), n, nowMs);
  // Cheapest path from the last event back to the first; value[k][l] = cost from event k onward if in lane l there.
  for (let l = 0; l < 3; l++) value[n * 3 + l] = 0;
  for (let k = n - 1; k >= 0; k--) {
    for (let l = 0; l < 3; l++) {
      let best = Infinity;
      for (let m = 0; m < 3; m++) {
        const v = value[(k + 1) * 3 + m]! + (k === n - 1 ? 0 : shift(l - m, k + 1));
        if (v < best) best = v;
      }
      value[k * 3 + l] = cost[k * 3 + l]! + best;
    }
  }
  // First step from the car's current lane.
  const at = Math.max(0, Math.min(2, Math.round(car.lane / (2 / 3)) + 1));
  let pick = at;
  let pickCost = Infinity;
  if (n === 0) pickCost = 0;
  else {
    for (let m = 0; m < 3; m++) {
      const v = value[m]! + shift(at - m, 0);
      if (v < pickCost) {
        pickCost = v;
        pick = m;
      }
    }
  }
  const slow = walls.seen && pickCost >= BLOCKED && car.speed > 0.3 * sim.cruise;
  inp.accel = !slow;
  inp.brake = slow;
  const held = sim.power.held >= 0 ? sim.powers[sim.power.held]! : null;
  inp.usePressed = held !== null && (held.heal > 0 ? car.health < sim.rules.healthMax - held.heal : pickCost >= BLOCKED);
  const err = LANE_X[pick]! - car.lane;
  inp.steer = Math.abs(err) < 0.04 ? 0 : Math.max(-1, Math.min(1, err * 4));
  inp.jumpPressed = false;
  if (hasSeg(sim.track, idx) && hasSeg(sim.track, idx + 1)) {
    const seg = segAt(sim.track, idx);
    if (seg.ramp && segAt(sim.track, idx + 1).gap && !car.airborne) inp.jumpPressed = true;
  }
}
