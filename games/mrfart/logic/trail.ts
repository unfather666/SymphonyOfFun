// The player's recent path. Followers that cannot see the player head for the newest point of it they can see, so they turn corners where the player did.
import { lineClear } from './map';
import type { Sim } from './sim';

export const TRAIL_N = 64;
const GAP = 6;

export interface Trail {
  x: Float32Array;
  y: Float32Array;
  /** Points written so far; the newest is at (n - 1) % TRAIL_N. */
  n: number;
}

export const createTrail = (): Trail => ({ x: new Float32Array(TRAIL_N), y: new Float32Array(TRAIL_N), n: 0 });

/** Record the player's position every GAP px of travel. */
export function pushTrail(sim: Sim): void {
  const t = sim.trail, pl = sim.player;
  if (t.n > 0) {
    const i = (t.n - 1) % TRAIL_N;
    if (Math.hypot(pl.x - t.x[i]!, pl.y - t.y[i]!) < GAP) return;
  }
  const j = t.n % TRAIL_N;
  t.x[j] = pl.x;
  t.y[j] = pl.y;
  t.n++;
}

/** A body of half-width `half` fits along the line: the centre line and two parallel ones are all clear. */
export function wideClear(sim: Sim, x0: number, y0: number, x1: number, y1: number, half: number): boolean {
  const { map } = sim.deps;
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = (-(y1 - y0) / d) * half, ny = ((x1 - x0) / d) * half;
  return lineClear(map, x0, y0, x1, y1) && lineClear(map, x0 + nx, y0 + ny, x1 + nx, y1 + ny) && lineClear(map, x0 - nx, y0 - ny, x1 - nx, y1 - ny);
}

/** Where a follower at (x,y) should head: the player if visible, else the newest visible trail point. Tries the full body width first, then the centre line alone. Writes sim.aim. */
export function aimAt(sim: Sim, x: number, y: number, half: number): void {
  const pl = sim.player, t = sim.trail;
  const out = sim.aim;
  const have = Math.min(t.n, TRAIL_N);
  for (let pass = 0; pass < 2; pass++) {
    const h = pass === 0 ? half : 0;
    if (wideClear(sim, x, y, pl.x, pl.y, h)) {
      out.x = pl.x;
      out.y = pl.y;
      return;
    }
    for (let k = 0; k < have; k++) {
      const i = (t.n - 1 - k + TRAIL_N * 2) % TRAIL_N;
      if (wideClear(sim, x, y, t.x[i]!, t.y[i]!, h)) {
        out.x = t.x[i]!;
        out.y = t.y[i]!;
        return;
      }
    }
  }
  out.x = pl.x;
  out.y = pl.y;
}
