import { describe, expect, test } from 'vitest';
import { createRandom, createStream, hashString } from '../../src/core/random/mulberry32';

describe('seeded random (rule 2)', () => {
  test('mulberry32 reference values for seed 1', () => {
    const s = createStream('t', 1);
    expect(s.float()).toBe(0.6270739405881613);
    expect(s.float()).toBe(0.002735721180215478);
    expect(s.int(1, 6)).toBe(4);
    expect(s.getState()).toBe(1199730144);
  });
  test('FNV-1a hash', () => {
    expect(hashString('')).toBe(2166136261);
    expect(hashString('shooter')).toBe(3733667271);
  });
  test('same run seed and name → same sequence; different names differ', () => {
    const a = createRandom(42).stream('enemies');
    const b = createRandom(42).stream('enemies');
    const c = createRandom(42).stream('loot');
    const seqA = [a.float(), a.float(), a.float()];
    expect([b.float(), b.float(), b.float()]).toEqual(seqA);
    expect(c.float()).not.toBe(seqA[0]);
  });
  test('stream(name) returns the same stream; a seed restarts it', () => {
    const r = createRandom(7);
    const s = r.stream('x');
    expect(r.stream('x')).toBe(s);
    const first = r.stream('x', 99).float();
    expect(r.stream('x', 99).float()).toBe(first);
  });
  test('state save and restore replays', () => {
    const s = createStream('t', 5);
    const st = s.getState();
    const v = [s.float(), s.float()];
    s.setState(st);
    expect([s.float(), s.float()]).toEqual(v);
  });
  test('int stays in range, pick refuses empty', () => {
    const s = createStream('t', 3);
    for (let i = 0; i < 1000; i++) {
      const v = s.int(-2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
    expect(() => s.pick([])).toThrow(/empty/);
  });
});
