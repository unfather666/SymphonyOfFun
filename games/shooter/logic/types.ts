// Plain data shapes shared by the sim. No behaviour here.
import type { Grid } from './grid';
import type { Pool, PoolItem } from './pool';
import type { Rng } from './rng';
import type { Rules } from './rules';
import type { TileMap } from './tiles';
import type { EnemyDef, BrainStateDef, BrainPhaseDef, BrainDef, CState, CPhase, CBrain, SpawnEntry, RoomPlan, ScriptEntry, LevelPlan } from './defs';
export type { EnemyDef, BrainStateDef, BrainPhaseDef, BrainDef, CState, CPhase, CBrain, SpawnEntry, RoomPlan, ScriptEntry, LevelPlan } from './defs';

// ---- pooled entities ----
export interface Enemy extends PoolItem {
  def: EnemyDef;
  brain: CBrain;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Knockback impulse, px/s, decays. */
  kx: number;
  ky: number;
  hp: number;
  state: number;
  stateAt: number;
  /** Heading in radians for wander / eye facing. */
  heading: number;
  nextActAt: number;
  hurtAt: number;
  burnUntil: number;
  burnTickAt: number;
  slowUntil: number;
  blindUntil: number;
  room: number;
  elite: boolean;
  /** Line of sight to the player, refreshed every 4th step. */
  los: boolean;
  /** Per-enemy phase offset for zigzag. */
  phase: number;
  maxHp: number;
  /** Next brain phase to trigger (bosses). */
  bossPhase: number;
}

export interface Bullet extends PoolItem {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  dmg: number;
  dieAt: number;
  size: number;
  grow: number;
  pierce: number;
  bounce: number;
  homing: number;
  kb: number;
  hitMask: number;
  killMask: number;
  /** 0 player, 1 enemy. */
  owner: number;
  kind: number;
  elem: number;
  /** Last enemy slots hit (so a piercing bullet does not hit the same one every step). */
  h0: number;
  h1: number;
  h2: number;
  h3: number;
}

export interface Particle extends PoolItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dieAt: number;
  colour: number;
  size: number;
  /** 1 = also punches a light in the mask. */
  glow: number;
}

/** Render-only hallucination: kind 0 an enemy that is not there, 1 a bullet that passes through. */
export interface Ghost extends PoolItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dieAt: number;
  kind: number;
  /** Index of the enemy def whose sprite to draw (kind 0). */
  arg: number;
}

export interface Pickup extends PoolItem {
  x: number;
  y: number;
  /** 0 item, 1 health, 2 flare. */
  kind: number;
  /** Item index for kind 0. */
  arg: number;
  dieAt: number;
}

// ---- shots ----
export interface Shot {
  projectile: 'bolt' | 'beam' | 'arc' | 'shell' | 'wave' | 'drone';
  damage: number;
  rateMs: number;
  speed: number;
  count: number;
  /** Radians, full cone width. */
  spread: number;
  pierce: number;
  bounce: number;
  homing: number;
  size: number;
  knockback: number;
  element: 'none' | 'void' | 'fire' | 'ice' | 'psi';
  lifeMs: number;
  /** 1 normal, 8 = fires in eight directions. */
  dirs: number;
  selfMadness: number;
}
export interface ShotSpec {
  shots: Shot[];
  onHit: number;
  onKill: number;
}

export interface Player {
  x: number;
  y: number;
  px: number;
  py: number;
  aimX: number;
  aimY: number;
  hp: number;
  maxHp: number;
  iUntil: number;
  dashUntil: number;
  dashReadyAt: number;
  dashX: number;
  dashY: number;
  nextShotAt: number;
  shotIdx: number;
  flares: number;
  flareUntil: number;
  overdriveUntil: number;
  /** Walk animation phase in steps. */
  walk: number;
}

/** One step of player intent, read from input by the wiring layer. */
export interface Command {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  fire: boolean;
  dash: boolean;
  flare: boolean;
}

export interface RoomState {
  wave: number;
  /** Entries of the current wave already spawned. */
  spawned: number;
  /** The current wave has started (counted once in waveCount). */
  begun: boolean;
  /** 0 not entered, 1 fighting, 2 cleared. */
  state: number;
  nextWaveAt: number;
}

/** One running light trick. kind: 0 blackout, 1 spotlight, 2 strobe, 3 pulse. */
export interface LightFx {
  active: boolean;
  kind: number;
  startAt: number;
  until: number;
  x: number;
  y: number;
  r: number;
  hz: number;
}

export interface LightState {
  fx: LightFx[];
  /** Next script entry to consider. */
  idx: number;
  /** Darkness alpha now (script, pulse and flare applied; strobe excluded). */
  ambient: number;
  strobeOn: boolean;
  /** 0..1 breathing for the pulse trick. */
  pulse: number;
  nextBeatAt: number;
  spotOn: boolean;
  spotX: number;
  spotY: number;
  spotR: number;
}

/** Madness 4: inverted move axis in seeded bursts. phase 0 waiting, 1 warning, 2 inverted. */
export interface Inversion {
  phase: number;
  at: number;
}

export type Status = 'play' | 'dead' | 'cleared';

export interface World {
  rules: Rules;
  /** Gameplay randomness (core stream 'sim'). */
  rng: Rng;
  /** Madness-4 inversion timing (own stream so tiers never shift the sim's draws). */
  madRng: Rng;
  /** Cosmetic randomness (particles, ghosts). Never used for gameplay decisions. */
  fxRng: Rng;
  now: number;
  stepNo: number;
  startedAt: number;
  status: Status;
  plan: LevelPlan;
  map: TileMap;
  player: Player;
  enemies: Pool<Enemy>;
  bullets: Pool<Bullet>;
  particles: Pool<Particle>;
  pickups: Pool<Pickup>;
  grid: Grid;
  defs: ReadonlyMap<string, EnemyDef>;
  brains: ReadonlyMap<string, CBrain>;
  shot: ShotSpec;
  rooms: RoomState[];
  room: number;
  exitOpen: boolean;
  score: number;
  kills: number;
  spawnCount: number;
  /** Waves started so far (light script trigger). */
  waveCount: number;
  combo: number;
  comboUntil: number;
  /** 0..100. */
  madness: number;
  /** Madness added by auras and eyes this step (decay only when 0). */
  madnessIn: number;
  light: LightState;
  inv: Inversion;
  ghosts: Pool<Ghost>;
  defList: readonly EnemyDef[];
  defIndex: ReadonlyMap<string, number>;
  fxNextAt: number;
  whisperAt: number;
  /** Sound / feedback cues for the wiring layer: codes from cues.ts. Full policy: skip. */
  out: Int32Array;
  outN: number;
  scratch: Int32Array;
  /** Tile -> room index, -1 outside rooms. */
  roomMap: Int8Array;
  roomAlive: Int32Array;
  /** Distance-to-player flow field over walkable tiles (-1 unreachable). */
  flow: Int16Array;
  flowQ: Int32Array;
  flowAt: number;
  /** Item ordinals picked up this step; the wiring layer drains them. Full policy: skip. */
  gained: Int32Array;
  gainedN: number;
  /** Item ordinals a boss or elite may drop (set by the wiring layer from unlocks and ownership). */
  dropItems: number[];
}
