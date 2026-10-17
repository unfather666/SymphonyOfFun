// Hand-written rooms: rows of characters to a LevelPlan. # wall . floor ~ water g glass L lamp S start E exit.
import { TILE, T_FLOOR, T_GLASS, T_LAMP, T_WALL, T_WATER } from './tiles';
import type { LevelPlan, ScriptEntry, SpawnEntry } from './types';

export interface RoomDef {
  id: string;
  rows: readonly string[];
  waves: ReadonlyArray<ReadonlyArray<{ def: string; tx: number; ty: number; elite?: boolean }>>;
  ambient: number;
  tier: number;
  script?: ReadonlyArray<ScriptEntry>;
}

const GLYPH: Record<string, number> = { '#': T_WALL, '.': T_FLOOR, '~': T_WATER, g: T_GLASS, L: T_LAMP, S: T_FLOOR, E: T_FLOOR };

export function parseRoom(def: RoomDef): { plan: LevelPlan | null; errors: string[] } {
  const errors: string[] = [];
  const h = def.rows.length;
  const w = def.rows[0]?.length ?? 0;
  if (h === 0 || w === 0) return { plan: null, errors: [`room "${def.id}" has no rows; dropped.`] };
  const tiles = new Uint8Array(w * h);
  let start: { x: number; y: number } | null = null;
  let exit: { x: number; y: number } | null = null;
  for (let y = 0; y < h; y++) {
    const row = def.rows[y]!;
    if (row.length !== w) {
      errors.push(`room "${def.id}" row ${y} is ${row.length} wide, expected ${w}; dropped.`);
      return { plan: null, errors };
    }
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      const kind = GLYPH[ch];
      if (kind === undefined) {
        errors.push(`room "${def.id}" has an unknown tile "${ch}" at ${x},${y}; dropped.`);
        return { plan: null, errors };
      }
      tiles[y * w + x] = kind;
      if (ch === 'S') start = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      if (ch === 'E') exit = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
    }
  }
  if (!start) {
    errors.push(`room "${def.id}" has no start tile S; dropped.`);
    return { plan: null, errors };
  }
  const waves: SpawnEntry[][] = def.waves.map((wave) =>
    wave.map((s) => ({ def: s.def, x: s.tx * TILE + TILE / 2, y: s.ty * TILE + TILE / 2, elite: s.elite === true })),
  );
  for (const wave of waves)
    for (const s of wave) {
      const kind = tiles[Math.floor(s.y / TILE) * w + Math.floor(s.x / TILE)];
      if (kind === T_WALL || kind === T_GLASS || kind === T_LAMP) errors.push(`room "${def.id}": a spawn of "${s.def}" is inside a wall at ${Math.floor(s.x / TILE)},${Math.floor(s.y / TILE)}.`);
    }
  const plan: LevelPlan = {
    id: def.id, w, h, tiles, start, exit,
    rooms: [{ x: 1, y: 1, w: w - 2, h: h - 2, waves }],
    ambient: def.ambient, tier: def.tier, script: def.script ? [...def.script] : [],
  };
  return { plan, errors };
}
