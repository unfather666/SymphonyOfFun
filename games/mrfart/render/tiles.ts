// Tile layer: the grid as a core TileMap (frame index = tile id). Built once.
import type { TileMap } from '../../../src/core/api';
import type { MapData } from '../logic/map';

export function makeTileMap(map: MapData): TileMap {
  const data = new Int16Array(map.w * map.h);
  for (let i = 0; i < data.length; i++) data[i] = map.tiles[i]!;
  return { w: map.w, h: map.h, data };
}
