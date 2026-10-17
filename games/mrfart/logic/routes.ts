// Daily routes for people: home, then a few anchors (shop, bench, bus stop...), walking street to street.
import { streetCenterX, streetCenterY, cellAt } from './map';
import type { MapData } from './map';
import type { Rng } from './rng';
import type { Rules } from './rules';
import type { PersonDef } from './types';

const ORIGIN_KINDS = ['house', 'grandma'];

/** Cell indexes of a kind, in map order. */
export function cellsOfKind(map: MapData, kind: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < map.cells.length; i++) if (map.cells[i]!.kind === kind) out.push(i);
  return out;
}

/**
 * Polyline along the streets from A to B: out of A to its street row, along the row to B's column,
 * along the column to B's row, then to B. Appends x,y pairs after A (A itself is not repeated).
 */
export function streetPath(map: MapData, ax: number, ay: number, bx: number, by: number, out: number[]): void {
  const a = map.cells[cellAt(map, ax, ay)]!, b = map.cells[cellAt(map, bx, by)]!;
  const cyA = streetCenterY(map, a.row), cyB = streetCenterY(map, b.row), cxB = streetCenterX(map, b.col);
  const pts = [ax, cyA, cxB, cyA, cxB, cyB, bx, cyB, bx, by];
  let lx = ax, ly = ay;
  for (let i = 0; i < pts.length; i += 2) {
    if (Math.abs(pts[i]! - lx) + Math.abs(pts[i + 1]! - ly) < 4) continue;
    out.push(pts[i]!, pts[i + 1]!);
    lx = pts[i]!;
    ly = pts[i + 1]!;
  }
}

function homeCell(map: MapData, def: PersonDef): number {
  const [hc, hr] = def.home ?? [0, 0];
  let best = 0, bd = Infinity;
  for (let i = 0; i < map.cells.length; i++) {
    const c = map.cells[i]!;
    if (!ORIGIN_KINDS.includes(c.kind)) continue;
    const d = (c.col - hc) * (c.col - hc) + (c.row - hr) * (c.row - hr);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Waypoints x, y, dwellMs for one person's loop. Same inputs and rng state give the same route. */
export function buildRoute(def: PersonDef, idx: number, map: MapData, rules: Rules, rng: Rng): number[] {
  const p = rules.people;
  const stops: number[] = [homeCell(map, def)];
  (def.anchors ?? []).forEach((kind, a) => {
    const list = cellsOfKind(map, kind);
    if (list.length > 0) stops.push(list[(idx * 7 + a * 3) % list.length]!);
  });
  const route: number[] = [];
  let px = 0, py = 0;
  for (let s = 0; s <= stops.length; s++) {
    const cell = map.cells[stops[s % stops.length]!]!;
    const home = s === 0 || s === stops.length;
    const path: number[] = [];
    if (s > 0) streetPath(map, px, py, cell.doorX, cell.doorY, path);
    for (let i = 0; i < path.length; i += 2) route.push(path[i]!, path[i + 1]!, 0);
    if (s === 0) route.push(cell.doorX, cell.doorY, rng.range(p.homeDwellMinMs, p.homeDwellMaxMs));
    else if (path.length === 0 || route[route.length - 3] !== cell.doorX) route.push(cell.doorX, cell.doorY, home ? rng.range(p.homeDwellMinMs, p.homeDwellMaxMs) : rng.range(p.dwellMinMs, p.dwellMaxMs));
    else route[route.length - 1] = home ? rng.range(p.homeDwellMinMs, p.homeDwellMaxMs) : rng.range(p.dwellMinMs, p.dwellMaxMs);
    px = cell.doorX;
    py = cell.doorY;
  }
  route.length -= 3; // the last home stop is the first waypoint of the next loop
  return route;
}
