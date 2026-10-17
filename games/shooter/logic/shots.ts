// The default shot (Rivet bolt) from content/rules.json until a rig is resolved.
import type { Rules } from './rules';
import type { ShotSpec } from './types';

export function DEFAULT_SHOT(r: Rules): ShotSpec {
  return {
    shots: [
      { projectile: 'bolt', damage: r.shot_damage, rateMs: r.shot_rate_ms, speed: r.shot_speed, count: 1, spread: 0.05, pierce: 0, bounce: 0, homing: 0, size: r.shot_size, knockback: 0, element: 'none', lifeMs: r.shot_life_ms, dirs: 1, selfMadness: 0 },
    ],
    onHit: 0,
    onKill: 0,
  };
}
