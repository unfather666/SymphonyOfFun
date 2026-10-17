// The rig: up to 6 slots of items resolved into a shot. Pure; tested on fixed combos with exact numbers.
import { HIT_NAMES, KILL_NAMES } from './effects';
import type { Shot, ShotSpec } from './types';

export const SLOTS = 6;
export const PRESETS = 3;

export interface ItemDef {
  id: string;
  tags: readonly string[];
  set: number;
  kind: 'core' | 'mod' | 'aux';
  projectile?: Shot['projectile'];
  damage?: number;
  rateMs?: number;
  speed?: number;
  count?: number;
  spread?: number;
  lifeMs?: number;
  size?: number;
  pierce?: number;
  bounce?: number;
  knockback?: number;
  element?: Shot['element'];
  dirs?: number;
  selfMadness?: number;
  homing?: number;
  damageMul?: number;
  rateMul?: number;
  speedMul?: number;
  sizeMul?: number;
  lifeMul?: number;
  countAdd?: number;
  spreadAdd?: number;
  pierceAdd?: number;
  bounceAdd?: number;
  knockbackAdd?: number;
  onHit?: (typeof HIT_NAMES)[number];
  onKill?: (typeof KILL_NAMES)[number];
}

const r2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const whole = (x: number) => Math.floor(x + 0.5);

function coreShot(c: ItemDef | null, fallback: Shot): Shot {
  const s: Shot = { ...fallback };
  if (!c) return s;
  s.projectile = c.projectile ?? s.projectile;
  s.damage = c.damage ?? s.damage;
  s.rateMs = c.rateMs ?? s.rateMs;
  s.speed = c.speed ?? s.speed;
  s.count = c.count ?? s.count;
  s.spread = c.spread ?? s.spread;
  s.lifeMs = c.lifeMs ?? s.lifeMs;
  s.size = c.size ?? s.size;
  s.pierce = c.pierce ?? 0;
  s.bounce = c.bounce ?? 0;
  s.knockback = c.knockback ?? 0;
  s.element = c.element ?? 'none';
  s.dirs = c.dirs ?? 1;
  s.selfMadness = c.selfMadness ?? 0;
  s.homing = c.homing ?? 0;
  return s;
}

/**
 * Cores define shots (several cores alternate), mods fold over every shot in slot order
 * (adds add, multipliers multiply, element and homing: last one wins), aux add effects.
 * With no core the fallback shot is used.
 */
export function resolveRig(items: readonly ItemDef[], fallback: Shot): ShotSpec {
  const cores = items.filter((i) => i.kind === 'core');
  const shots: Shot[] = [];
  for (const core of cores.length ? cores : [null]) {
    const s = coreShot(core, fallback);
    for (const m of items) {
      if (m.kind !== 'mod') continue;
      s.damage *= m.damageMul ?? 1;
      s.rateMs *= m.rateMul ?? 1;
      s.speed *= m.speedMul ?? 1;
      s.size *= m.sizeMul ?? 1;
      s.lifeMs *= m.lifeMul ?? 1;
      s.count += m.countAdd ?? 0;
      s.spread += m.spreadAdd ?? 0;
      s.pierce += m.pierceAdd ?? 0;
      s.bounce += m.bounceAdd ?? 0;
      s.knockback += m.knockbackAdd ?? 0;
      if (m.homing !== undefined) s.homing = m.homing;
      if (m.element !== undefined) s.element = m.element;
    }
    s.damage = r2(Math.max(0.5, s.damage));
    s.rateMs = r2(Math.max(40, s.rateMs));
    s.speed = r2(Math.max(20, s.speed));
    s.size = r2(Math.max(1, s.size));
    s.lifeMs = r2(Math.max(50, s.lifeMs));
    s.count = clamp(whole(s.count), 1, 12);
    s.spread = r2(Math.max(0, s.spread));
    s.pierce = Math.max(0, whole(s.pierce));
    s.bounce = Math.max(0, whole(s.bounce));
    s.knockback = r2(Math.max(0, s.knockback));
    s.homing = r2(clamp(s.homing, 0, 1.5));
    shots.push(s);
  }
  let onHit = 0;
  let onKill = 0;
  for (const a of items) {
    if (a.kind !== 'aux') continue;
    if (a.onHit) onHit |= 1 << HIT_NAMES.indexOf(a.onHit);
    if (a.onKill) onKill |= 1 << KILL_NAMES.indexOf(a.onKill);
  }
  return { shots, onHit, onKill };
}

// ---- slots and presets ----

export interface Progress {
  ownedItems: string[];
  /** PRESETS lists of SLOTS entries: an item id or null. */
  presets: Array<Array<string | null>>;
  active: number;
  totalPoints: number;
  /** Level numbers cleared at least once, ascending. */
  levelsCleared: number[];
}

export function newProgress(startItems: readonly string[]): Progress {
  const presets: Array<Array<string | null>> = [];
  for (let p = 0; p < PRESETS; p++) presets.push(new Array<string | null>(SLOTS).fill(null));
  presets[0]![0] = startItems[0] ?? null;
  return { ownedItems: [...startItems], presets, active: 0, totalPoints: 0, levelsCleared: [] };
}

/** Why a placement is refused, or null when it is fine. null item clears the slot. */
export function placeItem(pr: Progress, unlockedSlots: number, preset: number, slot: number, itemId: string | null): 'slot_locked' | 'not_owned' | 'in_use' | null {
  if (slot < 0 || slot >= unlockedSlots) return 'slot_locked';
  const list = pr.presets[preset]!;
  if (itemId !== null) {
    if (!pr.ownedItems.includes(itemId)) return 'not_owned';
    for (let s = 0; s < SLOTS; s++) if (s !== slot && list[s] === itemId) return 'in_use';
  }
  list[slot] = itemId;
  return null;
}

export function giveItem(pr: Progress, itemId: string): boolean {
  if (pr.ownedItems.includes(itemId)) return false;
  pr.ownedItems.push(itemId);
  return true;
}

/** The active preset's items in slot order, limited to unlocked slots. */
export function activeItems(pr: Progress, unlockedSlots: number, byId: ReadonlyMap<string, ItemDef>): ItemDef[] {
  const out: ItemDef[] = [];
  const list = pr.presets[pr.active]!;
  for (let s = 0; s < Math.min(SLOTS, unlockedSlots); s++) {
    const id = list[s];
    const it = id ? byId.get(id) : undefined;
    if (it) out.push(it);
  }
  return out;
}

export function cyclePreset(pr: Progress, dir: number): void {
  pr.active = (pr.active + dir + PRESETS) % PRESETS;
}
