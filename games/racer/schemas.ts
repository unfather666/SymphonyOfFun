// Field specs for the core content loader (unknown keys and out-of-range numbers drop a def with a plain message).
import type { Schema } from '../../src/core/api';

const n = (min: number, max: number, int = false) => ({ type: 'number', min, max, int }) as const;

export const rulesSchema: Schema = {
  segmentPool: n(16, 64, true),
  lookaheadBeats: n(4, 24, true),
  behindBeats: n(1, 8, true),
  startSafeBeats: n(0, 32, true),
  yawCapDeg: n(10, 85),
  pitchCapDeg: n(1, 20),
  curveStayChance: n(0, 0.95),
  propsPerSegment: n(0, 4, true),
  segmentSlices: n(1, 8, true),
  halfRoadM: n(2, 12),
  laneEdgeLimit: n(1, 2),
  laneHardLimit: n(1, 3),
  steerRate: n(0.2, 6),
  brakeSteerBoost: n(1, 3),
  accel: n(1, 60),
  coastDecel: n(0, 20),
  brakeDecel: n(1, 100),
  offroadDecel: n(0, 60),
  cruiseFrac: n(0.3, 1),
  audioLatencyMs: n(0, 300),
  syncWindowMs: n(10, 300),
  syncBonusPerStack: n(0, 0.2),
  syncMaxStacks: n(0, 30, true),
  healthMax: n(10, 1000),
  gravity: n(1, 80),
  jumpSpeed: n(1, 40),
  fovBase: n(30, 110),
  fovPulse: n(0, 10),
  cameraBack: n(2, 20),
  cameraUp: n(0.5, 10),
  cameraLag: n(0.01, 1),
  sectionBars: n(1, 16, true),
  levelSeconds: n(10, 900),
  lives: n(1, 9, true),
  deathMs: n(500, 10000),
  hazardStartBeat: n(0, 64, true),
  minorBase: n(0, 1),
  minorScale: n(0, 1),
  minorGapBeats: n(0, 8, true),
  majorChance: n(0, 1),
  majorMinIntensity: n(0, 1),
  pickupChance: n(0, 1),
  hitCooldownMs: n(0, 3000),
  carHalfW: n(0.02, 0.5),
  coinValue: n(0, 1000, true),
  piecesCap: n(16, 1024, true),
  smokeCap: n(8, 512, true),
  pieceLifeMs: n(200, 6000),
  pieceGravity: n(0, 60),
  magnetLanes: n(0.2, 3),
  magnetMeters: n(2, 80),
  finishMinHealth: n(0, 100),
  syncScore: n(0, 1000, true),
  dodgeScore: n(0, 1000, true),
  pieceScore: n(0, 1000, true),
  deathScore: n(0, 5000, true),
  smokeBelowHealth: n(1, 100),
  smokePerSec: n(0, 200),
  respawnGraceMs: n(0, 5000),
  slideSteerFrac: n(0, 1),
};

export const kindSchema: Schema = {
  turnDeg: n(-20, 20),
  dPitchDeg: n(-6, 6),
  pitchToDeg: { ...n(-20, 20), optional: true },
  halfWidth: n(0.3, 2),
  weight: n(0, 100),
  maxRun: n(1, 99, true),
  gap: { type: 'boolean', optional: true },
  ramp: { type: 'boolean', optional: true },
  tunnel: { type: 'boolean', optional: true },
  split: { type: 'boolean', optional: true },
  drop: { type: 'boolean', optional: true },
};

export const themeSchema: Schema = {
  palette: { type: 'string[]' },
  fogNear: n(10, 400),
  fogFar: n(40, 600),
  gravity: n(0.1, 2),
  gapChance: n(0, 1),
  ice: n(0, 1),
  props: { type: 'id[]' },
  kindWeights: { type: 'object' },
  hazardWeights: { type: 'object' },
};

export const levelSchema: Schema = {
  no: n(1, 10, true),
  theme: { type: 'id' },
  bpm: n(60, 220),
  maxSpeed: n(10, 80),
  meter3Chance: { ...n(0, 1), optional: true },
};

export const propSchema: Schema = { parts: { type: 'any' } };
export const vehicleSchema: Schema = { states: { type: 'any' } };

export const patternSchema: Schema = {
  role: { type: 'string', oneOf: ['drums', 'bass', 'lead', 'pad'] },
  genre: { type: 'id' },
  mode: { type: 'string', oneOf: ['major', 'minor', 'any'] },
  bpmMin: n(40, 260),
  bpmMax: n(40, 260),
  meter: { ...n(3, 4, true), optional: true },
  steps: { type: 'number[]' },
};

const partTable = { type: 'any' } as const;

export const hazardSchema: Schema = {
  major: { type: 'boolean' },
  parts: partTable,
  halfW: n(0.05, 1.5),
  halfLen: n(0.2, 8),
  span: n(1, 3, true),
  damageMin: n(0, 100),
  damageMax: n(0, 100),
  breakInto: n(0, 40, true),
  pieceColour: n(0, 15, true),
  motion: { type: 'string', oneOf: ['static', 'sweep', 'periodic'] },
  periodBeats: n(1, 32),
  activeFrom: n(0, 1),
  activeTo: n(0, 1),
  sweepAmp: n(0, 1.2),
  slideMs: n(0, 5000),
  hornable: { type: 'boolean' },
  speedLoss: n(0, 1),
  visual: { type: 'string', oneOf: ['none', 'slide', 'squish', 'drop'] },
  calamity: { type: 'id', optional: true },
};

export const powerSchema: Schema = {
  coin: { type: 'boolean' },
  weight: n(0, 100),
  durationMs: n(0, 60000),
  colour: n(0, 15, true),
  parts: partTable,
  heal: n(0, 100),
  speedMul: n(0.2, 3),
  invulnMinor: { type: 'boolean' },
  shield: n(0, 5, true),
  magnet: { type: 'boolean' },
  clearAhead: n(0, 32, true),
  clearHornable: { type: 'boolean' },
  value: n(0, 1000, true),
};

export const calamitySchema: Schema = {
  trigger: { type: 'string', oneOf: ['hazard', 'fall', 'health_zero', 'finish_low'] },
  cinematicMs: n(500, 8000),
  camera: { type: 'string', oneOf: ['chase', 'fall', 'orbit'] },
  shake: n(0, 20),
  flash: { type: 'string' },
  pieces: n(0, 64, true),
  sfx: { type: 'string' },
  theme: { type: 'id', optional: true },
};
