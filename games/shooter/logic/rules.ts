// content/rules.json: every tunable number, with its allowed range and a safe fallback.
// parseRules never throws: a missing or out-of-range value is replaced by the fallback and reported in plain English.
// [min, max, fallback]
export const RULE_LIMITS = {
  player_speed: [20, 300, 90],
  player_hp: [1, 1000, 100],
  player_half: [2, 8, 5],
  iframe_ms: [0, 3000, 700],
  dash_dist: [8, 200, 48],
  dash_ms: [50, 1000, 250],
  dash_cd_ms: [100, 10000, 1200],
  flare_ms: [500, 30000, 5000],
  flare_start: [0, 20, 3],
  flare_max: [0, 20, 9],
  lantern_r: [30, 300, 120],
  lantern_spread_deg: [10, 80, 38],
  lantern_glow_r: [10, 80, 30],
  cap_enemies: [1, 400, 200],
  cap_bullets: [1, 1024, 512],
  cap_particles: [0, 1024, 256],
  cap_pickups: [1, 256, 64],
  cap_ghosts: [0, 64, 16],
  cap_lights: [1, 128, 32],
  grid_cell: [8, 128, 32],
  water_slow: [0.1, 1, 0.5],
  shot_damage: [1, 500, 8],
  shot_rate_ms: [30, 3000, 220],
  shot_speed: [30, 1200, 260],
  shot_life_ms: [50, 5000, 900],
  shot_size: [1, 24, 3],
  ebullet_life_ms: [200, 10000, 3500],
  ebullet_size: [1, 12, 3],
  hit_flash_ms: [0, 500, 80],
  kill_shake_px: [0, 8, 1],
  hurt_shake_px: [0, 8, 2],
  burn_dps: [0, 200, 6],
  burn_ms: [100, 10000, 2000],
  freeze_ms: [100, 10000, 1500],
  freeze_slow: [0.05, 1, 0.4],
  blind_ms: [100, 10000, 2000],
  pull_speed: [20, 800, 220],
  chain_range: [10, 300, 60],
  chain_mul: [0.05, 2, 0.5],
  heal_on_kill: [0, 100, 5],
  overdrive_ms: [100, 20000, 3000],
  overdrive_rate_mul: [0.2, 1, 0.6],
  elite_hp_mul: [1, 10, 2],
  elite_every: [2, 100, 12],
  madness_decay_per_s: [0, 50, 4],
  madness_decay_ambient_max: [0, 1, 0.6],
  madness_t1: [1, 100, 20],
  madness_t2: [1, 100, 40],
  madness_t3: [1, 100, 60],
  madness_t4: [1, 100, 80],
  madness_t5: [1, 100, 95],
  invert_ms: [100, 5000, 1500],
  invert_gap_min_ms: [1000, 60000, 6000],
  invert_gap_max_ms: [1000, 60000, 10000],
  invert_warn_ms: [50, 2000, 300],
  t5_mult: [1, 10, 3],
  t5_radius: [10, 120, 40],
  t5_brightness: [0, 1, 0.1],
  eye_range: [30, 400, 140],
  eye_cone_deg: [10, 180, 60],
  eye_turn_deg_s: [0, 360, 45],
  combo_window_ms: [200, 10000, 2000],
  combo_step: [0, 1, 0.25],
  combo_max: [0, 40, 4],
  tier_mult: [0, 1, 0.25],
  clear_hp_bonus: [0, 100, 10],
  clear_par_ms: [1000, 600000, 120000],
  clear_time_per_s: [0, 100, 5],
  unlock_mult: [1, 10000, 120],
  ghost_life_ms: [200, 20000, 3000],
  ambient_blackout: [0, 1, 0.98],
  ambient_flare: [0, 1, 0.25],
  spot_ambient: [0, 1, 0.97],
  restart_delay_ms: [200, 10000, 1500],
  boss_hp_mul: [0.1, 10, 1],
  wave_gap_ms: [0, 10000, 600],
  spawn_ring_min: [16, 400, 80],
  pickup_life_ms: [1000, 120000, 20000],
  drop_pickup_r: [4, 40, 10],
  ghost_gap_ms: [200, 20000, 1800],
  ghost_speed: [5, 120, 22],
  whisper_gap_ms: [1000, 60000, 5000],
  pulse_ms: [300, 3000, 900],
  pulse_amount: [0, 0.4, 0.12],
} as const satisfies Record<string, readonly [number, number, number]>;

export type RuleKey = keyof typeof RULE_LIMITS;
export type Rules = Record<RuleKey, number>;

export function parseRules(raw: unknown): { rules: Rules; errors: string[] } {
  const errors: string[] = [];
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (src !== raw) errors.push('rules: content/rules.json is not an object; using built-in fallbacks.');
  const rules = {} as Rules;
  for (const key of Object.keys(RULE_LIMITS) as RuleKey[]) {
    const [min, max, fallback] = RULE_LIMITS[key];
    const v = src[key];
    if (v === undefined) {
      errors.push(`rules: "${key}" is missing; using ${fallback}.`);
      rules[key] = fallback;
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`rules: "${key}" must be a number; using ${fallback}.`);
      rules[key] = fallback;
    } else if (v < min || v > max) {
      errors.push(`rules: "${key}" is ${v}, outside ${min}..${max}; using ${fallback}.`);
      rules[key] = fallback;
    } else rules[key] = v;
  }
  for (const k of Object.keys(src)) if (!(k in RULE_LIMITS)) errors.push(`rules: unknown key "${k}" ignored.`);
  return { rules, errors };
}
