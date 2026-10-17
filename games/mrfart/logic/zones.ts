// Zones: where a job starts, where it goes. Computed from the map when a job is generated or taken.
import { TILE, solidAt } from './map';
import type { MapData } from './map';
import type { PlaceDef, Zone } from './jobTypes';

/** Squared distance in cells between two cell indexes. */
function cellDistSq(map: MapData, a: number, b: number): number {
  const ca = map.cells[a]!, cb = map.cells[b]!;
  return (ca.col - cb.col) * (ca.col - cb.col) + (ca.row - cb.row) * (ca.row - cb.row);
}

export function originZone(map: MapData, cell: number, r: number, out: Zone): Zone {
  const c = map.cells[cell]!;
  out.x = c.doorX;
  out.y = c.doorY;
  out.r = r;
  return out;
}

/** Nearest cell of a kind to `from`, or -1. */
export function nearestCell(map: MapData, kind: string, from: number): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < map.cells.length; i++) {
    if (map.cells[i]!.kind !== kind) continue;
    const d = cellDistSq(map, i, from);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** The zone for a place seen from an origin cell; false when the map has no such place there. */
export function placeZone(map: MapData, place: PlaceDef, origin: number, r: number, out: Zone): boolean {
  out.r = r;
  if (place.kind === 'cell') {
    const c = nearestCell(map, place.cell, origin);
    if (c < 0 || c === origin) return false;
    out.x = map.cells[c]!.doorX;
    out.y = map.cells[c]!.doorY;
    return true;
  }
  if (place.kind === 'across') {
    const o = map.cells[origin]!;
    const x = o.doorX, y = o.doorY + 4 * TILE;
    if (solidAt(map, x, y)) return false;
    out.x = x;
    out.y = y;
    return true;
  }
  if (place.kind === 'tree') {
    let best = -1, bd = Infinity;
    for (let i = 0; i < map.trees.length; i++) {
      const t = map.trees[i]!;
      if (map.cells[t.cell]!.kind !== place.cell) continue;
      const d = cellDistSq(map, t.cell, origin);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return false;
    out.x = map.trees[best]!.x;
    out.y = map.trees[best]!.y + TILE * 0.8;
    return true;
  }
  return false;
}

/** Inside the zone circle, with optional extra slack in px. */
export function inZone(z: Zone, x: number, y: number, slack = 0): boolean {
  const r = z.r + slack;
  return (x - z.x) * (x - z.x) + (y - z.y) * (y - z.y) <= r * r;
}
