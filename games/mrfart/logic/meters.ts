// Fart meter and stress. The meter fills by distance walked, by stress and while clenching; it empties as farts.
// Clench holds a fart back (stress up, meter keeps rising to clenchMax); release is always a bigger, loud fart.
import { chooseEnding, endRun } from './endings';
import { doFart, kindForMeter } from './farts';
import { gainMul, noFartActive } from './items';
import { checkLost } from './reputation';
import type { Sim } from './sim';
import type { SimInput } from './types';

const DT = 1 / 60;

export function scheduleRoll(sim: Sim): void {
  const m = sim.deps.rules.meter;
  sim.meters.nextRollAt = sim.now + sim.deps.rng.fart.range(m.randomMinMs, m.randomMaxMs);
}

/** Distance-based fill for one step (pure; exported for tests). */
export function walkFill(movedPx: number, running: boolean, perPx: number, runMult: number): number {
  return movedPx * perPx * (running ? runMult : 1);
}

/** Random-roll probability: meter/randomDiv, scaled up by stress (design 4.2). */
export function rollChance(meter: number, stress: number, randomDiv: number): number {
  return (meter / randomDiv) * (1 + stress / 100);
}

/** Force multiplier for releasing a clench held `heldMs`. */
export function clenchForce(heldMs: number, bonus: number, bonusMs: number): number {
  return 1 + Math.min(1, heldMs / bonusMs) * bonus;
}

function stepStress(sim: Sim, clenching: boolean): void {
  const { rules } = sim.deps;
  const s = rules.stress;
  const m = sim.meters;
  let d = 0;
  if (m.reputation < s.lowRepBelow) d += ((s.lowRepBelow - m.reputation) / s.lowRepBelow) * s.lowRepRate * DT;
  if (sim.watchers === 0) d -= s.aloneDecay * DT;
  if (clenching) d += s.clenchRate * DT;
  m.stress = Math.min(s.max, Math.max(0, m.stress + d));
}

export function stepMeters(sim: Sim, input: SimInput): void {
  const { rules, farts, rng } = sim.deps;
  const mr = rules.meter;
  const m = sim.meters;
  const clenching = input.clench;
  let fill = walkFill(sim.player.moved, input.run, mr.perPx, mr.runMult) * gainMul(sim);
  if (m.stress > mr.stressFartAbove) fill += mr.stressRate * DT;
  if (clenching) {
    if (m.clenchSince < 0) m.clenchSince = sim.now;
    fill += mr.clenchRate * DT;
  }
  m.fart = Math.min(clenching ? mr.clenchMax : mr.max, m.fart + fill);
  stepStress(sim, clenching);
  checkLost(sim);
  const corked = noFartActive(sim);
  if (sim.inv.corkOwed && !corked) {
    sim.inv.corkOwed = false;
    doFart(sim, farts.length - 1);
    return;
  }
  const ready = sim.now - m.lastFartAt >= rules.fart.cooldownMs && !corked;

  if (clenching) {
    if (!m.ballooned && sim.now - m.clenchSince >= mr.balloonMs) {
      m.ballooned = true;
      sim.deps.emit('mrfart:balloon', { reputation: Math.round(m.reputation) });
      endRun(sim, chooseEnding(sim, 'clench'));
    }
    return;
  }
  if (m.clenchSince >= 0) {
    const held = sim.now - m.clenchSince;
    m.clenchSince = -1;
    m.ballooned = false;
    if (held >= mr.clenchMinMs && !corked) {
      doFart(sim, farts.length - 1, clenchForce(held, mr.clenchBonus, mr.clenchBonusMs));
      return;
    }
  }
  if (m.fart >= mr.max) {
    if (ready) doFart(sim, kindForMeter(farts, m.fart));
    return;
  }
  if (sim.now >= m.nextRollAt) {
    scheduleRoll(sim);
    if (ready && rng.fart.chance(rollChance(m.fart, m.stress, mr.randomDiv))) doFart(sim, kindForMeter(farts, m.fart));
  }
}
