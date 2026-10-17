// Tile kinds and axis-separated box movement against them.
export const TILE = 16;
export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_WATER = 2;
export const T_GLASS = 3;
export const T_LAMP = 4;
export const T_EXIT_SHUT = 5;
export const T_EXIT_OPEN = 6;

export interface TileMap {
  w: number;
  h: number;
  data: Uint8Array;
}

export function tileAt(m: TileMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return T_WALL;
  return m.data[ty * m.w + tx]!;
}

export function isSolid(kind: number): boolean {
  return kind === T_WALL || kind === T_GLASS || kind === T_LAMP;
}

export function solidAtPx(m: TileMap, x: number, y: number): boolean {
  return isSolid(tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)));
}

export const BLOCKED_X = 1;
export const BLOCKED_Y = 2;

export interface Mover {
  x: number;
  y: number;
}

/** Move a square (half-extent `half`, centre p) by dx then dy, sliding along walls. Returns BLOCKED_X | BLOCKED_Y flags. */
export function moveBox(m: TileMap, p: Mover, half: number, dx: number, dy: number): number {
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8);
  if (n > 1) {
    // Long moves go in steps of at most half a tile so a fast box cannot skip a wall.
    let f = 0;
    for (let i = 0; i < n; i++) f |= moveBox(m, p, half, dx / n, dy / n);
    return f;
  }
  let flags = 0;
  const eps = 0.001;
  // Only tiles ahead of the box count: a box that starts overlapping a wall (a spawn on a wall edge) can walk out, and is never snapped back through it.
  if (dx !== 0) {
    const ox = p.x;
    p.x += dx;
    const ty0 = Math.floor((p.y - half) / TILE);
    const ty1 = Math.floor((p.y + half - eps) / TILE);
    const tx0 = Math.floor((p.x - half) / TILE);
    const tx1 = Math.floor((p.x + half - eps) / TILE);
    let lim = dx > 0 ? Infinity : -Infinity;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        if (isSolid(tileAt(m, tx, ty))) {
          if (dx > 0 ? tx * TILE >= ox + half - eps : (tx + 1) * TILE <= ox - half + eps) lim = dx > 0 ? Math.min(lim, tx * TILE - half) : Math.max(lim, (tx + 1) * TILE + half);
        }
    if (lim !== Infinity && lim !== -Infinity) {
      p.x = lim;
      flags |= BLOCKED_X;
    }
  }
  if (dy !== 0) {
    const oy = p.y;
    p.y += dy;
    const tx0 = Math.floor((p.x - half) / TILE);
    const tx1 = Math.floor((p.x + half - eps) / TILE);
    const ty0 = Math.floor((p.y - half) / TILE);
    const ty1 = Math.floor((p.y + half - eps) / TILE);
    let lim = dy > 0 ? Infinity : -Infinity;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        if (isSolid(tileAt(m, tx, ty))) {
          if (dy > 0 ? ty * TILE >= oy + half - eps : (ty + 1) * TILE <= oy - half + eps) lim = dy > 0 ? Math.min(lim, ty * TILE - half) : Math.max(lim, (ty + 1) * TILE + half);
        }
    if (lim !== Infinity && lim !== -Infinity) {
      p.y = lim;
      flags |= BLOCKED_Y;
    }
  }
  return flags;
}

/** Is a square of half-extent `half` centred on (x, y) clear of solid tiles? */
export function boxOpen(m: TileMap, x: number, y: number, half: number): boolean {
  const eps = 0.001;
  const tx0 = Math.floor((x - half) / TILE);
  const tx1 = Math.floor((x + half - eps) / TILE);
  const ty0 = Math.floor((y - half) / TILE);
  const ty1 = Math.floor((y + half - eps) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (isSolid(tileAt(m, tx, ty))) return false;
  return true;
}

/** Straight-line check between two points through solid tiles (marched in 4 px steps). */
export function lineClear(m: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.hypot(dx, dy) / 4);
  for (let i = 1; i < n; i++) if (solidAtPx(m, x0 + (dx * i) / n, y0 + (dy * i) / n)) return false;
  return true;
}
