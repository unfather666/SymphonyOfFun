// Items: bought or found. Passive items work while held, the others are used with Y.
import { cellAt } from './map';
import type { Sim } from './sim';

export interface ItemDef {
  readonly id: string;
  readonly cursed: boolean;
  readonly mode: 'passive' | 'timed' | 'day' | 'instant';
  readonly price: number;
  readonly repPerTask?: number;
  readonly durationMs?: number;
  readonly noFart?: boolean;
  readonly witnessMul?: number;
  readonly noticeAdd?: number;
  readonly stressDelta?: number;
  readonly clearIntol?: boolean;
  readonly meterGainMul?: number;
  readonly loudOnly?: boolean;
  readonly squeakyOnly?: boolean;
  readonly key?: number;
  readonly pitch?: number;
  readonly forceMul?: number;
  readonly intolMul?: number;
}

export interface Inventory {
  /** Item def indices held, in pick-up order. Full policy: a new item is refused. */
  items: number[];
  sel: number;
  /** Per item def: game-clock ms until a used timed / day item stops working. */
  until: number[];
  /** Cork released: one loud fart is owed when it runs out. */
  corkOwed: boolean;
  /** Shop stock (item def indices), renewed at midnight. */
  stock: number[];
}

/** What the items change about the next fart. Reused scratch, filled by fartMods. */
export interface FartMods {
  kind: number;
  forceMul: number;
  witnessMul: number;
  noticeMul: number;
  intolMul: number;
  key: number;
  pitch: number;
}
export const newMods = (): FartMods => ({ kind: 0, forceMul: 1, witnessMul: 1, noticeMul: 1, intolMul: 1, key: 0, pitch: 0 });

export function createInventory(nItems: number): Inventory {
  return { items: [], sel: 0, until: new Array<number>(nItems).fill(0), corkOwed: false, stock: [] };
}

export const holds = (sim: Sim, idx: number): boolean => sim.inv.items.includes(idx);

export function cursedHeld(sim: Sim): number {
  let n = 0;
  for (const i of sim.inv.items) if (sim.deps.items[i]!.cursed) n++;
  return n;
}

const active = (sim: Sim, i: number): boolean => {
  const d = sim.deps.items[i]!;
  return d.mode === 'passive' ? sim.inv.items.includes(i) : sim.now < sim.inv.until[i]!;
};

/** Fill `out` for a fart that would be of `kind`. Items can force the kind, the force, who notices and the pitch. */
export function fartMods(sim: Sim, kind: number, out: FartMods): FartMods {
  const defs = sim.deps.items;
  const last = sim.deps.farts.length - 1;
  out.kind = kind; out.forceMul = 1; out.witnessMul = 1; out.noticeMul = 1; out.intolMul = 1; out.key = 0; out.pitch = 0;
  for (let i = 0; i < defs.length; i++) {
    if (!active(sim, i)) continue;
    const d = defs[i]!;
    if (d.loudOnly) out.kind = last;
    if (d.squeakyOnly) out.kind = Math.min(1, last);
    if (d.forceMul) out.forceMul *= d.forceMul;
    if (d.witnessMul) out.witnessMul *= d.witnessMul;
    if (d.noticeAdd) out.noticeMul += d.noticeAdd;
    if (d.intolMul) out.intolMul *= d.intolMul;
    if (d.key) out.key = d.key;
    if (d.pitch) out.pitch += d.pitch;
  }
  return out;
}

/** Meter fill multiplier from held items (chili dog). */
export function gainMul(sim: Sim): number {
  let m = 1;
  const defs = sim.deps.items;
  for (let i = 0; i < defs.length; i++) if (defs[i]!.meterGainMul && active(sim, i)) m *= defs[i]!.meterGainMul!;
  return m;
}

/** Reputation extra per finished task (nice shoes). */
export function repPerTask(sim: Sim): number {
  let n = 0;
  const defs = sim.deps.items;
  for (const i of sim.inv.items) n += defs[i]!.repPerTask ?? 0;
  return n;
}

export function noFartActive(sim: Sim): boolean {
  const defs = sim.deps.items;
  for (let i = 0; i < defs.length; i++) if (defs[i]!.noFart && sim.now < sim.inv.until[i]!) return true;
  return false;
}

export function itemIndex(sim: Sim, id: string): number {
  return sim.deps.items.findIndex((d) => d.id === id);
}

/** Add an item. False when the bag is full or a cursed one is already held. */
export function giveItem(sim: Sim, idx: number): boolean {
  const d = sim.deps.items[idx];
  if (!d || sim.inv.items.length >= sim.deps.rules.items.max) return false;
  if (d.cursed && sim.inv.items.includes(idx)) return false;
  sim.inv.items.push(idx);
  return true;
}

export function cycleItem(sim: Sim, dir: number): void {
  const n = sim.inv.items.length;
  if (n === 0) return;
  sim.inv.sel = (sim.inv.sel + (dir < 0 ? n - 1 : 1)) % n;
}

/** Use the selected item. Passive items do nothing; the rest are used up. */
export function useItem(sim: Sim): boolean {
  const inv = sim.inv;
  const idx = inv.items[inv.sel];
  if (idx === undefined) return false;
  const d = sim.deps.items[idx]!;
  if (d.mode === 'passive') return false;
  const m = sim.meters;
  if (d.mode === 'timed') {
    inv.until[idx] = sim.now + (d.durationMs ?? 0);
    if (d.noFart) inv.corkOwed = true;
  } else if (d.mode === 'day') inv.until[idx] = sim.now + sim.deps.rules.world.dayMs;
  else {
    if (d.stressDelta) m.stress = Math.min(sim.deps.rules.stress.max, Math.max(0, m.stress + d.stressDelta));
    if (d.clearIntol) {
      let best = -1;
      for (let i = 0; i < sim.people.length; i++) if (sim.people[i]!.intol > (best < 0 ? 0 : sim.people[best]!.intol)) best = i;
      if (best >= 0) {
        m.intolToday = Math.max(0, m.intolToday - sim.people[best]!.intol);
        sim.people[best]!.intol = 0;
      }
    }
  }
  inv.items.splice(inv.sel, 1);
  if (inv.sel >= inv.items.length) inv.sel = Math.max(0, inv.items.length - 1);
  sim.deps.emit('mrfart:item_used', { item: idx });
  return true;
}

/** After a task: maybe a found item. */
export function rollFound(sim: Sim): void {
  const { items: defs, rules, rng } = sim.deps;
  if (!rng.items.chance(rules.items.findChance)) return;
  const cursed = rng.items.chance(rules.items.cursedChance);
  const pool: number[] = [];
  for (let i = 0; i < defs.length; i++) if (defs[i]!.cursed === cursed && !(cursed && sim.inv.items.includes(i))) pool.push(i);
  if (pool.length === 0) return;
  const idx = pool[rng.items.int(0, pool.length - 1)]!;
  if (giveItem(sim, idx)) sim.deps.emit('mrfart:item_found', { item: idx, cursed });
}

/** The shop's stock for the day. */
export function restock(sim: Sim): void {
  const { items: defs, rules, rng } = sim.deps;
  const pool: number[] = [];
  for (let i = 0; i < defs.length; i++) if (!defs[i]!.cursed && defs[i]!.price > 0) pool.push(i);
  sim.inv.stock.length = 0;
  while (sim.inv.stock.length < rules.items.stock && pool.length > 0) sim.inv.stock.push(pool.splice(rng.items.int(0, pool.length - 1), 1)[0]!);
}

/** Buy stock slot `slot`. False when too poor or the bag is full. */
export function buyItem(sim: Sim, slot: number): boolean {
  const idx = sim.inv.stock[slot];
  if (idx === undefined) return false;
  const price = sim.deps.items[idx]!.price;
  if (sim.progress.coins < price || !giveItem(sim, idx)) return false;
  sim.progress.coins -= price;
  sim.deps.emit('mrfart:item_bought', { item: idx, price });
  return true;
}

/** Is (x,y) inside a cell of this kind (shop, harbour)? */
export function inKind(sim: Sim, kind: string, x: number, y: number): boolean {
  const map = sim.deps.map;
  return map.cells[cellAt(map, x, y)]!.kind === kind;
}
