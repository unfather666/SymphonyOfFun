// Score: distance + synced beats + hazards dodged + pieces broken + coins - deaths. Kept on its own so the formula is one place.
import type { Sim } from './simtypes';

export function scoreOf(sim: Sim): number {
  const r = sim.rules;
  const s = Math.floor(sim.distance) + sim.syncedBeats * r.syncScore + sim.dodged * r.dodgeScore + sim.broken * r.pieceScore + sim.coins * r.coinValue - sim.deaths * r.deathScore;
  return s < 0 ? 0 : s;
}
