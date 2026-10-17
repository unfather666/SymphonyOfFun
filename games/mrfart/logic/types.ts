// Shared shapes for the simulation. Plain objects only.
import type { Handle, PhysicsApi } from '../physics/PhysicsApi';
import type { MapData } from './map';
import type { Rng } from './rng';
import type { Rules } from './rules';

export interface FartDef {
  readonly id: string;
  /** Meter value at which this kind starts. */
  readonly min: number;
  readonly force: number;
  readonly radius: number;
  readonly witnessRadius: number;
  readonly notice: number;
  readonly intol: number;
  readonly absurd: number;
  readonly drain: number;
  readonly breaks: boolean;
  readonly shake: number;
  readonly volume: number;
  readonly puffs: number;
  readonly ring: boolean;
  readonly notes: number;
}

export interface PropDef {
  readonly id: string;
  readonly w: number;
  readonly h: number;
  readonly mass: number;
  readonly damping: number;
  readonly knockDv: number;
  readonly breakDv: number;
  readonly colour: number;
  readonly sprite: string;
}

export interface PersonDef {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly speed: number;
  /** Palette indices for the look. */
  readonly shirt: number;
  readonly hair: number;
  readonly skin: number;
  /** Fixed loop in tile coordinates: [tx, ty, dwellMs]. */
  readonly loop?: ReadonlyArray<readonly [number, number, number]>;
}

export const STATUS_PLAYING = 0, STATUS_LOST = 1;

export const FACE_DOWN = 0, FACE_UP = 1, FACE_LEFT = 2, FACE_RIGHT = 3;

/** Tag = (type << 16) | index, stored on every body so queries can tell what they hit. */
export const TAG_PLAYER = 1, TAG_PERSON = 2, TAG_PROP = 3, TAG_SUBJECT = 4;
export const tagOf = (type: number, index: number) => (type << 16) | index;

export interface Player {
  x: number; y: number; px: number; py: number;
  h: Handle;
  facing: number;
  /** Px moved by the last step. */
  moved: number;
  running: boolean;
}

export const PS_WALK = 0, PS_DWELL = 1, PS_STARTLED = 2, PS_FLEE = 3;

export interface Person {
  idx: number;
  def: PersonDef;
  x: number; y: number; px: number; py: number;
  h: Handle;
  facing: number;
  state: number;
  /** Game-clock ms when a dwell ends. */
  until: number;
  wp: number;
  /** Waypoints in px: x, y, dwellMs triples. */
  route: number[];
  /** Game-clock ms of the last fart that pushed this person. */
  pushedAt: number;
  /** This person's own intolerance (0..maxIntol), halved at midnight. */
  intol: number;
  /** After the startle, run away instead of resuming. */
  flees: boolean;
}

export interface Prop {
  idx: number;
  def: PropDef;
  x: number; y: number; px: number; py: number;
  angle: number; pangle: number;
  h: Handle;
  knocked: boolean;
  broken: boolean;
}

export interface Meters {
  fart: number;
  stress: number;
  reputation: number;
  /** Intolerance accrued since the last midnight; settled against reputation at 00:00. */
  intolToday: number;
  /** Game-clock ms the clench started, -1 when not clenching. */
  clenchSince: number;
  /** Set once a clench has lasted balloonMs. */
  ballooned: boolean;
  /** Game-clock ms of the next random fart roll. */
  nextRollAt: number;
  lastFartAt: number;
}

/** What the last fart looked like, for render and tests. */
export interface FartInfo {
  count: number;
  kind: number;
  x: number;
  y: number;
  force: number;
  radius: number;
  at: number;
}

export interface SimInput {
  mx: number;
  my: number;
  run: boolean;
  clench: boolean;
}

export type EmitFn = (name: string, payload: Record<string, number | string | boolean>) => void;

export interface SimDeps {
  physics: PhysicsApi;
  rules: Rules;
  map: MapData;
  farts: readonly FartDef[];
  props: readonly PropDef[];
  people: readonly PersonDef[];
  rng: { fart: Rng; fx: Rng; people: Rng; notice: Rng };
  emit: EmitFn;
  reducedFx?: boolean;
}
