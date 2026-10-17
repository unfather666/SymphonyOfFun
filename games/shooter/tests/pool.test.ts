// Proves the pool follows its stated full policies and keeps the live list dense. Area: logic/pool. 2026-10-17
import { describe, expect, test } from 'vitest';
import { createPool, type PoolItem } from '../logic/pool';

const make = (): PoolItem & { v: number } => ({ alive: false, idx: -1, slot: 0, born: 0, v: 0 });

describe('pool', () => {
  test('skip policy returns null when full and counts the skip', () => {
    const p = createPool(3, make, 'skip');
    expect([p.acquire(), p.acquire(), p.acquire()].every((x) => x !== null)).toBe(true);
    expect(p.acquire()).toBeNull();
    expect(p.stats.skipped).toBe(1);
    expect(p.n).toBe(3);
  });
  test('replaceOldest recycles the oldest live item', () => {
    const p = createPool(3, make, 'replaceOldest');
    const a = p.acquire()!;
    a.v = 1;
    const b = p.acquire()!;
    b.v = 2;
    const c = p.acquire()!;
    c.v = 3;
    const d = p.acquire()!;
    expect(d).toBe(a);
    expect(p.stats.replaced).toBe(1);
    expect(p.n).toBe(3);
    const e = p.acquire()!;
    expect(e).toBe(b);
  });
  test('double release is counted and changes nothing', () => {
    const p = createPool(2, make, 'skip');
    const a = p.acquire()!;
    p.release(a);
    p.release(a);
    expect(p.stats.doubleRelease).toBe(1);
    expect(p.n).toBe(0);
    expect(p.acquire()).not.toBeNull();
    expect(p.acquire()).not.toBeNull();
    expect(p.acquire()).toBeNull();
  });
  test('release keeps the live list dense and idx correct', () => {
    const p = createPool(5, make, 'skip');
    const items = [0, 1, 2, 3, 4].map(() => p.acquire()!);
    p.release(items[1]!);
    p.release(items[3]!);
    expect(p.n).toBe(3);
    for (let i = 0; i < p.n; i++) {
      expect(p.live[i]!.idx).toBe(i);
      expect(p.live[i]!.alive).toBe(true);
    }
    expect(new Set(p.live.slice(0, p.n)).size).toBe(3);
  });
  test('clear empties everything and slots are reusable', () => {
    const p = createPool(4, make, 'skip');
    for (let i = 0; i < 4; i++) p.acquire();
    p.clear();
    expect(p.n).toBe(0);
    for (let i = 0; i < 4; i++) expect(p.acquire()).not.toBeNull();
    expect(p.stats.peak).toBe(4);
  });
});
