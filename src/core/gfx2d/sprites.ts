import type { SpriteDef } from '../api';
import { charToIndex } from './palette';

/** Decode a sprite def into palette indices (-1 transparent), one Int8Array per frame. Throws plain-English errors. */
export function decodeSprite(id: string, def: SpriteDef): Int8Array[] {
  if (!(def.w > 0 && def.h > 0)) throw new Error(`Sprite "${id}": w and h must be above 0.`);
  if (def.frames.length === 0) throw new Error(`Sprite "${id}": no frames.`);
  return def.frames.map((rows, f) => {
    if (rows.length !== def.h) throw new Error(`Sprite "${id}" frame ${f}: ${rows.length} rows, expected ${def.h}.`);
    const out = new Int8Array(def.w * def.h);
    rows.forEach((row, y) => {
      if (row.length !== def.w) throw new Error(`Sprite "${id}" frame ${f} row ${y}: ${row.length} chars, expected ${def.w}.`);
      for (let x = 0; x < def.w; x++) {
        const ch = row[x]!;
        const idx = def.keys && ch in def.keys ? def.keys[ch]! : charToIndex(ch);
        if (idx > 31) throw new Error(`Sprite "${id}": colour index ${idx} above 31.`);
        out[y * def.w + x] = idx;
      }
    });
    return out;
  });
}
