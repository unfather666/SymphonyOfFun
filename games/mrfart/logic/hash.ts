// State hash for determinism tests: FNV-1a over rounded positions and meters.
import type { Sim } from './sim';

export function stateHash(sim: Sim): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h = Math.imul(h ^ (Math.round(v * 1000) | 0), 0x01000193) >>> 0;
  };
  mix(sim.player.x); mix(sim.player.y); mix(sim.meters.fart); mix(sim.meters.nextRollAt); mix(sim.meters.stress); mix(sim.meters.reputation); mix(sim.meters.intolToday);
  for (const p of sim.people) { mix(p.x); mix(p.y); mix(p.intol); }
  for (const p of sim.props) { mix(p.x); mix(p.y); mix(p.angle); }
  mix(sim.lastFart.count);
  for (const s of sim.subjects) if (s.active) { mix(s.x); mix(s.y); }
  mix(sim.progress.tasksDone);
  return h;
}
