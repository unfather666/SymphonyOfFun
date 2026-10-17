// Flow field: walking distance from the player's tile over non-solid tiles, so chasers path around walls.
import { TILE, isSolid, tileAt, type TileMap } from './tiles';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

/** Breadth-first fill from (tx, ty) up to maxD steps. dist and queue are reused buffers (no allocation). */
export function computeFlow(m: TileMap, tx: number, ty: number, dist: Int16Array, queue: Int32Array, maxD: number): void {
  dist.fill(-1);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return;
  let head = 0;
  let tail = 0;
  dist[ty * m.w + tx] = 0;
  queue[tail++] = ty * m.w + tx;
  while (head < tail) {
    const c = queue[head++]!;
    const d = dist[c]!;
    if (d >= maxD) continue;
    const cx = c % m.w;
    const cy = (c / m.w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = cx + DX[k]!;
      const ny = cy + DY[k]!;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const n = ny * m.w + nx;
      if (dist[n]! >= 0 || isSolid(tileAt(m, nx, ny))) continue;
      dist[n] = d + 1;
      queue[tail++] = n;
    }
  }
}

/** Pixel centre of the neighbouring tile with the lowest distance; returns false when nowhere better to go. out = [x, y]. */
export function flowTarget(m: TileMap, dist: Int16Array, x: number, y: number, out: { x: number; y: number }): boolean {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false;
  let best = dist[ty * m.w + tx]!;
  if (best < 0) best = 32767;
  let bx = -1;
  let by = -1;
  for (let k = 0; k < 4; k++) {
    const nx = tx + DX[k]!;
    const ny = ty + DY[k]!;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
    const d = dist[ny * m.w + nx]!;
    if (d >= 0 && d < best) {
      best = d;
      bx = nx;
      by = ny;
    }
  }
  if (bx < 0) return false;
  out.x = bx * TILE + TILE / 2;
  out.y = by * TILE + TILE / 2;
  return true;
}
