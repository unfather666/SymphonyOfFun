// Level select rules: a 10x10 grid of levels, cursor movement, and what each cell shows.
import { levelPlayable } from './unlocks';

export const SEL_COLS = 10;
export const SEL_ROWS = 10;
/** Screen layout in 384x216 space, shared by drawing and tap handling. */
export const CELL_W = 30;
export const CELL_H = 15;
export const GRID_X = (384 - SEL_COLS * CELL_W) / 2;
export const GRID_Y = 24;
/** The on-screen RIG button for touch players. */
export const RIG_BTN = { x: 8, y: 200, w: 44, h: 14 };

/** Level number under a screen point, or 0 when the point is off the grid. */
export function cellAt(x: number, y: number): number {
  const col = Math.floor((x - GRID_X) / CELL_W);
  const row = Math.floor((y - GRID_Y) / CELL_H);
  if (col < 0 || col >= SEL_COLS || row < 0 || row >= SEL_ROWS || x < GRID_X || y < GRID_Y) return 0;
  return row * SEL_COLS + col + 1;
}

export function inRigButton(x: number, y: number): boolean {
  return x >= RIG_BTN.x && x < RIG_BTN.x + RIG_BTN.w && y >= RIG_BTN.y && y < RIG_BTN.y + RIG_BTN.h;
}

/** Move the cursor (1-based level number) by whole cells, staying on the grid. */
export function moveCursor(n: number, dx: number, dy: number): number {
  const col = Math.min(SEL_COLS - 1, Math.max(0, ((n - 1) % SEL_COLS) + dx));
  const row = Math.min(SEL_ROWS - 1, Math.max(0, Math.floor((n - 1) / SEL_COLS) + dy));
  return row * SEL_COLS + col + 1;
}

export type LevelStatus = 'cleared' | 'open' | 'locked';

export function levelStatus(n: number, totalPoints: number, cleared: readonly number[], mult: number): LevelStatus {
  if (!levelPlayable(n, totalPoints, mult)) return 'locked';
  return cleared.includes(n) ? 'cleared' : 'open';
}

/** The level the cursor should rest on when the screen opens: the next one after the highest cleared, if playable. */
export function startCursor(cleared: readonly number[], totalPoints: number, mult: number): number {
  let best = 0;
  for (const n of cleared) if (n > best) best = n;
  const next = Math.min(SEL_COLS * SEL_ROWS, best + 1);
  return levelPlayable(next, totalPoints, mult) ? next : best || 1;
}
