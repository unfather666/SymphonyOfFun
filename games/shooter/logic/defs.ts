// Content definitions and the level plan: plain data shapes, no behaviour.
// ---- content defs (frozen JSON, cast at the wiring boundary) ----
export interface EnemyDef {
  id: string;
  tags: readonly string[];
  hp: number;
  speed: number;
  /** Half-width of the hit box in px. */
  size: number;
  sprite: string;
  brain: string;
  touchDamage: number;
  score: number;
  tier: number;
  flies?: boolean;
  /** A hit from behind (bullet travelling the way the enemy faces) kills outright. */
  backstab?: boolean;
  /** Drains madness only while the player is inside its viewing cone with a clear line. */
  gaze?: boolean;
  /** Heading sweep in degrees per second (eyes). */
  turnDegS?: number;
  /** Only drawn under light. */
  hidden?: boolean;
  /** ms between hallucinated ghosts this enemy sends into the player's view. */
  ghostMs?: number;
  shotSpeed?: number;
  shotDamage?: number;
  shotCount?: number;
  shotSpread?: number;
  madnessAura?: number;
  auraR?: number;
  splitInto?: string;
  splitCount?: number;
  /** Boss: drops an item when killed, gets a health bar. */
  boss?: boolean;
  /** Sprite draw size in px (default 16). */
  drawSize?: number;
}

export interface BrainStateDef {
  kind: string;
  ms: number;
  next: string;
  speedMul?: number;
  dist?: number;
  zig?: number;
  nearR?: number;
  nearTo?: string;
  /** ring: bullets in the ring; summon: enemies spawned. */
  count?: number;
  /** summon: def id to spawn. */
  spawn?: string;
}
export interface BrainPhaseDef {
  /** Fraction of max hp at or below which the phase starts. */
  hp: number;
  state: string;
}
export interface BrainDef {
  id: string;
  tags: readonly string[];
  start: string;
  states: Record<string, BrainStateDef>;
  phases?: BrainPhaseDef[];
}
export interface CState {
  kind: number;
  ms: number;
  next: number;
  speedMul: number;
  dist: number;
  zig: number;
  nearR: number;
  nearTo: number;
  count: number;
  spawn: string;
}
export interface CPhase {
  hp: number;
  state: number;
}
export interface CBrain {
  start: number;
  states: CState[];
  /** Sorted by falling hp threshold. */
  phases: CPhase[];
}

// ---- level plan (hand-written room or generated) ----
export interface SpawnEntry {
  def: string;
  x: number;
  y: number;
  elite?: boolean;
}
export interface RoomPlan {
  /** Tile rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  waves: SpawnEntry[][];
}
export interface ScriptEntry {
  /** Fires when this many waves have started (any room), or ms after the level began. */
  atWave?: number;
  atMs?: number;
  kind: 'blackout' | 'spotlight' | 'strobe' | 'pulse';
  ms: number;
  x?: number;
  y?: number;
  r?: number;
  hz?: number;
}

export interface LevelPlan {
  id: string;
  w: number;
  h: number;
  tiles: Uint8Array;
  /** Pixels. */
  start: { x: number; y: number };
  exit: { x: number; y: number } | null;
  rooms: RoomPlan[];
  /** Darkness alpha 0..1. */
  ambient: number;
  tier: number;
  script: ScriptEntry[];
  /** 1-based level number (0 for hand-written rooms). */
  level: number;
  /** Darkness colour, '#rrggbb'. */
  tint: string;
  /** Multiplier on enemy hp. */
  hpMul: number;
}
