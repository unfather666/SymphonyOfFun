// Proves box movement slides along walls with exact positions, plus line of sight and the flow field. Area: logic/tiles, flow. 2026-10-17
import { describe, expect, test } from 'vitest';
import { computeFlow, flowTarget } from '../logic/flow';
import { BLOCKED_X, BLOCKED_Y, T_FLOOR, T_WALL, lineClear, moveBox, type TileMap } from '../logic/tiles';

function map(rows: string[]): TileMap {
  const h = rows.length;
  const w = rows[0]!.length;
  const data = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (data[y * w + x] = c === '#' ? T_WALL : T_FLOOR)));
  return { w, h, data };
}

describe('moveBox', () => {
  const m = map(['#####', '#...#', '#...#', '#####']);
  test('free movement is exact', () => {
    const p = { x: 24, y: 24 };
    expect(moveBox(m, p, 5, 3, 2)).toBe(0);
    expect(p).toEqual({ x: 27, y: 26 });
  });
  test('stops flush against a wall on x', () => {
    const p = { x: 56, y: 24 };
    expect(moveBox(m, p, 5, 10, 0)).toBe(BLOCKED_X);
    expect(p.x).toBe(64 - 5);
  });
  test('slides along y while blocked on x', () => {
    const p = { x: 58, y: 24 };
    const flags = moveBox(m, p, 5, 10, 4);
    expect(flags).toBe(BLOCKED_X);
    expect(p.x).toBe(64 - 5);
    expect(p.y).toBe(28);
  });
  test('stops against the floor wall on y', () => {
    const p = { x: 32, y: 40 };
    expect(moveBox(m, p, 5, 0, 20)).toBe(BLOCKED_Y);
    expect(p.y).toBe(48 - 5);
  });
  test('a move longer than a tile still stops at the nearest wall', () => {
    const p = { x: 32, y: 40 };
    moveBox(m, p, 5, 0, 30);
    expect(p.y).toBe(48 - 5);
  });
});

describe('lineClear', () => {
  const m = map(['#######', '#..#..#', '#..#..#', '#######']);
  test('clear inside a room, blocked through a wall', () => {
    expect(lineClear(m, 24, 24, 24, 40)).toBe(true);
    expect(lineClear(m, 24, 24, 88, 24)).toBe(false);
  });
});

describe('flow field', () => {
  const m = map(['#######', '#..#..#', '#.##..#', '#.....#', '#######']);
  test('walking distance goes round the wall and flowTarget steps downhill', () => {
    const dist = new Int16Array(m.w * m.h);
    computeFlow(m, 4, 1, dist, new Int32Array(m.w * m.h), 60);
    expect(dist[1 * 7 + 4]).toBe(0);
    expect(dist[1 * 7 + 1]).toBe(7);
    expect(dist[1 * 7 + 3]).toBe(-1);
    const out = { x: 0, y: 0 };
    expect(flowTarget(m, dist, 1 * 16 + 8, 1 * 16 + 8, out)).toBe(true);
    expect(out).toEqual({ x: 1 * 16 + 8, y: 2 * 16 + 8 });
  });
});
