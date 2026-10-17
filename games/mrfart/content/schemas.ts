// Field rules for each kind of def. The core loader drops any def that breaks them, with a plain message.
import type { Schema } from '../../../src/core/api';

export const FART_SCHEMA: Schema = {
  min: { type: 'number', min: 0, max: 200 }, force: { type: 'number', min: 0, max: 500 }, radius: { type: 'number', min: 1, max: 400 },
  witnessRadius: { type: 'number', min: 1, max: 600 }, notice: { type: 'number', min: 0, max: 1 }, intol: { type: 'number', min: 0, max: 100, int: true },
  absurd: { type: 'number', min: 0, max: 100, int: true }, drain: { type: 'number', min: 0, max: 200 }, breaks: { type: 'boolean' },
  shake: { type: 'number', min: 0, max: 20 }, volume: { type: 'number', min: 0, max: 1 }, puffs: { type: 'number', min: 0, max: 40, int: true },
  ring: { type: 'boolean' }, notes: { type: 'number', min: 0, max: 20, int: true }, sfx: { type: 'object' },
};
export const PROP_SCHEMA: Schema = {
  w: { type: 'number', min: 2, max: 64 }, h: { type: 'number', min: 2, max: 64 }, mass: { type: 'number', min: 0.1, max: 200 },
  damping: { type: 'number', min: 0, max: 40 }, knockDv: { type: 'number', min: 0, max: 99999 }, breakDv: { type: 'number', min: 0, max: 99999 },
  colour: { type: 'number', min: 1, max: 31, int: true }, sprite: { type: 'id' },
};
export const PERSON_SCHEMA: Schema = {
  name: { type: 'string' }, role: { type: 'id' }, speed: { type: 'number', min: 5, max: 120 },
  shirt: { type: 'number', min: 1, max: 31, int: true }, hair: { type: 'number', min: 1, max: 31, int: true }, skin: { type: 'number', min: 1, max: 31, int: true },
  loop: { type: 'any', optional: true },
};
export const SUBJECT_SCHEMA: Schema = {
  tier: { type: 'number', min: 0, max: 4, int: true }, r: { type: 'number', min: 2, max: 40 }, mass: { type: 'number', min: 0.1, max: 500 },
  damping: { type: 'number', min: 0, max: 40 }, speed: { type: 'number', min: 0, max: 120 }, carryMult: { type: 'number', min: 0, max: 1 },
  leash: { type: 'number', min: 0, max: 200 }, followDist: { type: 'number', min: 0, max: 100 }, tug: { type: 'number', min: 0, max: 300 },
  colour: { type: 'number', min: 1, max: 31, int: true }, count: { type: 'number', min: 1, max: 3, int: true, optional: true },
};
export const PLACE_SCHEMA: Schema = {
  kind: { type: 'string', oneOf: ['cell', 'across', 'tree', 'bus_stop', 'origin'] }, cell: { type: 'id' },
};
export const JOB_TYPE_SCHEMA: Schema = {
  textKey: { type: 'id' }, spawn: { type: 'string', oneOf: ['origin', 'place', 'tree'] },
  maxCount: { type: 'number', min: 1, max: 3, int: true }, subjectTags: { type: 'id[]' }, places: { type: 'id[]' }, steps: { type: 'any' },
  minTier: { type: 'number', min: 0, max: 4, int: true, optional: true },
};
