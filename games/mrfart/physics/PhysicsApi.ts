// The only physics surface the rest of the game uses. Rapier lives behind it (physics/rapier/); NullPhysics is the test stand-in.
// Units: pixels, seconds, radians. One step = 1/60 s. Handles are integers: (generation << 16) | slot, 0 = no body.

export type Handle = number;
export const NO_BODY: Handle = 0;

export type BodyKind = 'player' | 'person' | 'prop' | 'wall' | 'subject' | 'link';
export type ShapeKind = 'circle' | 'box' | 'capsule';

export interface BodyDef {
  kind: BodyKind;
  shape: ShapeKind;
  x: number;
  y: number;
  /** Circle radius, or capsule radius. */
  r?: number;
  /** Box half extents; for a capsule hh is the half length of the straight part. */
  hw?: number;
  hh?: number;
  angle?: number;
  /** Reference mass; heavier bodies get a smaller velocity change from impulseRadial. */
  mass?: number;
  damping?: number;
  angularDamping?: number;
  lockRotation?: boolean;
  /** Caller's id for this body, handed back by tagOf. */
  tag?: number;
}

export interface Pose {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
}

export interface PhysicsStats {
  bodies: number;
  joints: number;
  awake: number;
}

export interface PhysicsApi {
  /** Add a body. Full policy (bodies cap): returns NO_BODY and the caller skips the spawn. Static walls never count. */
  addBody(def: BodyDef): Handle;
  /** Remove a body. A stale or zero handle warns once and does nothing. */
  remove(h: Handle): void;
  /** Steer a person-like body toward a velocity (px/s). gain 0..1 is how fast it follows per step. */
  setTargetVelocity(h: Handle, vx: number, vy: number, gain?: number): void;
  /**
   * Push every dynamic body within radius away from (x,y). force is the velocity change in px/s given to a
   * body of mass 1 at the centre; factor = (1 - d/radius)^falloff (falloff 0 = flat); heavier bodies move less.
   * Steered bodies lose their steering for a few steps so the push is visible. Returns bodies pushed.
   */
  impulseRadial(x: number, y: number, radius: number, force: number, falloff: number, exclude?: Handle): number;
  /** Handles of non-static bodies within r of (x,y), in slot order, written into out; returns the count. */
  queryRadius(x: number, y: number, r: number, out: Int32Array): number;
  step(): void;
  /** Fills out from the last step. False for a stale handle. */
  pose(h: Handle, out: Pose): boolean;
  tagOf(h: Handle): number;
  /** Rope chain of 3 links from a to b, at most `length` px long. Returns a leash id (0 = refused: joint cap). */
  addLeash(a: Handle, b: Handle, length: number): number;
  removeLeash(id: number): void;
  /** Writes the chain's 4 points as x0,y0,x1,y1,... into out; returns the point count. */
  leashPoints(id: number, out: Float64Array): number;
  stats(): PhysicsStats;
  dispose(): void;
}

export const PX_PER_M = 16;
/** Heavier-than-this bodies barely move; see impulseRadial. */
export const MASS_REF = 4;
/** Steps a pushed steered body ignores its steering. */
export const STUN_STEPS = 24;

export function handleSlot(h: Handle): number {
  return h & 0xffff;
}
export function handleGen(h: Handle): number {
  return h >>> 16;
}
export function makeHandle(gen: number, slot: number): Handle {
  return ((gen & 0x7fff) << 16) | slot;
}
