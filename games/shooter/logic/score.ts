// Scoring: kill value x combo multiplier, plus level clear bonus. Pure functions on the world; unlock tables live in unlocks.ts.
import type { World } from './types';

/** Combo state is kept on the world (comboCount, comboUntil); the madness tier adds to the multiplier. */
export function awardKill(w: World, base: number, _tier: number): void {
  void _tier;
  w.score += Math.round(base * comboMultiplier(w));
}

export function comboMultiplier(w: World): number {
  return 1;
}

export function clearBonus(w: World): number {
  const r = w.rules;
  const left = Math.max(0, r.clear_par_ms - (w.now - w.startedAt));
  return Math.round(w.player.hp * r.clear_hp_bonus + (left / 1000) * r.clear_time_per_s);
}
