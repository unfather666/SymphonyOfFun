// Builds the neighbourhood tile grid from content/map.json: tiles, solid flags, merged wall rects, prop spawns, street nodes.
export const TILE = 16;

export const T = {
  GRASS: 0, STREET: 1, SIDEWALK: 2, FENCE: 3, ROOF_HOUSE: 4, ROOF_SHOP: 5, ROOF_CHURCH: 6, ROOF_PAWN: 7, ROOF_PAD: 8,
  DOOR: 9, TREE: 10, PARK: 11, CROSSWALK: 12, WATER: 13, ROOF_DEPOT: 14,
} as const;
const SOLID_FROM_TILE = new Set<number>([T.FENCE, T.ROOF_HOUSE, T.ROOF_SHOP, T.ROOF_CHURCH, T.ROOF_PAWN, T.ROOF_PAD, T.DOOR, T.TREE, T.WATER, T.ROOF_DEPOT]);

export interface CellTypeDef {
  kind: string;
  roof: number;
  building?: [number, number, number, number];
  door?: number;
  trees?: Array<[number, number]>;
  props?: Array<{ def: string; at: [number, number] }>;
}
export interface MapDef {
  cell: { w: number; h: number; streetX: number; streetY: number };
  layout: string[];
  cells: Record<string, CellTypeDef>;
}
export interface PropSpawn {
  def: string;
  x: number;
  y: number;
}
export interface CellInfo {
  col: number;
  row: number;
  kind: string;
  key: string;
  /** Tile rect of the lot (excluding streets). */
  tx: number;
  ty: number;
  tw: number;
  th: number;
  /** Door anchor in px (the sidewalk tile in front of the door), or the lot centre if the cell has none. */
  doorX: number;
  doorY: number;
}
export interface MapData {
  cols: number;
  rows: number;
  /** Size in tiles. */
  w: number;
  h: number;
  pxW: number;
  pxH: number;
  tiles: Uint8Array;
  solid: Uint8Array;
  /** Merged solid rectangles in tiles: [tx, ty, tw, th]. */
  rects: Array<[number, number, number, number]>;
  props: PropSpawn[];
  /** Tree centres in px, with the cell they stand in. */
  trees: Array<{ x: number; y: number; cell: number }>;
  cells: CellInfo[];
  cellW: number;
  cellH: number;
  streetX: number;
  streetY: number;
}

const OFF = 1; // border ring of fence tiles

export function buildMap(def: MapDef): MapData {
  const { w: cw, h: ch, streetX, streetY } = def.cell;
  const rows = def.layout.length;
  const cols = def.layout[0]!.length;
  const w = cols * cw + OFF * 2, h = rows * ch + OFF * 2;
  const tiles = new Uint8Array(w * h);
  const set = (tx: number, ty: number, id: number) => {
    if (tx >= 0 && ty >= 0 && tx < w && ty < h) tiles[ty * w + tx] = id;
  };
  const props: PropSpawn[] = [];
  const cells: CellInfo[] = [];
  const trees: MapData['trees'] = [];
  for (let row = 0; row < rows; row++) {
    const line = def.layout[row]!;
    if (line.length !== cols) throw new Error(`map.json: layout row ${row} has ${line.length} cells, expected ${cols}.`);
    for (let col = 0; col < cols; col++) {
      const key = line[col]!;
      const ct = def.cells[key];
      if (!ct) throw new Error(`map.json: layout uses "${key}" but no such cell type is defined.`);
      const ox = OFF + col * cw, oy = OFF + row * ch;
      for (let ly = 0; ly < ch; ly++)
        for (let lx = 0; lx < cw; lx++) {
          const street = lx >= streetX || ly >= streetY;
          let id: number = ct.kind === 'park' && !street ? T.PARK : T.GRASS;
          if (street) id = T.STREET;
          else if (ly === streetY - 1 || lx === streetX - 1) id = ct.kind === 'park' ? T.PARK : T.SIDEWALK;
          set(ox + lx, oy + ly, id);
        }
      let doorX = (ox + streetX / 2) * TILE, doorY = (oy + streetY / 2) * TILE;
      if (ct.building) {
        const [bx, by, bw, bh] = ct.building;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) set(ox + bx + x, oy + by + y, ct.roof);
        const dx = ox + bx + (ct.door ?? Math.floor(bw / 2)), dy = oy + by + bh - 1;
        set(dx, dy, T.DOOR);
        doorX = (dx + 0.5) * TILE;
        doorY = (dy + 1.5) * TILE;
      }
      for (const [tx, ty] of ct.trees ?? []) {
        set(ox + tx, oy + ty, T.TREE);
        trees.push({ x: (ox + tx + 0.5) * TILE, y: (oy + ty + 0.5) * TILE, cell: cells.length });
      }
      for (const p of ct.props ?? []) props.push({ def: p.def, x: (ox + p.at[0] + 0.5) * TILE, y: (oy + p.at[1] + 0.5) * TILE });
      cells.push({ col, row, kind: ct.kind, key, tx: ox, ty: oy, tw: streetX, th: streetY, doorX, doorY });
    }
  }
  for (let x = 0; x < w; x++) { set(x, 0, T.FENCE); set(x, h - 1, T.FENCE); }
  for (let y = 0; y < h; y++) { set(0, y, T.FENCE); set(w - 1, y, T.FENCE); }
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < tiles.length; i++) solid[i] = SOLID_FROM_TILE.has(tiles[i]!) ? 1 : 0;
  return { cols, rows, w, h, pxW: w * TILE, pxH: h * TILE, tiles, solid, rects: mergeSolid(solid, w, h), props, trees, cells, cellW: cw, cellH: ch, streetX, streetY };
}

/** Greedy merge of solid tiles into rectangles: row runs, extended downward while the same run repeats. */
export function mergeSolid(solid: Uint8Array, w: number, h: number): Array<[number, number, number, number]> {
  const used = new Uint8Array(w * h);
  const out: Array<[number, number, number, number]> = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!solid[y * w + x] || used[y * w + x]) continue;
      let rw = 0;
      while (x + rw < w && solid[y * w + x + rw] && !used[y * w + x + rw]) rw++;
      let rh = 1;
      for (;;) {
        if (y + rh >= h) break;
        let ok = true;
        for (let k = 0; k < rw; k++) if (!solid[(y + rh) * w + x + k] || used[(y + rh) * w + x + k]) { ok = false; break; }
        if (!ok) break;
        rh++;
      }
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) used[(y + yy) * w + x + xx] = 1;
      out.push([x, y, rw, rh]);
    }
  return out;
}

export function solidAt(map: MapData, px: number, py: number): boolean {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return map.solid[ty * map.w + tx] === 1;
}

/** Walk the segment in half-tile steps; false when it crosses a solid tile. */
export function lineClear(map: MapData, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (TILE / 2)));
  for (let i = 1; i < n; i++) if (solidAt(map, x0 + (dx * i) / n, y0 + (dy * i) / n)) return false;
  return true;
}

/** Street intersection nodes: one per cell, at the middle of the crossing at its bottom-right corner. */
export function nodePos(map: MapData, col: number, row: number, out: { x: number; y: number }): void {
  out.x = (OFF + col * map.cellW + map.streetX + 1.5) * TILE;
  out.y = (OFF + row * map.cellH + map.streetY + 1.5) * TILE;
}
