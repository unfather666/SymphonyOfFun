// What the car touches this step: hazards, pickups, and settling what it left behind. Writes the sim through small helpers.
import { breakHazard } from './breakage';
import { calamityIndex } from './calamity';
import { FX_HIT, pushFx } from './fx';
import { hazardActive, hazardLane } from './hazards';
import { collect } from './powerups';
import { randFloat, seedRand } from './rng';
import type { Sim } from './simtypes';
import { hasSeg, segAt } from './track';
import { HZ_ALIVE, HZ_PASSED, type Segment } from './types';

/** The car clears minor hazards by being this high above the road. */
const HOP_CLEARANCE = 1.4;

function hit(sim: Sim, seg: Segment, lane: number, nowMs: number): void {
  const d = sim.hazards[seg.hz]!;
  const car = sim.car;
  if (d.major) {
    if (sim.power.shieldCharges > 0) {
      sim.power.shieldCharges--;
      breakHazard(sim, seg, lane);
    } else {
      const c = d.calamity ? calamityIndex(sim.calamities, d.calamity) : -1;
      if (c >= 0) sim.pendingDeath = c;
      else breakHazard(sim, seg, lane);
    }
    return;
  }
  if (nowMs < sim.power.invulnUntilMs) {
    breakHazard(sim, seg, lane);
    return;
  }
  if (nowMs < sim.hitUntilMs) return;
  const r = seedRand(sim.rand, sim.seed, seg.index, 8);
  car.health -= d.damageMin + (d.damageMax - d.damageMin) * randFloat(r);
  car.speed *= 1 - d.speedLoss;
  sim.hitUntilMs = nowMs + sim.rules.hitCooldownMs;
  if (d.slideMs > 0) {
    car.slideUntilMs = nowMs + d.slideMs * (1 + sim.theme.ice * 1.5);
    car.slideSteer = car.lastSteer * sim.rules.slideSteerFrac;
  }
  pushFx(sim.fx, FX_HIT, car.health);
  breakHazard(sim, seg, lane);
}

function touch(sim: Sim, seg: Segment, nowMs: number): void {
  const car = sim.car;
  const len = sim.segLen;
  const beatMs = sim.beat.periodMs;
  if (seg.hz >= 0 && seg.hzState === HZ_ALIVE && car.h < HOP_CLEARANCE) {
    const d = sim.hazards[seg.hz]!;
    const hs = (seg.index + seg.hzT) * len;
    if (Math.abs(car.s - hs) <= d.halfLen + 1.2 && hazardActive(d, seg, nowMs, beatMs)) {
      const lane = hazardLane(d, seg, nowMs, beatMs);
      if (Math.abs(car.lane - lane) <= d.halfW + sim.rules.carHalfW) hit(sim, seg, lane, nowMs);
    }
  }
  if (seg.pk >= 0 && seg.pkState === HZ_ALIVE && car.h < HOP_CLEARANCE + 0.4) {
    const def = sim.powers[seg.pk]!;
    const ps = (seg.index + seg.pkT) * len;
    const near = Math.abs(car.s - ps) <= 2.2 && Math.abs(car.lane - seg.pkLane) <= 0.34;
    const pulled = def.coin && nowMs < sim.power.magnetUntilMs && ps - car.s <= sim.rules.magnetMeters && ps - car.s >= -2 && Math.abs(car.lane - seg.pkLane) <= sim.rules.magnetLanes;
    if (near || pulled) collect(sim, seg);
  }
}

/** Hit and pickup tests for the segments around the car, then settle segments it has left. */
export function interact(sim: Sim, nowMs: number): void {
  const carSeg = Math.floor(sim.car.s / sim.segLen);
  for (let j = carSeg - 1; j <= carSeg + 1; j++) if (j >= 0 && hasSeg(sim.track, j)) touch(sim, segAt(sim.track, j), nowMs);
  // Magnet reaches further ahead than the neighbouring segments.
  if (nowMs < sim.power.magnetUntilMs) {
    const reach = Math.ceil(sim.rules.magnetMeters / sim.segLen);
    for (let j = carSeg + 2; j <= carSeg + reach; j++) if (hasSeg(sim.track, j)) touch(sim, segAt(sim.track, j), nowMs);
  }
  while (sim.passedIdx < carSeg - 2) {
    sim.passedIdx++;
    if (!hasSeg(sim.track, sim.passedIdx)) continue;
    const seg = segAt(sim.track, sim.passedIdx);
    if (seg.hz >= 0 && seg.hzState === HZ_ALIVE) {
      sim.dodged++;
      seg.hzState = HZ_PASSED;
    }
    if (seg.pk >= 0 && seg.pkState === HZ_ALIVE) seg.pkState = HZ_PASSED;
  }
}

