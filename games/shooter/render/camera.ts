// Camera: follows the player, clamped to the map; small maps are centred.
import type { World } from '../logic/types';

export const VIEW_W = 384;
export const VIEW_H = 216;

export interface Cam {
  x: number;
  y: number;
}

/** Camera for a player position (pixels). Used by draw (interpolated) and by pointer aiming (current). */
export function cameraAt(w: World, px: number, py: number, out: Cam): Cam {
  const mw = w.map.w * 16;
  const mh = w.map.h * 16;
  out.x = mw <= VIEW_W ? (mw - VIEW_W) / 2 : Math.max(0, Math.min(mw - VIEW_W, px - VIEW_W / 2));
  out.y = mh <= VIEW_H ? (mh - VIEW_H) / 2 : Math.max(0, Math.min(mh - VIEW_H, py - VIEW_H / 2));
  return out;
}
