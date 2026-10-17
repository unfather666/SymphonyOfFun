// Proves the tutorial captions, touch tap zones and level list behave and that every string they need exists (racer M4, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { tapZone } from '../controls';
import { levelMenuItems } from '../levelmenu';
import { newProgress, record } from '../logic/progress';
import { tutorialAt } from '../logic/tutorial';
import strings from '../content/strings.json';
import { levels, rules, themes } from './helpers';

const str = (key: string, params?: Record<string, string | number>): string => {
  const raw = (strings as Record<string, string>)[key];
  if (raw === undefined) throw new Error(`missing string ${key}`);
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k]));
};

describe('tutorial', () => {
  test('a caption shows for showBeats beats from its start and then clears', () => {
    const starts = [2, 14];
    expect(tutorialAt(starts, -1, 8)).toBe(-1);
    expect(tutorialAt(starts, 1, 8)).toBe(-1);
    expect(tutorialAt(starts, 2, 8)).toBe(0);
    expect(tutorialAt(starts, 9, 8)).toBe(0);
    expect(tutorialAt(starts, 10, 8)).toBe(-1);
    expect(tutorialAt(starts, 14, 8)).toBe(1);
    expect(tutorialAt(starts, 22, 8)).toBe(-1);
    expect(tutorialAt(undefined, 5, 8)).toBe(-1);
  });
  test('captions never overlap and every caption has a plain and a touch string', () => {
    for (const l of levels) {
      const st = l.tutorial ?? [];
      st.forEach((b, i) => {
        if (i > 0) expect(b - st[i - 1]!, `L${l.no} caption ${i}`).toBeGreaterThanOrEqual(rules.tutorialShowBeats);
        expect(strings, `tut_${l.no}_${i}`).toHaveProperty(`tut_${l.no}_${i}`);
        expect(strings, `tut_${l.no}_${i}_touch`).toHaveProperty(`tut_${l.no}_${i}_touch`);
      });
    }
    expect(levels[0]!.tutorial!.length).toBe(6);
  });
});

describe('touch zones', () => {
  test('left half is the stick, A and B corner is untouched, right half splits into use and jump', () => {
    expect(tapZone(100, 100)).toBe('none');
    expect(tapZone(300, 60)).toBe('use');
    expect(tapZone(300, 120)).toBe('jump');
    expect(tapZone(358, 182)).toBe('none');
    expect(tapZone(326, 196)).toBe('none');
    expect(tapZone(372, 12)).toBe('none');
    expect(tapZone(250, 190)).toBe('jump');
  });
});

describe('level list', () => {
  test('locked levels are greyed, finished ones show the best score', () => {
    const p = newProgress();
    record(p, 1, true, 4321, 300000);
    const picked: number[] = [];
    const items = levelMenuItems(str, levels, p, (n) => picked.push(n));
    expect(items).toHaveLength(10);
    expect(items[0]!.label).toBe(' 1  DESERT   BEST 4321');
    expect(items[1]!.label).toBe(' 2  SUBURBS');
    expect(items[1]!.disabled).toBeFalsy();
    expect(items[2]!.label).toBe(' 3  LOCKED');
    expect(items[2]!.disabled).toBe(true);
    items[1]!.onPick();
    expect(picked).toEqual([2]);
  });
  test('every theme has a name string', () => {
    for (const t of themes) expect(strings, t.id).toHaveProperty(`theme_${t.id}`);
  });
});
