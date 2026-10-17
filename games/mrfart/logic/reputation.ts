// Reputation: settled against the day's intolerance at 00:00; people forget half of theirs.
import { chooseEnding, endRun, newStats } from './endings';
import { restock } from './items';
import { lineClear } from './map';
import type { Sim } from './sim';

/** Reputation after a day: minus the intolerance accrued, divided by settleDiv, never below 0. */
export function settledReputation(rep: number, intolToday: number, settleDiv: number): number {
  return Math.max(0, rep - intolToday / settleDiv);
}

export function settleDay(sim: Sim, newDay: number): void {
  const { rules } = sim.deps;
  const m = sim.meters;
  m.reputation = settledReputation(m.reputation, m.intolToday, rules.witness.settleDiv);
  m.intolToday = 0;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    p.intol = Math.floor(p.intol * (1 - rules.witness.forget));
  }
  sim.day = newDay;
  sim.deps.emit('mrfart:midnight', { day: newDay, reputation: Math.round(m.reputation * 10) / 10 });
  checkLost(sim);
  sim.stats = newStats();
  restock(sim);
}

export function checkLost(sim: Sim): void {
  if (sim.meters.reputation <= 0) endRun(sim, chooseEnding(sim, 'rep_zero'));
}

/** Count people close enough with a clear view; refreshed every few steps. */
export function stepWatchers(sim: Sim): void {
  const { rules, map } = sim.deps;
  if ((sim.steps - 1) % rules.witness.watchEvery !== 0) return;
  const r2 = rules.stress.watchRadius * rules.stress.watchRadius;
  let n = 0;
  const pl = sim.player;
  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    const dx = p.x - pl.x, dy = p.y - pl.y;
    if (dx * dx + dy * dy <= r2 && lineClear(map, pl.x, pl.y, p.x, p.y)) n++;
  }
  sim.watchers = n;
}
