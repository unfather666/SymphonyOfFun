// Witnesses: people within range and line of sight roll to notice a fart; each notice adds to their own intolerance.
import { lineClear } from './map';
import { PS_STARTLED } from './types';
import type { Sim } from './sim';

/** Intolerance one notice adds: the kind's value, doubled when the person was pushed by the same fart. */
export function intolFor(base: number, pushed: boolean, pushedMult: number): number {
  return pushed ? base * pushedMult : base;
}

export function witnessFart(sim: Sim, kind: number, x: number, y: number, radiusMul: number, noticeMul = 1, intolMul = 1): void {
  const { rules, farts, map, rng } = sim.deps;
  const def = farts[kind]!;
  const range = def.witnessRadius * radiusMul;
  const r2 = range * range;
  const w = rules.witness;
  const loud = kind === farts.length - 1;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    const dx = p.x - x, dy = p.y - y;
    if (dx * dx + dy * dy > r2 || !lineClear(map, x, y, p.x, p.y)) continue;
    if (!rng.notice.chance(def.notice * noticeMul)) continue;
    const add = intolFor(def.intol, p.pushedAt === sim.now, w.pushedMult) * intolMul;
    p.intol = Math.min(w.maxIntol, p.intol + add);
    sim.meters.intolToday += add;
    sim.meters.stress = Math.min(rules.stress.max, sim.meters.stress + add * rules.stress.perIntol);
    p.state = PS_STARTLED;
    p.until = sim.now + w.startledMs;
    p.flees = loud || sim.meters.reputation < rules.reputation.fleeBelow;
    sim.deps.emit('mrfart:witnessed', { person: p.idx, kind, intol: add });
  }
}
