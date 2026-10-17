// Field specs for every def kind. The core loader refuses unknown keys and out-of-range numbers.
import type { Schema } from '../../../src/core/api';

export const ENEMY_SCHEMA: Schema = {
  hp: { type: 'number', min: 1, max: 100000 },
  speed: { type: 'number', min: 0, max: 400 },
  size: { type: 'number', min: 2, max: 32 },
  sprite: { type: 'id' },
  brain: { type: 'id' },
  touchDamage: { type: 'number', min: 0, max: 1000 },
  score: { type: 'number', min: 0, max: 100000, int: true },
  tier: { type: 'number', min: 0, max: 9, int: true },
  flies: { type: 'boolean', optional: true },
  shotSpeed: { type: 'number', min: 10, max: 600, optional: true },
  shotDamage: { type: 'number', min: 0, max: 1000, optional: true },
  shotCount: { type: 'number', min: 1, max: 16, int: true, optional: true },
  shotSpread: { type: 'number', min: 0, max: 6.3, optional: true },
  madnessAura: { type: 'number', min: 0, max: 100, optional: true },
  auraR: { type: 'number', min: 8, max: 300, optional: true },
  splitInto: { type: 'id', optional: true },
  splitCount: { type: 'number', min: 1, max: 8, int: true, optional: true },
  backstab: { type: 'boolean', optional: true },
  gaze: { type: 'boolean', optional: true },
  turnDegS: { type: 'number', min: 1, max: 360, optional: true },
  hidden: { type: 'boolean', optional: true },
  ghostMs: { type: 'number', min: 200, max: 20000, optional: true },
};

export const BRAIN_SCHEMA: Schema = {
  start: { type: 'id' },
  states: { type: 'object' },
};

export const SPRITE_SCHEMA: Schema = {
  w: { type: 'number', min: 1, max: 64, int: true },
  h: { type: 'number', min: 1, max: 64, int: true },
  frames: { type: 'any' },
  keys: { type: 'object', optional: true },
};

export const ROOM_SCHEMA: Schema = {
  rows: { type: 'string[]' },
  waves: { type: 'any' },
  ambient: { type: 'number', min: 0, max: 1 },
  tier: { type: 'number', min: 0, max: 9, int: true },
  script: { type: 'any', optional: true },
};

export const SONG_SCHEMA: Schema = {
  bpm: { type: 'number', min: 30, max: 300 },
  meter: { type: 'number', min: 2, max: 8, int: true, optional: true },
  sections: { type: 'any' },
  loop: { type: 'boolean', optional: true },
};

export const SFX_SCHEMA: Schema = {
  layers: { type: 'any' },
};

const num = (min: number, max: number, int = false) => ({ type: 'number' as const, min, max, int, optional: true });
export const ITEM_SCHEMA: Schema = {
  set: { type: 'number', min: 1, max: 20, int: true },
  kind: { type: 'string', oneOf: ['core', 'mod', 'aux'] },
  projectile: { type: 'string', oneOf: ['bolt', 'beam', 'arc', 'shell', 'wave', 'drone'], optional: true },
  damage: num(0.5, 500),
  rateMs: num(40, 5000),
  speed: num(20, 1200),
  count: num(1, 12, true),
  spread: num(0, 6.3),
  lifeMs: num(50, 6000),
  size: num(1, 24),
  pierce: num(0, 99, true),
  bounce: num(0, 9, true),
  knockback: num(0, 20),
  element: { type: 'string', oneOf: ['none', 'void', 'fire', 'ice', 'psi'], optional: true },
  dirs: num(1, 8, true),
  selfMadness: num(0, 20),
  homing: num(0, 1.5),
  damageMul: num(0.1, 5),
  rateMul: num(0.2, 3),
  speedMul: num(0.2, 3),
  sizeMul: num(0.2, 4),
  lifeMul: num(0.2, 4),
  countAdd: num(-6, 8, true),
  spreadAdd: num(-1, 3),
  pierceAdd: num(-5, 9, true),
  bounceAdd: num(0, 9, true),
  knockbackAdd: num(0, 20),
  onHit: { type: 'string', oneOf: ['burn', 'freeze', 'pull', 'chain', 'blind'], optional: true },
  onKill: { type: 'string', oneOf: ['heal', 'ammo', 'light'], optional: true },
};
