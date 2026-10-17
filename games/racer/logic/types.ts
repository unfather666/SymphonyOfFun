// Plain data shapes shared by logic and render. Content defs are cast to these after the core loader validated them.

export interface Rules {
  segmentPool: number;
  lookaheadBeats: number;
  behindBeats: number;
  startSafeBeats: number;
  yawCapDeg: number;
  pitchCapDeg: number;
  curveStayChance: number;
  propsPerSegment: number;
  segmentSlices: number;
  halfRoadM: number;
  laneEdgeLimit: number;
  laneHardLimit: number;
  steerRate: number;
  brakeSteerBoost: number;
  accel: number;
  coastDecel: number;
  brakeDecel: number;
  offroadDecel: number;
  cruiseFrac: number;
  audioLatencyMs: number;
  syncWindowMs: number;
  syncBonusPerStack: number;
  syncMaxStacks: number;
  healthMax: number;
  gravity: number;
  jumpSpeed: number;
  fovBase: number;
  fovPulse: number;
  cameraBack: number;
  cameraUp: number;
  cameraLag: number;
  sectionBars: number;
  levelSeconds: number;
  lives: number;
  deathMs: number;
  hazardStartBeat: number;
  minorBase: number;
  minorScale: number;
  minorGapBeats: number;
  majorChance: number;
  majorMinIntensity: number;
  pickupChance: number;
  hitCooldownMs: number;
  carHalfW: number;
  coinValue: number;
  piecesCap: number;
  smokeCap: number;
  pieceLifeMs: number;
  pieceGravity: number;
  magnetLanes: number;
  magnetMeters: number;
  finishMinHealth: number;
  syncScore: number;
  dodgeScore: number;
  pieceScore: number;
  deathScore: number;
  smokeBelowHealth: number;
  smokePerSec: number;
  respawnGraceMs: number;
  slideSteerFrac: number;
}

export interface KindDef {
  id: string;
  turnDeg: number;
  dPitchDeg: number;
  pitchToDeg?: number;
  halfWidth: number;
  weight: number;
  maxRun: number;
  gap?: boolean;
  ramp?: boolean;
  tunnel?: boolean;
  split?: boolean;
  drop?: boolean;
}

export interface ThemeDef {
  id: string;
  /** 16 colours: 0 sky/fog, 1 road, 2 road alt, 3 line, 4 shoulder, 5 ground, 6 ground alt, 7-9 props, 10 accent, 11-12 hazards, 13 car, 14 trim, 15 white. */
  palette: string[];
  fogNear: number;
  fogFar: number;
  gravity: number;
  gapChance: number;
  ice: number;
  props: string[];
  kindWeights: Record<string, number>;
  hazardWeights: Record<string, number>;
}

export interface LevelDef {
  id: string;
  no: number;
  theme: string;
  bpm: number;
  maxSpeed: number;
  meter3Chance?: number;
}

export const MAX_PROPS = 4;

export interface Segment {
  index: number;
  kind: number;
  x0: number;
  y0: number;
  z0: number;
  yaw0: number;
  pitch0: number;
  x1: number;
  y1: number;
  z1: number;
  yaw1: number;
  pitch1: number;
  halfWidth: number;
  gap: boolean;
  ramp: boolean;
  tunnel: boolean;
  split: boolean;
  drop: boolean;
  /** Roadside props: type index into the theme's prop list (-1 none), lateral metres from the centre line, 0..1 along the segment. */
  propType: number[];
  propX: number[];
  propT: number[];
  /** Hazard on this segment: def index or -1, lane centre, 0..1 along, 0..1 timing offset, state (see HZ_*). */
  hz: number;
  hzLane: number;
  hzT: number;
  hzPhase: number;
  hzState: number;
  /** Pickup on this segment: power def index or -1, lane, 0..1 along, state (see HZ_*). */
  pk: number;
  pkLane: number;
  pkT: number;
  pkState: number;
}

export const HZ_NONE = 0;
export const HZ_ALIVE = 1;
export const HZ_BROKEN = 2;
export const HZ_PASSED = 3;

export interface HazardDef {
  id: string;
  major: boolean;
  /** Boxes [x, y, z, w, h, d, paletteIndex], centred on the hazard's lane. */
  parts: number[][];
  /** Half width in lane units, half length in metres, lanes covered when placed. */
  halfW: number;
  halfLen: number;
  span: number;
  damageMin: number;
  damageMax: number;
  breakInto: number;
  pieceColour: number;
  motion: 'static' | 'sweep' | 'periodic';
  periodBeats: number;
  activeFrom: number;
  activeTo: number;
  sweepAmp: number;
  slideMs: number;
  hornable: boolean;
  speedLoss: number;
  visual: 'none' | 'slide' | 'squish' | 'drop';
  calamity?: string;
}

export interface PowerDef {
  id: string;
  coin: boolean;
  weight: number;
  durationMs: number;
  colour: number;
  parts: number[][];
  heal: number;
  speedMul: number;
  invulnMinor: boolean;
  shield: number;
  magnet: boolean;
  clearAhead: number;
  clearHornable: boolean;
  value: number;
}

export interface CalamityDef {
  id: string;
  trigger: 'hazard' | 'fall' | 'health_zero' | 'finish_low';
  cinematicMs: number;
  camera: 'chase' | 'fall' | 'orbit';
  shake: number;
  flash: string;
  pieces: number;
  sfx: string;
  theme?: string;
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** Segment index and fraction along it. */
  seg: number;
  t: number;
}

export interface DriveInput {
  /** -1 left .. 1 right. */
  steer: number;
  accel: boolean;
  accelPressed: boolean;
  brake: boolean;
  jumpPressed: boolean;
  usePressed: boolean;
}

export const STEP_S = 1 / 60;
export const DEG = Math.PI / 180;
