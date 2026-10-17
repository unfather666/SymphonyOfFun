// Brains are data (content/brains.json): named states with a duration and a next state. Compiled to numbers once.
import type { BrainDef, CBrain, CState } from './types';

export const STATE_KINDS = ['idle', 'wander', 'chase', 'strafe', 'shoot', 'flee', 'burst', 'split'] as const;

export function compileBrains(defs: readonly BrainDef[]): { brains: Map<string, CBrain>; errors: string[] } {
  const brains = new Map<string, CBrain>();
  const errors: string[] = [];
  for (const d of defs) {
    const names = Object.keys(d.states);
    const ix = new Map(names.map((n, i) => [n, i]));
    const bad: string[] = [];
    if (!ix.has(d.start)) bad.push(`start state "${d.start}" does not exist`);
    const states: CState[] = [];
    for (const n of names) {
      const s = d.states[n]!;
      const kind = STATE_KINDS.indexOf(s.kind as (typeof STATE_KINDS)[number]);
      if (kind < 0) bad.push(`state "${n}" has unknown kind "${s.kind}"`);
      if (!ix.has(s.next)) bad.push(`state "${n}" goes to missing state "${s.next}"`);
      if (s.nearTo !== undefined && !ix.has(s.nearTo)) bad.push(`state "${n}" nearTo missing state "${s.nearTo}"`);
      states.push({
        kind, ms: s.ms, next: ix.get(s.next) ?? 0, speedMul: s.speedMul ?? 1, dist: s.dist ?? 0, zig: s.zig ?? 0,
        nearR: s.nearR ?? 0, nearTo: s.nearTo !== undefined ? (ix.get(s.nearTo) ?? -1) : -1,
      });
    }
    if (bad.length) errors.push(`brain "${d.id}" dropped: ${bad.join('; ')}.`);
    else brains.set(d.id, { start: ix.get(d.start)!, states });
  }
  return { brains, errors };
}
