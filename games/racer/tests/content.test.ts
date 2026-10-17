// Proves every content file validates against its schema, references resolve, and counts match the design (racer, 2026-10-17).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { kindSchema, levelSchema, propSchema, rulesSchema, themeSchema, vehicleSchema } from '../schemas';
import { car, kinds, levels, props, rules, themes, validate } from './helpers';

const strings = JSON.parse(readFileSync(join(__dirname, '../content/strings.json'), 'utf8')) as Record<string, string>;

describe('content', () => {
  test('rules, segments, themes, levels, props, car pass their schemas', () => {
    expect(validate([{ id: 'rules', ...rules }], rulesSchema)).toEqual([]);
    expect(validate(kinds as never, kindSchema)).toEqual([]);
    expect(validate(themes as never, themeSchema)).toEqual([]);
    expect(validate(levels as never, levelSchema)).toEqual([]);
    expect(validate(props as never, propSchema)).toEqual([]);
    expect(validate([car] as never, vehicleSchema)).toEqual([]);
  });
  test('counts match the design', () => {
    expect(levels.length).toBe(10);
    expect(themes.length).toBe(10);
    expect(kinds.length).toBe(11);
    expect(car.states.length).toBe(3);
  });
  test('levels are 1..10 in order with rising bpm and speed', () => {
    expect(levels.map((l) => l.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!.bpm).toBeGreaterThan(levels[i - 1]!.bpm);
      expect(levels[i]!.maxSpeed).toBeGreaterThan(levels[i - 1]!.maxSpeed);
    }
  });
  test('references resolve: level themes, theme props, kind weights', () => {
    const themeIds = new Set(themes.map((t) => t.id));
    const propIds = new Set(props.map((p) => p.id));
    const kindIds = new Set(kinds.map((k) => k.id));
    for (const l of levels) expect(themeIds.has(l.theme), `${l.id} theme ${l.theme}`).toBe(true);
    for (const t of themes) {
      expect(t.palette.length, `${t.id} palette`).toBe(16);
      for (const c of t.palette) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      for (const p of t.props) expect(propIds.has(p), `${t.id} prop ${p}`).toBe(true);
      for (const k of Object.keys(t.kindWeights)) expect(kindIds.has(k), `${t.id} weight ${k}`).toBe(true);
    }
    expect(kinds.some((k) => k.id === 'straight')).toBe(true);
    expect(kinds.some((k) => k.id === 'gap')).toBe(true);
  });
  test('part tables are [x,y,z,w,h,d,palette] with a real palette slot', () => {
    const tables = [...props.map((p) => p.parts), ...car.states];
    for (const t of tables) for (const p of t) {
      expect(p.length).toBe(7);
      expect(Number.isInteger(p[6]) && p[6]! >= 0 && p[6]! <= 15).toBe(true);
      for (const v of p.slice(3, 6)) expect(v).toBeGreaterThan(0);
    }
  });
  test('every string key used in source exists in strings.json', () => {
    const src = ['index.ts', 'render/hud.ts'].map((f) => readFileSync(join(__dirname, '..', f), 'utf8')).join('\n');
    const used = [...src.matchAll(/(?:strings|str)\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(3);
    for (const k of used) expect(strings[k], k).toBeTypeOf('string');
    for (const t of themes) expect(strings[`theme_${t.id}`], t.id).toBeTypeOf('string');
  });
});
