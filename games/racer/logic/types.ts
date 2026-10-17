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
  [key: string]: number;
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
  [key: string]: unknown;
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
