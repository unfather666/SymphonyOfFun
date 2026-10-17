// Level generator: generate(levelNo) is a pure function of the level number and the tier tables, so every player gets the same level.
// Layout: a 5x4 grid of 22-tile cells, 4-8 of them hold a room (12-20 tiles square) joined by 2-wide corridors on the cell centre cross.
import { hash32, mulberry32, type Rng } from './rng';
import { TILE, T_FLOOR, T_GLASS, T_LAMP, T_WALL, T_WATER, isSolid } from './tiles';
import type { TierTable } from './tiers';
import type { LevelPlan, RoomPlan, ScriptEntry, SpawnEntry } from './types';

export const CELL = 22;
export const COLS = 5;
export const ROWS = 4;
export const LEVELS = 100;
const DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TRICK_MS = { blackout: 3500, spotlight: 7000, strobe: 4000, pulse: 14000 } as const;

export interface GenOpts {
  /** One spawn in this many is an elite. */
  eliteEvery: number;
  /** Enemy hp grows by this fraction per level. */
  hpStep: number;
}

interface Cell {
  cx: number;
  cy: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
}

export const tierOfLevel = (n: number): number => Math.min(9, Math.max(0, Math.floor(n / 10)));
export const isBossLevel = (n: number): boolean => n % 10 === 0;

const centre = (c: Cell) => ({ x: c.ox + (c.w >> 1), y: c.oy + (c.h >> 1) });
const px = (t: number) => t * TILE + TILE / 2;

function pickEnemy(rng: Rng, t: TierTable): TierTable['enemies'][number] {
  let sum = 0;
  for (const e of t.enemies) sum += e.weight;
  let r = rng.float() * sum;
  for (const e of t.enemies) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return t.enemies[t.enemies.length - 1]!;
}

function carve(tiles: Uint8Array, w: number, x0: number, y0: number, cw: number, ch: number, kind: number): void {
  for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) tiles[y * w + x] = kind;
}

function makeScript(rng: Rng, t: TierTable, totalWaves: number): ScriptEntry[] {
  const out: ScriptEntry[] = [];
  const n = t.tricks.length ? t.scriptEntries : 0;
  for (let k = 0; k < n; k++) {
    const kind = t.tricks[k % t.tricks.length]!;
    const e: ScriptEntry = { atWave: 1 + Math.floor((k * totalWaves) / n) + (k > 0 ? rng.int(0, 1) : 0), kind, ms: TRICK_MS[kind] };
    if (kind === 'strobe') e.hz = 5;
    out.push(e);
  }
  out.sort((a, b) => a.atWave! - b.atWave!);
  return out;
}

/** The boss arena: one 24x16 room, four pillars, the boss and its minions arrive together. */
function bossArena(levelNo: number, t: TierTable, rng: Rng, o: GenOpts): LevelPlan {
  const W = 28;
  const H = 20;
  const tiles = new Uint8Array(W * H).fill(T_WALL);
  carve(tiles, W, 2, 2, 24, 16, T_FLOOR);
  for (const [x, y] of [[7, 6], [7, 13], [20, 6], [20, 13]] as const) tiles[y * W + x] = T_WALL;
  const bossId = (levelNo === LEVELS ? t.finalBoss : undefined) ?? t.boss ?? t.enemies[0]!.def;
  const wave: SpawnEntry[] = [{ def: bossId, x: px(17), y: px(10) }];
  for (const m of t.bossMinions ?? [])
    for (let i = 0; i < m.count; i++) {
      let x = px(rng.int(10, 24));
      let y = px(rng.int(3, 16));
      if (isSolid(tiles[Math.floor(y / TILE) * W + Math.floor(x / TILE)]!)) {
        x = px(15);
        y = px(10);
      }
      wave.push({ def: m.def, x, y });
    }
  return {
    id: `level_${levelNo}`, w: W, h: H, tiles, start: { x: px(3), y: px(10) }, exit: { x: px(24), y: px(10) },
    rooms: [{ x: 2, y: 2, w: 24, h: 16, waves: [wave] }], ambient: t.ambient, tier: tierOfLevel(levelNo),
    script: [{ atWave: 1, kind: 'pulse', ms: 60000 }], level: levelNo, tint: t.tint, hpMul: 1 + (levelNo - 1) * o.hpStep,
  };
}

export function generate(levelNo: number, tables: readonly TierTable[], o: GenOpts): LevelPlan {
  const n = Math.min(LEVELS, Math.max(1, Math.floor(levelNo)));
  const t = tables[tierOfLevel(n)]!;
  const rng = mulberry32(hash32('shooter', n));
  if (isBossLevel(n)) return bossArena(n, t, rng, o);

  // Pick cells: grow a connected set from a random start cell.
  const cells: Cell[] = [];
  const at = new Map<number, number>();
  const edges: Array<[number, number]> = [];
  const add = (cx: number, cy: number): number => {
    const w = rng.int(12, 20);
    const h = rng.int(12, 20);
    cells.push({ cx, cy, w, h, ox: cx * CELL + ((CELL - w) >> 1), oy: cy * CELL + ((CELL - h) >> 1) });
    at.set(cy * COLS + cx, cells.length - 1);
    return cells.length - 1;
  };
  add(rng.int(0, COLS - 1), rng.int(0, ROWS - 1));
  const want = rng.int(4, 8);
  for (let guard = 0; cells.length < want && guard < 1000; guard++) {
    const from = rng.int(0, cells.length - 1);
    const d = DIRS[rng.int(0, 3)]!;
    const cx = cells[from]!.cx + d[0];
    const cy = cells[from]!.cy + d[1];
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS || at.has(cy * COLS + cx)) continue;
    edges.push([from, add(cx, cy)]);
  }
  // A few extra doors make loops.
  const joined = new Set(edges.map(([a, b]) => a * 64 + b));
  for (let a = 0; a < cells.length; a++)
    for (let b = a + 1; b < cells.length; b++) {
      const near = Math.abs(cells[a]!.cx - cells[b]!.cx) + Math.abs(cells[a]!.cy - cells[b]!.cy) === 1;
      if (near && !joined.has(a * 64 + b) && rng.chance(0.2)) edges.push([a, b]);
    }

  const W = COLS * CELL;
  const H = ROWS * CELL;
  const tiles = new Uint8Array(W * H).fill(T_WALL);
  for (const c of cells) carve(tiles, W, c.ox, c.oy, c.w, c.h, T_FLOOR);
  for (const [a, b] of edges) {
    const ca = cells[a]!;
    const cb = cells[b]!;
    const pa = centre(ca);
    const pb = centre(cb);
    if (ca.cy === cb.cy) carve(tiles, W, Math.min(pa.x, pb.x), ca.cy * CELL + 10, Math.abs(pa.x - pb.x) + 1, 2, T_FLOOR);
    else carve(tiles, W, ca.cx * CELL + 10, Math.min(pa.y, pb.y), 2, Math.abs(pa.y - pb.y) + 1, T_FLOOR);
  }

  // Water, then pillars. Pillars sit on a 3-tile lattice, clear of the centre cross and the room edge, so every floor tile stays connected.
  for (const c of cells) {
    if (rng.chance(t.water)) {
      const pw = rng.int(3, 5);
      const ph = rng.int(2, 4);
      carve(tiles, W, c.ox + rng.int(1, c.w - pw - 1), c.oy + rng.int(1, c.h - ph - 1), pw, ph, T_WATER);
    }
    const mx = c.w >> 1;
    const my = c.h >> 1;
    for (let ry = 2; ry <= c.h - 3; ry += 3)
      for (let rx = 2; rx <= c.w - 3; rx += 3) {
        if (Math.abs(rx - mx) <= 2 || Math.abs(ry - my) <= 2 || !rng.chance(t.pillars)) continue;
        const r = rng.float();
        tiles[(c.oy + ry) * W + c.ox + rx] = r < 0.15 ? T_GLASS : r < 0.25 ? T_LAMP : T_WALL;
      }
  }

  // Exit: the room farthest from the start by door count.
  const dist = new Array<number>(cells.length).fill(-1);
  dist[0] = 0;
  for (let head = 0, q = [0]; head < q.length; head++)
    for (const [a, b] of edges) {
      const from = q[head]!;
      const other = a === from ? b : b === from ? a : -1;
      if (other >= 0 && dist[other] === -1) {
        dist[other] = dist[from]! + 1;
        q.push(other);
      }
    }
  let far = 0;
  for (let i = 1; i < cells.length; i++) if (dist[i]! > dist[far]!) far = i;
  const exit = centre(cells[far]!);

  // Waves: every room but the start room, enemies picked by weight, one in `eliteEvery` is an elite.
  const size = t.waveSize + Math.floor((n % 10) / 3);
  let spawned = 0;
  const rooms: RoomPlan[] = cells.map((c, i) => {
    const waves: SpawnEntry[][] = [];
    for (let wv = 0; i > 0 && wv < t.waves; wv++) {
      const wave: SpawnEntry[] = [];
      while (wave.length < size) {
        const pick = pickEnemy(rng, t);
        let bx = c.ox + c.w / 2;
        let by = c.oy + c.h / 2;
        for (let tries = 0; tries < 24; tries++) {
          const tx = c.ox + rng.int(1, c.w - 2);
          const ty = c.oy + rng.int(1, c.h - 2);
          if (isSolid(tiles[ty * W + tx]!) || Math.abs(tx - exit.x) + Math.abs(ty - exit.y) < 5) continue;
          bx = tx + 0.5;
          by = ty + 0.5;
          break;
        }
        for (let k = 0; k < (pick.pack ?? 1); k++) {
          const jx = k === 0 ? 0 : rng.range(-4, 4);
          const jy = k === 0 ? 0 : rng.range(-4, 4);
          const x = bx * TILE + jx;
          const y = by * TILE + jy;
          const ok = !isSolid(tiles[Math.floor(y / TILE) * W + Math.floor(x / TILE)]!);
          spawned++;
          wave.push({ def: pick.def, x: ok ? x : bx * TILE, y: ok ? y : by * TILE, elite: spawned % o.eliteEvery === 0 });
        }
      }
      waves.push(wave);
    }
    return { x: c.ox, y: c.oy, w: c.w, h: c.h, waves };
  });

  const s = centre(cells[0]!);
  return {
    id: `level_${n}`, w: W, h: H, tiles, start: { x: px(s.x), y: px(s.y) }, exit: { x: px(exit.x), y: px(exit.y) }, rooms,
    ambient: t.ambient, tier: tierOfLevel(n), script: makeScript(rng, t, (cells.length - 1) * t.waves), level: n, tint: t.tint,
    hpMul: 1 + (n - 1) * o.hpStep,
  };
}

/** Stable fingerprint of a plan (tiles, rooms, spawns, script) for the golden-hash fixture. */
export function planHash(p: LevelPlan): number {
  return hash32(p.id, p.w, p.h, p.tiles.join(''), JSON.stringify(p.rooms), JSON.stringify(p.start), JSON.stringify(p.exit), JSON.stringify(p.script), p.ambient, p.tint, p.hpMul);
}
