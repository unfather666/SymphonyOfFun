// Scoring: kill value x (1 + combo steps x combo_step + madness tier x tier_mult), x t5_mult at madness 5; level clear bonus.
import { tierOf } from './madness';
import type { World } from './types';

export function awardKill(w: World, base: number): void {
  const r = w.rules;
  if (w.now > w.comboUntil) w.combo = 0;
  w.combo = Math.min(r.combo_max + 1, w.combo + 1);
  w.comboUntil = w.now + r.combo_window_ms;
  w.score += Math.round(base * killMultiplier(w));
}

/** Multiplier for a kill made right now with the current combo count. */
export function killMultiplier(w: World): number {
  const r = w.rules;
  const tier = tierOf(w.madness, r);
  const m = 1 + Math.max(0, w.combo - 1) * r.combo_step + tier * r.tier_mult;
  return tier >= 5 ? m * r.t5_mult : m;
}

export function clearBonus(w: World): number {
  const r = w.rules;
  const left = Math.max(0, r.clear_par_ms - (w.now - w.startedAt));
  return Math.round(w.player.hp * r.clear_hp_bonus + (left / 1000) * r.clear_time_per_s);
}
