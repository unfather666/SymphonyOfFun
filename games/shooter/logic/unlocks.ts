// What the player may use: slots by level, weapon sets by points or levels, level gates by points.
import type { ItemDef } from './rig';

export interface Unlocks {
  /** Points needed per set 1..15 (index = set - 1). */
  setPoints: number[];
  /** Highest level cleared needed for each forbidden set, keyed by set number (16..20). */
  setLevels: Record<string, number>;
  /** Highest level cleared for each extra slot (5 entries: slots 2..6). */
  slotLevels: number[];
  startItems: string[];
}

/** Points needed to play level n (1-based): (n-1)^2 x mult, so level 1 is free. */
export function levelPoints(n: number, mult: number): number {
  return (n - 1) * (n - 1) * mult;
}

export function levelPlayable(n: number, totalPoints: number, mult: number): boolean {
  return n >= 1 && n <= 100 && totalPoints >= levelPoints(n, mult);
}

export function slotsFor(highestCleared: number, u: Unlocks): number {
  let n = 1;
  for (const lv of u.slotLevels) if (highestCleared >= lv) n++;
  return n;
}

export function setUnlocked(set: number, totalPoints: number, highestCleared: number, u: Unlocks): boolean {
  if (set >= 1 && set <= 15) return totalPoints >= (u.setPoints[set - 1] ?? Infinity);
  const need = u.setLevels[String(set)];
  return need !== undefined && highestCleared >= need;
}

/** Item ordinals (index into `items`) a boss or elite may drop: unlocked sets, not owned yet. */
export function dropPool(items: readonly ItemDef[], owned: readonly string[], totalPoints: number, highestCleared: number, u: Unlocks): number[] {
  const out: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (!owned.includes(it.id) && setUnlocked(it.set, totalPoints, highestCleared, u)) out.push(i);
  }
  return out;
}
