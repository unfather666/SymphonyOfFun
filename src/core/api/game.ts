// The game boundary: GameModule in, CoreContext given.

import type { Chip } from './chip';
import type { ContentLoader, SaveStore } from './data';
import type { Display, Gfx2d } from './gfx';
import type { Input } from './input';
import type { Clock, EventBus, Random } from './time';
import type { Logger, Settings, Ui } from './ui';

export const SCREEN_W = 384;
export const SCREEN_H = 216;
export const STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 5;

export type GameId = 'shooter' | 'racer' | 'mrfart';

export interface GameModule {
  id: GameId;
  title: string;
  /** Shown under the title on the launcher card. */
  blurb?: string;
  /** Touch overlay layout: a right stick appears only when aim is true. */
  touch?: { aim: boolean };
  create(ctx: CoreContext): GameInstance;
}

export interface GameInstance {
  /** Load content, build pools; may await WASM. */
  init(): void | Promise<void>;
  /** Fixed STEP_MS; sim only; no drawing. */
  update(stepMs: number): void;
  /** Once per frame; reads state, never changes it. alpha in [0,1). */
  draw(alpha: number): void;
  /** Core pause menu opened (true) or closed (false). */
  pause(on: boolean): void;
  /** Release everything; core returns to the launcher afterwards. */
  shutdown(): void;
}

export interface CoreContext {
  readonly gameId: GameId;
  readonly clock: Clock;
  readonly random: Random;
  readonly events: EventBus;
  readonly input: Input;
  readonly display: Display;
  readonly gfx: Gfx2d;
  readonly chip: Chip;
  readonly saves: SaveStore;
  readonly content: ContentLoader;
  /** From games/<id>/content/strings.json; {name} placeholders filled from params. */
  strings(key: string, params?: Record<string, string | number>): string;
  readonly ui: Ui;
  readonly log: Logger;
  readonly settings: Settings;
  /** Return to the launcher (calls shutdown). */
  exit(): void;
}
