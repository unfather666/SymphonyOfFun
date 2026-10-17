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
};

export const SFX_SCHEMA: Schema = {
  layers: { type: 'any' },
};
