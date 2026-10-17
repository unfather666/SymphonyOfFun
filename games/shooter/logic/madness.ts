// Madness 0..100: raised by auras, eyes and some weapons, decays in lit rooms. Tier 4 inverts the move axis in seeded bursts.
import { CUE } from './cues';
import { DT } from './consts';
import type { Rules } from './rules';
import type { World } from './types';
import { cue } from './world';

/** 0 below the first threshold, else 1..5. */
export function tierOf(m: number, r: Rules): number {
  return m >= r.madness_t5 ? 5 : m >= r.madness_t4 ? 4 : m >= r.madness_t3 ? 3 : m >= r.madness_t2 ? 2 : m >= r.madness_t1 ? 1 : 0;
}

/** Add `perSecond` for this step (auras, eyes). Marks the step as having a source, which stops decay. */
export function drain(w: World, perSecond: number): void {
  w.madnessIn += perSecond * DT;
  w.madness = Math.min(100, w.madness + perSecond * DT);
}

/** One-off gain (a shot that costs sanity). Also stops decay this step. */
export function gain(w: World, amount: number): void {
  w.madnessIn += amount;
  w.madness = Math.min(100, w.madness + amount);
}

const nextGap = (w: World) => w.now + w.rules.invert_gap_min_ms + w.madRng.float() * (w.rules.invert_gap_max_ms - w.rules.invert_gap_min_ms);

/** End of step: decay when nothing fed it and the room is lit enough; run the inversion machine. */
export function updateMadness(w: World): void {
  const r = w.rules;
  if (w.madnessIn === 0 && w.light.ambient <= r.madness_decay_ambient_max) w.madness = Math.max(0, w.madness - r.madness_decay_per_s * DT);
  const inv = w.inv;
  if (tierOf(w.madness, r) < 4) {
    inv.phase = 0;
    inv.at = 0;
    return;
  }
  if (inv.phase === 0) {
    if (inv.at === 0) inv.at = nextGap(w);
    else if (w.now >= inv.at) {
      inv.phase = 1;
      inv.at = w.now + r.invert_warn_ms;
      cue(w, CUE.invertWarn);
    }
  } else if (inv.phase === 1) {
    if (w.now >= inv.at) {
      inv.phase = 2;
      inv.at = w.now + r.invert_ms;
    }
  } else if (w.now >= inv.at) {
    inv.phase = 0;
    inv.at = nextGap(w);
  }
}
