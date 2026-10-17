// Proves every content def passes its schema and every reference resolves. Area: content. 2026-10-17
import { describe, expect, test } from 'vitest';
import { STATE_KINDS, compileBrains } from '../logic/brains';
import { parseRoom, type RoomDef } from '../logic/room';
import { BRAIN_SCHEMA, ENEMY_SCHEMA, ROOM_SCHEMA, SFX_SCHEMA, SPRITE_SCHEMA } from '../content/schemas';
import type { BrainDef } from '../logic/types';
import { BRAIN_DEFS, ENEMIES, readDefs, readJson } from './helpers';
import { problemsOf } from './schemaCheck';

const sprites = readDefs('sprites');

describe('content', () => {
  test('every enemy def passes its schema and ids are unique', () => {
    for (const d of ENEMIES) expect(problemsOf(d as never, ENEMY_SCHEMA), d.id).toEqual([]);
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(ENEMIES.length);
  });
  test('brains compile with no errors and use only built-in state kinds', () => {
    for (const d of BRAIN_DEFS) expect(problemsOf(d as never, BRAIN_SCHEMA), d.id).toEqual([]);
    const r = compileBrains(BRAIN_DEFS);
    expect(r.errors).toEqual([]);
    expect(STATE_KINDS.length).toBe(13);
  });
  test('a broken brain is dropped with a plain message', () => {
    const bad: BrainDef = { id: 'bad', tags: [], start: 'x', states: { a: { kind: 'dance', ms: 5, next: 'zzz' } } };
    const r = compileBrains([bad]);
    expect(r.brains.size).toBe(0);
    expect(r.errors).toEqual(['brain "bad" dropped: start state "x" does not exist; state "a" has unknown kind "dance"; state "a" goes to missing state "zzz".']);
  });
  test('every enemy points at a real brain, sprite and (if any) split child', () => {
    const brains = new Set(BRAIN_DEFS.map((b) => b.id));
    const sprs = new Set(sprites.map((s) => s.id));
    const ids = new Set(ENEMIES.map((e) => e.id));
    for (const e of ENEMIES) {
      expect(brains.has(e.brain), `${e.id} brain`).toBe(true);
      expect(sprs.has(e.sprite), `${e.id} sprite`).toBe(true);
      if (e.splitInto) expect(ids.has(e.splitInto), `${e.id} splitInto`).toBe(true);
    }
  });
  test('sprites pass their schema and every frame has the declared size', () => {
    for (const s of sprites) {
      expect(problemsOf(s, SPRITE_SCHEMA), String(s.id)).toEqual([]);
      for (const f of s.frames as string[][]) {
        expect(f.length).toBe(s.h);
        for (const row of f) expect(row.length).toBe(s.w);
      }
    }
  });
  test('rooms parse and spawn only known enemies', () => {
    const ids = new Set(ENEMIES.map((e) => e.id));
    for (const r of readDefs('rooms')) {
      expect(problemsOf(r, ROOM_SCHEMA), String(r.id)).toEqual([]);
      const { plan, errors } = parseRoom(r as unknown as RoomDef);
      expect(errors).toEqual([]);
      for (const wave of plan!.rooms[0]!.waves) for (const s of wave) expect(ids.has(s.def), s.def).toBe(true);
    }
  });
  test('sfx recipes pass their schema; the design asks for 12', () => {
    const sfx = readJson('sfx.json') as Array<Record<string, unknown>>;
    for (const s of sfx) expect(problemsOf(s, SFX_SCHEMA), String(s.id)).toEqual([]);
    expect(sfx.length).toBe(12);
  });
  test('every string key used by the code exists', () => {
    const strings = readJson('strings.json') as Record<string, string>;
    for (const k of ['title', 'hud_hp', 'hud_score', 'hud_flares', 'dead_title', 'dead_hint', 'clear_title', 'clear_score', 'clear_hint', 'content_problem']) expect(typeof strings[k], k).toBe('string');
  });
});
