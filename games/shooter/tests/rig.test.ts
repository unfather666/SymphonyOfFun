// Proves resolveRig on 13 fixed combos with exact numbers (computed by an independent Python implementation), placement rules, unlocks and save sanitising. Area: logic/rig, unlocks, saveData. 2026-10-17
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ITEM_SCHEMA } from '../content/schemas';
import { HIT_NAMES, KILL_NAMES } from '../logic/effects';
import { PRESETS, SLOTS, activeItems, newProgress, placeItem, resolveRig, giveItem } from '../logic/rig';
import { sanitizeProgress } from '../logic/saveData';
import { DEFAULT_SHOT } from '../logic/shots';
import { dropPool, levelPlayable, levelPoints, setUnlocked, slotsFor } from '../logic/unlocks';
import { ITEMS, RULES, itemsById, pick, readJson } from './helpers';
import { problemsOf } from './schemaCheck';
import type { Unlocks } from '../logic/unlocks';

const fixtures = JSON.parse(readFileSync(join(__dirname, 'rig-fixtures.json'), 'utf8')) as Array<{
  items: string[];
  expect: { shots: Array<Record<string, unknown>>; onHit: string[]; onKill: string[] };
}>;
const fallback = DEFAULT_SHOT(RULES).shots[0]!;
const unlocks = readJson('unlocks.json') as Unlocks;

describe('items', () => {
  test('60 items in 20 sets of 3, every def passes its schema', () => {
    expect(ITEMS.length).toBe(60);
    const bySet = new Map<number, number>();
    for (const it of ITEMS) {
      expect(problemsOf(it as never, ITEM_SCHEMA), it.id).toEqual([]);
      bySet.set(it.set, (bySet.get(it.set) ?? 0) + 1);
    }
    expect([...bySet.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const n of bySet.values()) expect(n).toBe(3);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(60);
  });
  test('every set has a core or is a pure add-on set the design allows; core items carry the full shot', () => {
    for (const it of ITEMS.filter((i) => i.kind === 'core'))
      for (const k of ['projectile', 'damage', 'rateMs', 'speed', 'count', 'spread', 'lifeMs', 'size'] as const) expect(it[k], `${it.id}.${k}`).toBeDefined();
    expect(ITEMS.filter((i) => i.kind === 'core').length).toBeGreaterThanOrEqual(20);
  });
  test('aux items name a known effect; every item has a display name', () => {
    const strings = readJson('strings.json') as Record<string, string>;
    for (const it of ITEMS) {
      if (it.onHit) expect(HIT_NAMES).toContain(it.onHit);
      if (it.onKill) expect(KILL_NAMES).toContain(it.onKill);
      expect(strings[`item_${it.id}`], it.id).toBeTruthy();
    }
    for (let s = 1; s <= 20; s++) expect(strings[`set_${s}`]).toBeTruthy();
  });
});

describe('resolveRig fixtures', () => {
  fixtures.forEach((f, i) =>
    test(`combo ${i + 1}: [${f.items.join(', ')}]`, () => {
      const r = resolveRig(pick(f.items), fallback);
      expect(r.shots).toEqual(f.expect.shots);
      expect(HIT_NAMES.filter((_, b) => r.onHit & (1 << b)).sort()).toEqual(f.expect.onHit);
      expect(KILL_NAMES.filter((_, b) => r.onKill & (1 << b)).sort()).toEqual(f.expect.onKill);
    }),
  );
  test('two cores alternate: two shots in slot order', () => {
    const r = resolveRig(pick(['rivet_bolt', 'flak_shell']), fallback);
    expect(r.shots.map((s) => s.projectile)).toEqual(['bolt', 'shell']);
  });
  test('the set-type stats take the last item (element)', () => {
    expect(resolveRig(pick(['flame_beam', 'cryo_coolant', 'hymn_psi']), fallback).shots[0]!.element).toBe('psi');
    expect(resolveRig(pick(['flame_beam', 'hymn_psi', 'cryo_coolant']), fallback).shots[0]!.element).toBe('ice');
  });
  test('stats are clamped: count 12, rate floor 40', () => {
    const many = pick(['hymn_wave', ...Array<string>(8).fill('hymn_choir')]);
    expect(resolveRig(many, fallback).shots[0]!.count).toBe(12);
    const fast = pick(['rivet_bolt', 'rivet_magazine', 'rivet_magazine', 'rivet_magazine', 'rivet_magazine', 'rivet_magazine']);
    expect(resolveRig(fast, fallback).shots[0]!.rateMs).toBe(40);
  });
});

describe('slots and presets', () => {
  const owned = ['rivet_bolt', 'rivet_magazine', 'flak_shell'];
  const make = () => {
    const p = newProgress(['rivet_bolt']);
    owned.forEach((id) => giveItem(p, id));
    return p;
  };
  test('a new progress has the start item in slot 1 of preset 1 and PRESETS x SLOTS boxes', () => {
    const p = newProgress(['rivet_bolt']);
    expect(p.presets.length).toBe(PRESETS);
    expect(p.presets.every((l) => l.length === SLOTS)).toBe(true);
    expect(p.presets[0]![0]).toBe('rivet_bolt');
  });
  test('placeItem refuses locked slots, unowned items and duplicates', () => {
    const p = make();
    expect(placeItem(p, 1, 0, 1, 'rivet_magazine')).toBe('slot_locked');
    expect(placeItem(p, 2, 0, 1, 'harpoon_head')).toBe('not_owned');
    expect(placeItem(p, 2, 0, 1, 'rivet_bolt')).toBe('in_use');
    expect(placeItem(p, 2, 0, 1, 'rivet_magazine')).toBeNull();
    expect(p.presets[0]![1]).toBe('rivet_magazine');
    expect(placeItem(p, 2, 0, 1, null)).toBeNull();
    expect(p.presets[0]![1]).toBeNull();
  });
  test('activeItems only counts unlocked slots', () => {
    const p = make();
    placeItem(p, 3, 0, 1, 'rivet_magazine');
    placeItem(p, 3, 0, 2, 'flak_shell');
    expect(activeItems(p, 1, itemsById).map((i) => i.id)).toEqual(['rivet_bolt']);
    expect(activeItems(p, 3, itemsById).map((i) => i.id)).toEqual(['rivet_bolt', 'rivet_magazine', 'flak_shell']);
  });
});

describe('unlocks', () => {
  test('level gate is (n-1)^2 x 120: level 1 free, 2 at 120, 100 at 1,176,120', () => {
    expect(levelPoints(1, 120)).toBe(0);
    expect(levelPoints(2, 120)).toBe(120);
    expect(levelPoints(10, 120)).toBe(9720);
    expect(levelPoints(100, 120)).toBe(1176120);
    expect(levelPlayable(2, 119, 120)).toBe(false);
    expect(levelPlayable(2, 120, 120)).toBe(true);
    expect(levelPlayable(101, 1e9, 120)).toBe(false);
  });
  test('slots: 1 at start, +1 at levels 10 20 30 40 50', () => {
    expect([0, 9, 10, 19, 20, 49, 50, 100].map((l) => slotsFor(l, unlocks))).toEqual([1, 1, 2, 2, 3, 5, 6, 6]);
  });
  test('sets 1-15 by points, 16-20 by levels cleared', () => {
    expect(setUnlocked(6, 0, 0, unlocks)).toBe(true);
    expect(setUnlocked(1, 399, 0, unlocks)).toBe(false);
    expect(setUnlocked(1, 400, 0, unlocks)).toBe(true);
    expect(setUnlocked(16, 1e9, 59, unlocks)).toBe(false);
    expect(setUnlocked(16, 0, 60, unlocks)).toBe(true);
    expect(setUnlocked(20, 0, 100, unlocks)).toBe(true);
  });
  test('drop pool skips owned items and locked sets', () => {
    const pool = dropPool(ITEMS, ['rivet_bolt'], 0, 0, unlocks).map((i) => ITEMS[i]!.id);
    expect(pool).toEqual(['rivet_magazine', 'rivet_hardened']);
  });
});

describe('save data', () => {
  const known = new Set(ITEMS.map((i) => i.id));
  test('round trip keeps everything', () => {
    const p = newProgress(['rivet_bolt']);
    giveItem(p, 'flak_shell');
    placeItem(p, 2, 1, 1, 'flak_shell');
    p.active = 1;
    p.totalPoints = 777;
    const back = sanitizeProgress(JSON.parse(JSON.stringify(p)), known, ['rivet_bolt']);
    expect(back).toEqual(p);
  });
  test('garbage, unknown items and duplicates are cleaned, never thrown', () => {
    expect(sanitizeProgress(null, known, ['rivet_bolt'])).toEqual(newProgress(['rivet_bolt']));
    const dirty = { ownedItems: ['flak_shell', 'nope', 7], presets: [['flak_shell', 'flak_shell', 'nope']], active: 9, totalPoints: -5 };
    const c = sanitizeProgress(dirty, known, ['rivet_bolt']);
    expect(c.ownedItems.sort()).toEqual(['flak_shell', 'rivet_bolt']);
    expect(c.presets[0]!.slice(0, 3)).toEqual(['flak_shell', null, null]);
    expect(c.active).toBe(0);
    expect(c.totalPoints).toBe(0);
  });
});
