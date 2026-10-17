// Proves saved progress round-trips through the core save store, loads the frozen v1 fixture, repairs damaged data, and unlocks level N+1 only on a finish (racer M4, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { isUnlocked, LEVEL_COUNT, newProgress, record, sanitize, type Progress } from '../logic/progress';
import { progressSection } from '../save';
import fixture from './fixtures/save_v1.json';

const roundTrip = (p: Progress): Progress => {
  const sec = progressSection(p);
  const raw = JSON.stringify(sec.serialize());
  const back = newProgress();
  progressSection(back).deserialize(JSON.parse(raw) as Progress);
  return back;
};

describe('progress', () => {
  test('a new game has level 1 open and nothing recorded', () => {
    const p = newProgress();
    expect(p.unlocked).toBe(1);
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    expect(p.bestScore).toEqual(new Array(LEVEL_COUNT).fill(0));
  });
  test('finishing level N opens N+1, up to the last level; dying only records the score', () => {
    const p = newProgress();
    expect(record(p, 1, false, 900, 120000)).toBe(true);
    expect(p).toMatchObject({ unlocked: 1, bestScore: [900, 0, 0, 0, 0, 0, 0, 0, 0, 0], bestTime: new Array(LEVEL_COUNT).fill(0) });
    expect(record(p, 1, true, 4000, 300500)).toBe(true);
    expect(p.unlocked).toBe(2);
    expect(p.bestTime[0]).toBe(300500);
    expect(record(p, 1, true, 3000, 301000)).toBe(false);
    expect(record(p, 1, true, 3000, 299000)).toBe(true);
    expect(p.bestScore[0]).toBe(4000);
    expect(p.bestTime[0]).toBe(299000);
    expect(record(p, 10, true, 10, 1)).toBe(true);
    expect(p.unlocked).toBe(2);
    p.unlocked = 9;
    record(p, 9, true, 10, 1);
    record(p, 10, true, 10, 1);
    expect(p.unlocked).toBe(10);
    expect(record(p, 11, true, 1e9, 1)).toBe(false);
  });
  test('serialises and loads back to the same values', () => {
    const p = newProgress();
    record(p, 1, true, 5210, 301200);
    record(p, 2, false, 777, 0);
    expect(progressSection(p).version).toBe(1);
    expect(roundTrip(p)).toEqual(p);
  });
  test('the frozen v1 save still loads to the same values', () => {
    const p = sanitize(fixture);
    expect(p.unlocked).toBe(4);
    expect(p.bestScore.slice(0, 4)).toEqual([5210, 4800, 3333, 0]);
    expect(p.bestTime.slice(0, 3)).toEqual([301200, 300800, 0]);
    expect(sanitize(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  test('loading an older or damaged section repairs it instead of failing', () => {
    expect(sanitize(null)).toEqual(newProgress());
    expect(sanitize('x')).toEqual(newProgress());
    const p = sanitize({ unlocked: 99, bestScore: [5, -3, 'a', null, 1e12], bestTime: 'no' });
    expect(p.unlocked).toBe(LEVEL_COUNT);
    expect(p.bestScore.slice(0, 5)).toEqual([5, 0, 0, 0, 99999999]);
    expect(p.bestTime).toEqual(new Array(LEVEL_COUNT).fill(0));
    expect(sanitize({ unlocked: 0 }).unlocked).toBe(1);
    expect(sanitize({ bestScore: [1, 2] }).bestScore).toHaveLength(LEVEL_COUNT);
  });
  test('migrating an older section repairs it', () => {
    const migrated = progressSection(newProgress()).migrate!({ unlocked: 3, bestScore: [10, 20] }, 0);
    expect(migrated.unlocked).toBe(3);
    expect(migrated.bestScore.slice(0, 3)).toEqual([10, 20, 0]);
    expect(migrated.bestTime).toHaveLength(LEVEL_COUNT);
  });
});
