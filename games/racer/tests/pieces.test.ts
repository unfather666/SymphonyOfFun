// Proves the flying-pieces pool never grows past its cap, counts what it skipped, and expires on the game clock (racer M3, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { burst, createPool, spawnPiece, stepPool } from '../logic/pieces';
import { newRand, seedRand } from '../logic/rng';

describe('pieces pool', () => {
  test('spawning past the cap is skipped and counted, never grown', () => {
    const p = createPool(5, 16);
    let ok = 0;
    for (let i = 0; i < 9; i++) if (spawnPiece(p, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1000, 0)) ok++;
    expect(ok).toBe(5);
    expect(p.n).toBe(5);
    expect(p.skipped).toBe(4);
    expect(p.x.length).toBe(5);
  });
  test('a burst into a nearly full pool takes only what fits', () => {
    const p = createPool(10, 16);
    for (let i = 0; i < 8; i++) spawnPiece(p, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1000, 0);
    const taken = burst(p, seedRand(newRand(), 1, 2), 6, 0, 1, 0, 5, 5, 0.4, 3, 0, 1000, 0);
    expect(taken).toBe(2);
    expect(p.n).toBe(10);
  });
  test('pieces expire exactly at their time on the game clock and free their slot', () => {
    const p = createPool(4, 16);
    spawnPiece(p, 0, 5, 0, 0, 0, 0, 1, 0, 1000, 500, 0);
    stepPool(p, 1499, 1 / 60);
    expect(p.n).toBe(1);
    stepPool(p, 1500, 1 / 60);
    expect(p.n).toBe(0);
    expect(spawnPiece(p, 0, 5, 0, 0, 0, 0, 1, 0, 1500, 500, 0)).toBe(true);
  });
  test('gravity pulls a piece down and it bounces on the floor', () => {
    const p = createPool(2, 16);
    spawnPiece(p, 0, 2, 0, 0, 0, 0, 1, 0, 0, 5000, 0);
    let t = 0;
    for (let i = 0; i < 120; i++) stepPool(p, (t += 1000 / 60), 1 / 60);
    expect(p.y[0]!).toBeGreaterThanOrEqual(0);
    expect(p.y[0]!).toBeLessThan(0.05);
  });
  test('expiring one of several keeps the others intact', () => {
    const p = createPool(4, 0);
    spawnPiece(p, 1, 0, 0, 0, 0, 0, 1, 1, 0, 100, -9);
    spawnPiece(p, 2, 0, 0, 0, 0, 0, 1, 2, 0, 900, -9);
    spawnPiece(p, 3, 0, 0, 0, 0, 0, 1, 3, 0, 900, -9);
    stepPool(p, 200, 0);
    expect(p.n).toBe(2);
    expect([p.x[0], p.x[1]].sort()).toEqual([2, 3]);
    expect(p.col[0]! + p.col[1]!).toBe(5);
  });
});
