// Endings: how a run stops. The matching ending with the lowest `order` for the trigger wins; any one `need*` condition is enough.
import { cursedHeld, holds, itemIndex } from './items';
import { STATUS_LOST, STATUS_PLAYING, STATUS_WON } from './types';
import type { Sim } from './sim';

export interface EndingDef {
  readonly id: string;
  readonly order: number;
  readonly trigger: 'rep_zero' | 'clench' | 'tasks';
  readonly needItem?: string;
  readonly needForce?: number;
  readonly needLoudInShop?: number;
  readonly needCell?: string;
  readonly needTasks?: number;
  readonly needCursed?: number;
  readonly win?: boolean;
}

export interface RunStats {
  /** Loud farts in a shop cell since midnight. */
  loudInShop: number;
  /** A fart in the harbour cell since midnight. */
  harbourFart: boolean;
  /** Strongest fart since midnight. */
  maxForce: number;
}

export const newStats = (): RunStats => ({ loudInShop: 0, harbourFart: false, maxForce: 0 });

export function endingMatches(sim: Sim, e: EndingDef): boolean {
  const st = sim.stats;
  let any = false, ok = false;
  if (e.needItem !== undefined) { any = true; ok = ok || holds(sim, itemIndex(sim, e.needItem)); }
  if (e.needForce !== undefined) { any = true; ok = ok || st.maxForce >= e.needForce; }
  if (e.needLoudInShop !== undefined) { any = true; ok = ok || st.loudInShop >= e.needLoudInShop; }
  if (e.needCell !== undefined) { any = true; ok = ok || (e.needCell === 'harbour' && st.harbourFart); }
  if (e.needTasks !== undefined) { any = true; ok = ok || sim.progress.tasksDone >= e.needTasks; }
  if (e.needCursed !== undefined) { any = true; ok = ok || cursedHeld(sim) >= e.needCursed; }
  return !any || ok;
}

/** Id of the first ending for this trigger whose condition holds. */
export function chooseEnding(sim: Sim, trigger: EndingDef['trigger']): string {
  let best: EndingDef | null = null;
  for (const e of sim.deps.endings) if (e.trigger === trigger && (best === null || e.order < best.order) && endingMatches(sim, e)) best = e;
  return best ? best.id : 'pitchforks';
}

/** The one door that stops a run. */
export function endRun(sim: Sim, id: string): boolean {
  if (sim.status !== STATUS_PLAYING) return false;
  const def = sim.deps.endings.find((e) => e.id === id);
  if (!def) return false;
  sim.status = def.win ? STATUS_WON : STATUS_LOST;
  sim.ending = id;
  sim.deps.emit(def.win ? 'mrfart:game_won' : 'mrfart:game_over', { ending: id });
  return true;
}
