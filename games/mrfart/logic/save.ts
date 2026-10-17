// Save sections: `progress` (what carries over) and `options`. Pure: the wiring layer registers them with core and decides when to save.
import { dayIndexAt } from './clock';
import type { Sim } from './sim';

export const PROGRESS_VERSION = 2;
export const OPTIONS_VERSION = 1;

export interface Progress {
  tasksDone: number;
  reputation: number;
  coins: number;
  /** Item ids held. */
  items: string[];
  /** In-game day number. */
  dayIndex: number;
  /** Each person's own counter, by person index. */
  intolerance: number[];
}
export interface Options {
  /** Show the first-seconds hints. */
  hints: boolean;
}

export const defaultOptions = (): Options => ({ hints: true });

const num = (v: unknown, lo: number, hi: number, dflt: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

/** Bring older data up: v1 only had tasksDone, reputation and coins. */
export function migrateProgress(data: unknown, from: number): Progress {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (from < 2) return { tasksDone: num(d.tasksDone, 0, 1e6, 0), reputation: num(d.reputation, 0, 100, 70), coins: num(d.coins, 0, 1e9, 0), items: [], dayIndex: 0, intolerance: [] };
  return d as unknown as Progress;
}

export function serializeProgress(sim: Sim): Progress {
  return {
    tasksDone: sim.progress.tasksDone,
    reputation: sim.meters.reputation,
    coins: sim.progress.coins,
    items: sim.inv.items.map((i) => sim.deps.items[i]!.id),
    dayIndex: sim.day,
    intolerance: sim.people.map((p) => p.intol),
  };
}

/** Put saved progress into a fresh sim. Bad values are clamped or dropped; the game still starts. */
export function applyProgress(sim: Sim, raw: unknown): void {
  const { rules } = sim.deps;
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Progress>;
  sim.progress.tasksDone = Math.floor(num(d.tasksDone, 0, 1e6, 0));
  sim.progress.coins = Math.floor(num(d.coins, 0, 1e9, 0));
  sim.meters.reputation = num(d.reputation, 1, rules.reputation.max, rules.reputation.start);
  sim.dayBase = Math.floor(num(d.dayIndex, 0, 1e6, 0));
  sim.day = sim.dayBase + dayIndexAt(sim.now, rules.world.dayMs, rules.world.startHour);
  sim.inv.items.length = 0;
  if (Array.isArray(d.items))
    for (const id of d.items) {
      const idx = sim.deps.items.findIndex((x) => x.id === id);
      if (idx >= 0 && sim.inv.items.length < rules.items.max && !(sim.deps.items[idx]!.cursed && sim.inv.items.includes(idx))) sim.inv.items.push(idx);
    }
  sim.inv.sel = 0;
  const intol = Array.isArray(d.intolerance) ? d.intolerance : [];
  for (let i = 0; i < sim.people.length; i++) sim.people[i]!.intol = Math.floor(num(intol[i], 0, rules.witness.maxIntol, 0));
}

export function sanitizeOptions(raw: unknown): Options {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Options>;
  return { hints: typeof d.hints === 'boolean' ? d.hints : true };
}
