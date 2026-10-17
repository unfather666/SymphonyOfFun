// Spatial hash for circle queries without scanning every entity. Rebuilt each step from the live list.
export interface Grid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  head: Int32Array;
  next: Int32Array;
}

export function createGrid(widthPx: number, heightPx: number, cell: number, maxItems: number): Grid {
  const cols = Math.max(1, Math.ceil(widthPx / cell));
  const rows = Math.max(1, Math.ceil(heightPx / cell));
  return { cell, cols, rows, head: new Int32Array(cols * rows).fill(-1), next: new Int32Array(maxItems).fill(-1) };
}

export function gridClear(g: Grid): void {
  g.head.fill(-1);
}

/** Insert item `id` (a pool slot) at a point. Ids must be below maxItems. */
export function gridInsert(g: Grid, id: number, x: number, y: number): void {
  const cx = Math.min(g.cols - 1, Math.max(0, Math.floor(x / g.cell)));
  const cy = Math.min(g.rows - 1, Math.max(0, Math.floor(y / g.cell)));
  const c = cy * g.cols + cx;
  g.next[id] = g.head[c]!;
  g.head[c] = id;
}

/** Fill `out` with ids in cells touching the square [x-r, x+r] x [y-r, y+r]; returns the count. Callers still test distance. */
export function gridQuery(g: Grid, x: number, y: number, r: number, out: Int32Array): number {
  const x0 = Math.max(0, Math.floor((x - r) / g.cell));
  const x1 = Math.min(g.cols - 1, Math.floor((x + r) / g.cell));
  const y0 = Math.max(0, Math.floor((y - r) / g.cell));
  const y1 = Math.min(g.rows - 1, Math.floor((y + r) / g.cell));
  let n = 0;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      let id = g.head[cy * g.cols + cx]!;
      while (id >= 0 && n < out.length) {
        out[n++] = id;
        id = g.next[id]!;
      }
    }
  return n;
}
