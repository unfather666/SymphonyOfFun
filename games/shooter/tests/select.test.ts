// Proves level select movement and status, and save v1 to v2 migration. Area: level select, saves. 2026-10-17
import { describe, expect, test } from 'vitest';
import { newProgress } from '../logic/rig';
import { PROGRESS_VERSION, migrateProgress, sanitizeProgress } from '../logic/saveData';
import { levelStatus, moveCursor, startCursor } from '../logic/select';
import { levelPoints } from '../logic/unlocks';
import { ITEMS, RULES } from './helpers';

const known = new Set(ITEMS.map((i) => i.id));
const M = RULES.level_points_mult;

describe('level select', () => {
  test('cursor moves by cells and stops at the edges', () => {
    expect(moveCursor(1, 1, 0)).toBe(2);
    expect(moveCursor(1, 0, 1)).toBe(11);
    expect(moveCursor(1, -1, -1)).toBe(1);
    expect(moveCursor(10, 1, 0)).toBe(10);
    expect(moveCursor(100, 1, 1)).toBe(100);
    expect(moveCursor(55, 0, -1)).toBe(45);
  });
  test('level 1 is free, level n needs (n-1)^2 x mult points, cleared levels show as cleared', () => {
    expect(M).toBe(120);
    expect(levelPoints(1, M)).toBe(0);
    expect(levelPoints(10, M)).toBe(9720);
    expect(levelStatus(1, 0, [], M)).toBe('open');
    expect(levelStatus(2, 119, [], M)).toBe('locked');
    expect(levelStatus(2, 120, [], M)).toBe('open');
    expect(levelStatus(2, 120, [2], M)).toBe('cleared');
    expect(levelStatus(100, 1e9, [], M)).toBe('open');
  });
  test('the cursor opens on the level after the highest cleared when it is playable', () => {
    expect(startCursor([], 0, M)).toBe(1);
    expect(startCursor([1], 500, M)).toBe(2);
    expect(startCursor([1, 2], 10, M)).toBe(2);
    expect(startCursor([100], 1e9, M)).toBe(100);
  });
});

describe('save v2', () => {
  test('v1 save migrates with an empty cleared list and keeps points and items', () => {
    const v1 = { ownedItems: ['rivet_bolt', 'flak_shell'], presets: [['rivet_bolt', 'flak_shell', null, null, null, null]], active: 1, totalPoints: 500 };
    expect(PROGRESS_VERSION).toBe(2);
    const m = migrateProgress(v1, 1);
    expect(m.levelsCleared).toEqual([]);
    const c = sanitizeProgress(m, known, ['rivet_bolt']);
    expect(c.totalPoints).toBe(500);
    expect(c.active).toBe(1);
    expect(c.ownedItems.sort()).toEqual(['flak_shell', 'rivet_bolt']);
    expect(c.levelsCleared).toEqual([]);
  });
  test('cleared levels round trip sorted and unique, junk is dropped', () => {
    const p = newProgress(['rivet_bolt']);
    p.levelsCleared = [3, 1, 2];
    expect(sanitizeProgress(JSON.parse(JSON.stringify(p)), known, ['rivet_bolt']).levelsCleared).toEqual([1, 2, 3]);
    const dirty = { ...p, levelsCleared: [5, 5, 0, 101, 2.5, 'x', 7] };
    expect(sanitizeProgress(dirty, known, ['rivet_bolt']).levelsCleared).toEqual([5, 7]);
  });
  test('a current-version save passes through migrate untouched', () => {
    const p = newProgress(['rivet_bolt']);
    expect(migrateProgress(p, 2)).toBe(p);
  });
});
