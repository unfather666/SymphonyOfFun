// Level select rules: a 10x10 grid of levels, cursor movement, and what each cell shows.
import { levelPlayable } from './unlocks';

export const SEL_COLS = 10;
export const SEL_ROWS = 10;

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
