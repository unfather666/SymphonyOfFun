import { describe, expect, test } from 'vitest';
import type { Schema } from '../../src/core/api';
import { loadRegistry } from '../../src/core/content/loader';
import { createStrings } from '../../src/core/content/strings';

const schema: Schema = { hp: { type: 'number', min: 1, max: 100, int: true }, kind: { type: 'string', oneOf: ['a', 'b'], optional: true } };

describe('content loader (rule 5)', () => {
  test('loads valid defs, by id and by tag', () => {
    const r = loadRegistry('enemy', { 'x.json': [{ id: 'imp', hp: 5, tags: ['small'] }, { id: 'ogre', hp: 50 }] }, schema);
    expect(r.errors).toEqual([]);
    expect(r.get('imp').hp).toBe(5);
    expect(r.byTag('small').map((d) => d.id)).toEqual(['imp']);
    expect(r.all().length).toBe(2);
  });
  test('accepts import.meta.glob eager shape', () => {
    const r = loadRegistry('enemy', { 'x.json': { default: { id: 'imp', hp: 5 } } }, schema);
    expect(r.byId('imp')?.hp).toBe(5);
  });
  test('defs are read-only after load', () => {
    const r = loadRegistry('enemy', { 'x.json': { id: 'imp', hp: 5, tags: ['t'] } }, schema);
    expect(Object.isFrozen(r.get('imp'))).toBe(true);
    expect(Object.isFrozen(r.get('imp').tags)).toBe(true);
  });
  test('broken defs are dropped with plain messages, the rest load', () => {
    const r = loadRegistry(
      'enemy',
      {
        'a.json': [
          { id: 'Bad-Id', hp: 5 },
          { id: 'big', hp: 500 },
          { id: 'odd', hp: 5, colour: 'red' },
          { id: 'kindless', hp: 5, kind: 'c' },
          { id: 'noh' },
          { id: 'ok', hp: 5 },
        ],
        'b.json': { id: 'ok', hp: 6 },
      },
      schema,
    );
    expect(r.all().map((d) => d.id)).toEqual(['ok']);
    expect(r.get('ok').hp).toBe(5);
    expect(r.errors).toEqual([
      'enemy: a.json has a def with a bad id "Bad-Id" (use a-z, 0-9, _); dropped.',
      'enemy: id "ok" in b.json is already used in a.json; the second one is dropped.',
      'enemy: "big" "hp" is 500, above the maximum 100; dropped.',
      'enemy: "odd" unknown field "colour"; dropped.',
      'enemy: "kindless" "kind" is "c", expected one of a, b; dropped.',
      'enemy: "noh" missing "hp"; dropped.',
    ]);
  });
  test('extends: one parent, child overrides, tags union', () => {
    const r = loadRegistry('enemy', { 'a.json': [{ id: 'child', extends: 'base', hp: 9, tags: ['c'] }, { id: 'base', hp: 2, kind: 'a', tags: ['b'] }] }, schema);
    const c = r.get('child');
    expect(c).toMatchObject({ id: 'child', hp: 9, kind: 'a' });
    expect(c.tags).toEqual(['b', 'c']);
    expect('extends' in c).toBe(false);
  });
  test('extends cycles and missing parents are dropped', () => {
    const r = loadRegistry('enemy', { 'a.json': [{ id: 'x', extends: 'y', hp: 1 }, { id: 'y', extends: 'x', hp: 1 }, { id: 'z', extends: 'nope', hp: 1 }] }, schema);
    expect(r.all()).toEqual([]);
    expect(r.errors.length).toBe(3);
  });
  test('get on a missing id throws a plain message', () => {
    const r = loadRegistry('enemy', {}, schema);
    expect(() => r.get('ghost')).toThrow('enemy: no def with id "ghost"');
  });
});

describe('strings', () => {
  test('fills params and flags missing keys', () => {
    const warns: string[] = [];
    const s = createStrings({ hi: 'HELLO {name}, {n} LEFT' }, (k) => warns.push(k));
    expect(s('hi', { name: 'UN', n: 3 })).toBe('HELLO UN, 3 LEFT');
    expect(s('hi')).toBe('HELLO {name}, {n} LEFT');
    expect(s('nope')).toBe('[nope]');
    expect(warns).toEqual(['string:nope']);
  });
});
