// Clock, random streams and events.

// ---- clock / random -------------------------------------------------------

export interface Clock {
  /** Game time in ms: step() * STEP_MS. Stops while paused. */
  nowMs(): number;
  /** Steps run since the game started. */
  step(): number;
}

export interface SeededStream {
  readonly name: string;
  readonly seed: number;
  /** Float in [0,1). */
  float(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** true with probability p. */
  chance(p: number): boolean;
  pick<T>(list: readonly T[]): T;
  /** Raw generator state, for saves and determinism hashes. */
  getState(): number;
  setState(state: number): void;
}

export interface Random {
  /** The run seed (from ?seed=N, else picked once at boot). */
  readonly runSeed: number;
  /** One stream per domain. Same name returns the same stream; a seed restarts it. */
  stream(name: string, seed?: number): SeededStream;
}

// ---- events ---------------------------------------------------------------

export type EventValue = number | string | boolean;
export type EventPayload = Readonly<Record<string, EventValue>>;

export interface EventBus {
  /**
   * Queue an event; delivered at the next flush (after each update step).
   * Emitting from inside a handler queues for the following flush.
   * mergeKey: a queued event with the same name and key is replaced instead of added.
   * Full policy (4096 queued): drop the new event and log once.
   */
  emit(name: string, payload?: EventPayload, mergeKey?: string | number): void;
  /** Returns an unsubscribe function. */
  on(name: string, handler: (payload: EventPayload) => void): () => void;
}

/** Events core emits. Games emit their own as `<game>:<verb>`, declared in content/events.json. */
export const CORE_EVENTS = [
  'chip:beat',
  'input:deviceChanged',
  'display:resized',
  'save:loaded',
  'core:paused',
  'dev:cheat',
] as const;
export type CoreEventName = (typeof CORE_EVENTS)[number];
// chip:beat           {bar, beat, step16, step}   every 16th step of the playing song
// input:deviceChanged {device: 'keyboard'|'gamepad'|'touch'}
// display:resized     {scale, cssW, cssH}
// save:loaded         {slot, ok}
// core:paused         {on}
// dev:cheat           {id}                         window.sof.cheat('id') in dev builds
