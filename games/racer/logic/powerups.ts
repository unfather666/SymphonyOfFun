// Pickups and the one held power-up. Effects come from the def's numbers, not from the def's id.
import { breakHazard } from './breakage';
import { FX_COIN, FX_POWER, FX_USE, pushFx } from './fx';
import { hazardLane } from './hazards';
import type { Sim } from './simtypes';
import { hasSeg, segAt } from './track';
import { HZ_ALIVE, HZ_BROKEN, type Segment } from './types';

export function collect(sim: Sim, seg: Segment): void {
  const def = sim.powers[seg.pk]!;
  seg.pkState = HZ_BROKEN;
  if (def.coin) {
    sim.coins++;
    pushFx(sim.fx, FX_COIN);
    return;
  }
  sim.power.held = seg.pk;
  pushFx(sim.fx, FX_POWER);
}

/** Clear hazards in the next `ahead` beats: all of them, or only the hornable ones. */
function clearAhead(sim: Sim, ahead: number, hornableOnly: boolean, nowMs: number): void {
  const carSeg = Math.floor(sim.car.s / sim.segLen);
  const beatMs = sim.beat.periodMs;
  for (let j = carSeg + 1; j <= carSeg + ahead; j++) {
    if (!hasSeg(sim.track, j)) continue;
    const seg = segAt(sim.track, j);
    if (seg.hz < 0 || seg.hzState !== HZ_ALIVE) continue;
    const d = sim.hazards[seg.hz]!;
    if (hornableOnly && !d.hornable) continue;
    breakHazard(sim, seg, hazardLane(d, seg, nowMs, beatMs));
  }
}

export function usePower(sim: Sim, nowMs: number): void {
  const idx = sim.power.held;
  if (idx < 0) return;
  const def = sim.powers[idx]!;
  const car = sim.car;
  sim.power.held = -1;
  if (def.heal > 0) car.health = Math.min(sim.rules.healthMax, car.health + def.heal);
  if (def.speedMul !== 1) {
    car.boostUntilMs = nowMs + def.durationMs;
    car.boostMul = def.speedMul;
  }
  if (def.invulnMinor) sim.power.invulnUntilMs = nowMs + def.durationMs;
  if (def.shield > 0) {
    sim.power.shieldCharges += def.shield;
    sim.power.shieldUntilMs = nowMs + def.durationMs;
  }
  if (def.magnet) sim.power.magnetUntilMs = nowMs + def.durationMs;
  if (def.clearAhead > 0) clearAhead(sim, def.clearAhead, def.clearHornable, nowMs);
  pushFx(sim.fx, FX_USE);
}
