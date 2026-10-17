// Hazards and pickups: placement at generation time (pure, from the level seed) and their moving state. No Sim import.
import { intensityAt } from './level';
import { randFloat, seedRand, type Rand } from './rng';
import { HZ_ALIVE, HZ_NONE, type HazardDef, type PowerDef, type Rules, type Segment } from './types';
import { isBreak } from './songgen';
import type { GenState } from './trackgen';

export interface HazardCtx {
  defs: readonly HazardDef[];
  /** Theme weight per def (0 = never in this theme). */
  weights: Float64Array;
  powers: readonly PowerDef[];
  sections: number;
  sectionBeats: number;
  meter: number;
}

export function hazardWeights(defs: readonly HazardDef[], themeWeights: Readonly<Record<string, number>>): Float64Array {
  const w = new Float64Array(defs.length);
  for (let i = 0; i < defs.length; i++) w[i] = themeWeights[defs[i]!.id] ?? 0;
  return w;
}

/** Lane centre for a hazard covering `span` lanes from lane `start` (0..2). Lanes are 2/3 wide in lane units. */
export function laneCentre(start: number, span: number): number {
  return -2 / 3 + start * (2 / 3) + ((span - 1) * (2 / 3)) / 2;
}

function pickDef(hc: HazardCtx, major: boolean, r: Rand): number {
  let total = 0;
  for (let i = 0; i < hc.defs.length; i++) if (hc.defs[i]!.major === major) total += hc.weights[i]!;
  if (total <= 0) return -1;
  let roll = randFloat(r) * total;
  for (let i = 0; i < hc.defs.length; i++) {
    if (hc.defs[i]!.major !== major) continue;
    roll -= hc.weights[i]!;
    if (roll < 0) return i;
  }
  return -1;
}

function pickPower(hc: HazardCtx, r: Rand): number {
  let total = 0;
  for (let i = 0; i < hc.powers.length; i++) total += hc.powers[i]!.weight;
  let roll = randFloat(r) * total;
  for (let i = 0; i < hc.powers.length; i++) {
    roll -= hc.powers[i]!.weight;
    if (roll < 0) return i;
  }
  return 0;
}

/** Decide this segment's hazard and pickup. Uses its own stream (salt 2) so the road itself never changes. */
export function genHazard(seg: Segment, st: GenState, index: number, ctx: { seed: number; rules: Rules; rand: Rand; hz?: HazardCtx }): void {
  seg.hz = -1;
  seg.hzState = HZ_NONE;
  seg.pk = -1;
  seg.pkState = HZ_NONE;
  const hc = ctx.hz;
  if (!hc) return;
  const r = seedRand(ctx.rand, ctx.seed, index, 2);
  const rules = ctx.rules;
  const section = Math.floor(index / hc.sectionBeats);
  const inten = intensityAt(section, hc.sections);
  const brk = isBreak(section, hc.sections);
  st.sinceHazard++;
  if (index % hc.sectionBeats === 2 && section > 0 && inten >= rules.majorMinIntensity && !brk && randFloat(r) < rules.majorChance) st.majorDue = true;
  const plain = !seg.gap && !seg.ramp && !seg.split && !seg.tunnel && !seg.drop && st.rampBlock === 0 && index >= rules.hazardStartBeat;
  if (plain) {
    let def = -1;
    if (st.majorDue && st.sinceHazard >= rules.minorGapBeats) def = pickDef(hc, true, r);
    if (def >= 0) st.majorDue = false;
    else if (st.sinceHazard >= rules.minorGapBeats && randFloat(r) < rules.minorBase + rules.minorScale * inten * (brk ? 0.3 : 1)) def = pickDef(hc, false, r);
    if (def >= 0) {
      const d = hc.defs[def]!;
      seg.hz = def;
      seg.hzLane = laneCentre(Math.floor(randFloat(r) * (4 - d.span)), d.span);
      seg.hzT = 0.3 + randFloat(r) * 0.4;
      seg.hzPhase = randFloat(r);
      seg.hzState = HZ_ALIVE;
      st.sinceHazard = 0;
    }
  }
  if (seg.hz < 0 && st.sinceHazard >= 2 && !seg.gap && !seg.ramp && !seg.drop && index >= rules.hazardStartBeat && index % hc.meter % 2 === 1 && randFloat(r) < rules.pickupChance) {
    seg.pk = pickPower(hc, r);
    seg.pkLane = laneCentre(Math.floor(randFloat(r) * 3), 1);
    seg.pkT = 0.5;
    seg.pkState = HZ_ALIVE;
  }
}

/** Where a hazard is laterally right now (lane units). Sweepers swing across the road; others stay put. */
export function hazardLane(d: HazardDef, seg: Segment, nowMs: number, beatMs: number): number {
  if (d.motion !== 'sweep') return seg.hzLane;
  return d.sweepAmp * Math.sin(Math.PI * 2 * (nowMs / (d.periodBeats * beatMs) + seg.hzPhase));
}

/** 0..1 position in a periodic hazard's cycle (0 for others). */
export function hazardCycle(d: HazardDef, seg: Segment, nowMs: number, beatMs: number): number {
  if (d.motion === 'static') return 0;
  const c = (nowMs / (d.periodBeats * beatMs) + seg.hzPhase) % 1;
  return c < 0 ? c + 1 : c;
}

/** Can it hurt right now? Static and sweeping hazards always can; periodic ones only inside their window. */
export function hazardActive(d: HazardDef, seg: Segment, nowMs: number, beatMs: number): boolean {
  if (d.motion !== 'periodic') return true;
  const c = hazardCycle(d, seg, nowMs, beatMs);
  return c >= d.activeFrom && c < d.activeTo;
}
