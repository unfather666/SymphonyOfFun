// Proves the level generator is stable, connected and shaped by the tier tables. Area: levels. 2026-10-17
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { LEVELS, generate, isBossLevel, planHash, tierOfLevel } from '../logic/levelgen';
import { compileTiers, type TierTable } from '../logic/tiers';
import { isSolid } from '../logic/tiles';
import type { LevelPlan } from '../logic/types';
import { ENEMIES, RULES, readJson } from './helpers';

const ids = new Set(ENEMIES.map((e) => e.id));
const compiled = compileTiers(readJson('levels.json') as TierTable[], ids);
const TIERS = compiled.tiers;
const OPTS = { eliteEvery: RULES.elite_every, hpStep: RULES.level_hp_step };
const FIXTURE = join(__dirname, 'level-hashes.json');
const plans: LevelPlan[] = [];
for (let n = 1; n <= LEVELS; n++) plans.push(generate(n, TIERS, OPTS));

/** Tiles reachable from (sx, sy) walking over non-solid tiles, 4-neighbour. */
function reach(p: LevelPlan, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(p.w * p.h);
  const q = [sy * p.w + sx];
  seen[q[0]!] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    const x = c % p.w;
    const y = (c / p.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
      const i = ny * p.w + nx;
      if (!seen[i] && !isSolid(p.tiles[i]!)) {
        seen[i] = 1;
        q.push(i);
      }
    }
  }
  return seen;
}
const tileOf = (v: number) => Math.floor(v / 16);

describe('level tables', () => {
  test('the shipped tables are all valid', () => {
    expect(compiled.errors).toEqual([]);
    expect(TIERS.length).toBe(10);
    expect(TIERS.map((t) => t.tier)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  test('ambient darkness runs from 0.55 to 0.92 and waves follow 2 + tier/2', () => {
    expect(TIERS[0]!.ambient).toBe(0.55);
    expect(TIERS[9]!.ambient).toBe(0.92);
    TIERS.forEach((t, i) => expect(t.waves).toBe(2 + Math.floor(i / 2)));
    for (let i = 1; i < 10; i++) expect(TIERS[i]!.ambient).toBeGreaterThan(TIERS[i - 1]!.ambient);
  });
  test('a bad table is dropped with a plain message and a missing tier borrows the one below', () => {
    const raw = readJson('levels.json') as TierTable[];
    const broken = raw.map((t) => (t.tier === 3 ? { ...t, enemies: [{ def: 'nope', weight: 1 }] } : t));
    const r = compileTiers(broken, ids);
    expect(r.errors).toEqual(['level table "tier3" dropped: unknown enemy "nope".', 'level table for tier 3 is missing; using tier 2.']);
    expect(r.tiers.length).toBe(10);
    expect(r.tiers[3]!.tier).toBe(2);
    expect(compileTiers([], ids).tiers).toEqual([]);
  });
});

describe('generate', () => {
  test('hashes for levels 1..100 match the fixture', () => {
    const got: Record<string, number> = {};
    plans.forEach((p, i) => (got[String(i + 1)] = planHash(p)));
    if (process.env.WRITE_FIXTURE) writeFileSync(FIXTURE, JSON.stringify(got, null, 1) + '\n');
    expect(got).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });
  test('same level twice gives the same plan, and all 100 differ', () => {
    for (const n of [1, 17, 50, 99, 100]) expect(planHash(generate(n, TIERS, OPTS))).toBe(planHash(plans[n - 1]!));
    expect(new Set(plans.map(planHash)).size).toBe(100);
  });
  test('rooms: 4 to 8 of 12..20 tiles, start room has no waves, other rooms have the tier wave count', () => {
    for (let n = 1; n <= LEVELS; n++) {
      if (isBossLevel(n)) continue;
      const p = plans[n - 1]!;
      const t = TIERS[tierOfLevel(n)]!;
      expect(p.rooms.length, `level ${n}`).toBeGreaterThanOrEqual(4);
      expect(p.rooms.length).toBeLessThanOrEqual(8);
      p.rooms.forEach((r, i) => {
        expect(r.w).toBeGreaterThanOrEqual(12);
        expect(r.w).toBeLessThanOrEqual(20);
        expect(r.h).toBeGreaterThanOrEqual(12);
        expect(r.h).toBeLessThanOrEqual(20);
        expect(r.waves.length).toBe(i === 0 ? 0 : t.waves);
        for (const wave of r.waves) expect(wave.length).toBeGreaterThanOrEqual(t.waveSize);
      });
      expect(p.ambient).toBe(t.ambient);
      expect(p.tint).toBe(t.tint);
      expect(p.tier).toBe(tierOfLevel(n));
      expect(p.hpMul).toBeCloseTo(1 + (n - 1) * RULES.level_hp_step, 10);
    }
    expect(plans[0]!.hpMul).toBe(1);
  });
  test('every level connects start to exit and every walkable tile is one region', () => {
    for (const p of plans) {
      const seen = reach(p, tileOf(p.start.x), tileOf(p.start.y));
      expect(seen[tileOf(p.exit!.y) * p.w + tileOf(p.exit!.x)], `${p.id} exit`).toBe(1);
      let walk = 0;
      let got = 0;
      for (let i = 0; i < p.tiles.length; i++) {
        if (!isSolid(p.tiles[i]!)) walk++;
        if (seen[i]) got++;
      }
      expect(got, `${p.id} region`).toBe(walk);
    }
  });
  test('spawns are on open floor, inside their own room', () => {
    for (const p of plans)
      p.rooms.forEach((r, ri) => {
        for (const wave of r.waves)
          for (const s of wave) {
            const tx = tileOf(s.x);
            const ty = tileOf(s.y);
            expect(isSolid(p.tiles[ty * p.w + tx]!), `${p.id} room ${ri} spawn`).toBe(false);
            expect(tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h, `${p.id} room ${ri} spawn inside`).toBe(true);
          }
      });
  });
  test('the centre cross of every room is clear of pillars', () => {
    for (const p of plans) {
      for (const r of p.rooms) {
        if (isBossLevel(p.level)) continue;
        const mx = r.x + (r.w >> 1);
        const my = r.y + (r.h >> 1);
        for (let x = r.x; x < r.x + r.w; x++) expect(isSolid(p.tiles[my * p.w + x]!), `${p.id} row`).toBe(false);
        for (let y = r.y; y < r.y + r.h; y++) expect(isSolid(p.tiles[y * p.w + mx]!), `${p.id} col`).toBe(false);
      }
    }
  });
  test('one spawn in eliteEvery is an elite, counted across the level', () => {
    const p = plans[24]!;
    const all = p.rooms.flatMap((r) => r.waves.flat());
    expect(all.filter((s) => s.elite).length).toBe(Math.floor(all.length / RULES.elite_every));
  });
  test('light script is ordered, uses the tier tricks and grows with the tier', () => {
    for (const p of plans) {
      const t = TIERS[p.tier]!;
      if (isBossLevel(p.level)) continue;
      expect(p.script.length).toBe(t.scriptEntries);
      for (let i = 1; i < p.script.length; i++) expect(p.script[i]!.atWave!).toBeGreaterThanOrEqual(p.script[i - 1]!.atWave!);
      for (const e of p.script) expect(t.tricks).toContain(e.kind);
    }
    expect(plans[4]!.script.length).toBe(0);
  });
});

describe('boss arenas', () => {
  test('every tenth level is one 24x16 room with the boss first in its only wave', () => {
    for (let n = 10; n <= 100; n += 10) {
      const p = plans[n - 1]!;
      expect(p.rooms.length).toBe(1);
      expect([p.rooms[0]!.w, p.rooms[0]!.h]).toEqual([24, 16]);
      expect(p.rooms[0]!.waves.length).toBe(1);
      expect(ENEMIES.find((e) => e.id === p.rooms[0]!.waves[0]![0]!.def)!.boss, `level ${n}`).toBe(true);
    }
  });
  test('boss choice follows the tier table, level 100 is the final boss', () => {
    const boss = (n: number) => plans[n - 1]!.rooms[0]!.waves[0]![0]!.def;
    expect([10, 20, 30, 40, 60, 70, 90, 100].map(boss)).toEqual(['dagon', 'dagon', 'dagon', 'hastur_herald', 'hastur_herald', 'star_spawn', 'star_spawn', 'the_signal']);
  });
});
