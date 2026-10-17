// Level arithmetic: bars from seconds, segment length from speed and tempo, the intensity curve. Pure.
import type { LevelDef, Rules } from './types';

export function levelBars(seconds: number, bpm: number, meter: number): number {
  return Math.round(((seconds * bpm) / 60) / meter);
}

/** Cruise speed (m/s): the speed at which the car crosses exactly one segment per beat. */
export function cruiseSpeed(level: LevelDef, rules: Rules): number {
  return rules.cruiseFrac * level.maxSpeed;
}

export function segmentLength(level: LevelDef, rules: Rules, bpm: number): number {
  return (cruiseSpeed(level, rules) * 60) / bpm;
}

/**
 * 0.3 → 1.0 over the first half, a break (0.4) after 55%..65%, then 1.0. `section` is 0-based of `sections`.
 * Drives hazard weight and which music roles play.
 */
export function intensityAt(section: number, sections: number): number {
  if (sections <= 1) return 1;
  const f = section / (sections - 1);
  if (f < 0.5) return 0.3 + (0.7 * f) / 0.5;
  if (f >= 0.55 && f < 0.65) return 0.4;
  return 1;
}
