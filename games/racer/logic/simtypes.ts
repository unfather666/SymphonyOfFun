// Sim state shape and phase ids. Types only plus constants, so the logic modules can share it without import cycles.
import type { Car, CarEnv } from './car';
import type { FxQueue } from './fx';
import type { Pool } from './pieces';
import type { Rand } from './rng';
import type { Track } from './track';
import type { CalamityDef, HazardDef, LevelDef, PowerDef, Rules, ThemeDef } from './types';

export const PHASE_RUN = 0;
export const PHASE_DYING = 1;
export const PHASE_FINISHED = 2;
export const PHASE_OVER = 3;

/** Stages of the death cinematic. */
export const STAGE_BOOM = 0;
export const STAGE_SHARDS = 1;
export const STAGE_CAPTION = 2;

export interface Beat {
  /** Game ms of the last beat edge as the player hears it (event time + audio latency). */
  edgeMs: number;
  periodMs: number;
  index: number;
}

export interface PowerState {
  /** Held power-up def index or -1. */
  held: number;
  shieldCharges: number;
  shieldUntilMs: number;
  magnetUntilMs: number;
  invulnUntilMs: number;
}

export interface Sim {
  rules: Rules;
  level: LevelDef;
  theme: ThemeDef;
  seed: number;
  bpm: number;
  meter: number;
  segLen: number;
  cruise: number;
  totalBars: number;
  totalBeats: number;
  track: Track;
  car: Car;
  env: CarEnv;
  beat: Beat;
  hazards: readonly HazardDef[];
  powers: readonly PowerDef[];
  calamities: readonly CalamityDef[];
  pieces: Pool;
  smoke: Pool;
  fx: FxQueue;
  rand: Rand;
  phase: number;
  nowMs: number;
  runMs: number;
  syncedBeats: number;
  lastSyncBeat: number;
  lives: number;
  deaths: number;
  dodged: number;
  broken: number;
  coins: number;
  distance: number;
  power: PowerState;
  hitUntilMs: number;
  /** Highest segment whose hazard and pickup have been settled as passed. */
  passedIdx: number;
  smokeAcc: number;
  /** Set to a bar when the music should seek there; index.ts clears it. */
  seekBar: number;
  /** Calamity index waiting to start the death cinematic, or -1. */
  pendingDeath: number;
  calamity: number;
  deathAtMs: number;
  dyingStage: number;
  carHidden: boolean;
  finishGagDone: boolean;
}
