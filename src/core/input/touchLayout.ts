import { SCREEN_H, SCREEN_W } from '../api';

/** Touch overlay geometry in 384x216 space. */
export const STICK_RADIUS = 24;
export const BUTTONS = [
  { action: 'a' as const, x: SCREEN_W - 26, y: SCREEN_H - 34, r: 14, label: 'A' },
  { action: 'b' as const, x: SCREEN_W - 58, y: SCREEN_H - 20, r: 12, label: 'B' },
];
export const PAUSE_BUTTON = { action: 'select' as const, x: SCREEN_W - 12, y: 12, r: 9, label: '=' };

export function hitButton(x: number, y: number) {
  for (const b of [...BUTTONS, PAUSE_BUTTON]) if (Math.hypot(x - b.x, y - b.y) <= b.r + 4) return b;
  return null;
}

/** Stick vector from its anchor, clamped to length 1. */
export function stickVector(ax: number, ay: number, x: number, y: number, r = STICK_RADIUS) {
  let dx = (x - ax) / r;
  let dy = (y - ay) / r;
  const l = Math.hypot(dx, dy);
  if (l > 1) {
    dx /= l;
    dy /= l;
  }
  return { x: dx, y: dy };
}
