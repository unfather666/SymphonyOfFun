// Proves boss phases fire at their hp thresholds and the new brain states do what they say. Area: bosses, brains. 2026-10-17
import { describe, expect, test } from 'vitest';
import { damageEnemy } from '../logic/combat';
import { generate } from '../logic/levelgen';
import { compileTiers, type TierTable } from '../logic/tiers';
import { isSolid } from '../logic/tiles';
import type { BrainDef, Enemy, World } from '../logic/types';
import { BRAIN_DEFS, ENEMIES, RULES, makeWorld, readJson, run } from './helpers';

const TIERS = compileTiers(readJson('levels.json') as TierTable[], new Set(ENEMIES.map((e) => e.id))).tiers;
const OPTS = { eliteEvery: RULES.elite_every, hpStep: RULES.level_hp_step };

const live = (w: World): Enemy[] => w.enemies.live.slice(0, w.enemies.n);
const stateIndex = (brain: string, name: string) => Object.keys(BRAIN_DEFS.find((b: BrainDef) => b.id === brain)!.states).indexOf(name);
const countOf = (w: World, id: string) => live(w).filter((e) => e.def.id === id).length;

function arena(level: number): { w: World; boss: Enemy } {
  const w = makeWorld({ plan: generate(level, TIERS, OPTS) });
  run(w, 2);
  const boss = live(w).find((e) => e.def.boss);
  if (!boss) throw new Error('no boss spawned');
  return { w, boss };
}

describe('boss phases', () => {
  test('boss and minions arrive when the player is in the arena; boss hp scales with the level', () => {
    const { w, boss } = arena(10);
    expect(boss.def.id).toBe('dagon');
    expect(boss.maxHp).toBeCloseTo(1200 * (1 + 9 * RULES.level_hp_step), 6);
    expect(countOf(w, 'deep_one')).toBe(3);
    expect(arena(100).boss.maxHp).toBeCloseTo(4500 * (1 + 99 * RULES.level_hp_step), 6);
  });
  test('phase 2 starts at 66% hp with a ring of 10 bullets, phase 3 at 33% with 3 summoned deep ones', () => {
    const { w, boss } = arena(10);
    const bullets0 = w.bullets.n;
    boss.hp = boss.maxHp * 0.67;
    run(w, 1);
    expect(boss.bossPhase).toBe(0);
    boss.hp = boss.maxHp * 0.66;
    run(w, 1);
    expect(boss.bossPhase).toBe(1);
    expect(boss.state).toBe(stateIndex('dagon', 'ring1'));
    expect(w.bullets.n - bullets0).toBe(10);
    const deep0 = countOf(w, 'deep_one');
    boss.hp = boss.maxHp * 0.33;
    run(w, 1);
    expect(boss.bossPhase).toBe(2);
    expect(boss.state).toBe(stateIndex('dagon', 'summon1'));
    expect(countOf(w, 'deep_one') - deep0).toBe(3);
    boss.hp = 1;
    run(w, 5);
    expect(boss.bossPhase).toBe(2);
  });
  test('a phase fires once even while hp stays below its threshold', () => {
    const { w, boss } = arena(10);
    boss.hp = boss.maxHp * 0.5;
    run(w, 1);
    expect(boss.bossPhase).toBe(1);
    const bullets = w.bullets.n;
    run(w, 3);
    expect(boss.bossPhase).toBe(1);
    expect(w.bullets.n).toBe(bullets);
  });
  test('teleport lands the herald on open floor away from the player and its dark state blacks the room out', () => {
    const { w, boss } = arena(40);
    expect(boss.def.id).toBe('hastur_herald');
    const x0 = boss.x;
    const y0 = boss.y;
    boss.hp = boss.maxHp * 0.6;
    run(w, 1);
    expect(boss.state).toBe(stateIndex('hastur_herald', 'blink'));
    expect(boss.x !== x0 || boss.y !== y0).toBe(true);
    expect(isSolid(w.map.data[Math.floor(boss.y / 16) * w.map.w + Math.floor(boss.x / 16)]!)).toBe(false);
    expect((boss.x - w.player.x) ** 2 + (boss.y - w.player.y) ** 2).toBeGreaterThanOrEqual(48 * 48);
    run(w, 30);
    expect(boss.state).toBe(stateIndex('hastur_herald', 'night'));
    expect(w.light.ambient).toBeGreaterThanOrEqual(RULES.ambient_blackout);
  });
  test('killing the boss drops an item, and the exit opens once the arena is empty', () => {
    const { w, boss } = arena(10);
    w.dropItems = [3];
    expect(w.exitOpen).toBe(false);
    for (const e of live(w)) damageEnemy(w, e, 1e9, 0);
    expect(w.enemies.n).toBe(0);
    expect(w.pickups.live.slice(0, w.pickups.n).some((p) => p.kind === 0 && p.arg === 3)).toBe(true);
    run(w, 3);
    expect(w.exitOpen).toBe(true);
    expect(boss.alive).toBe(false);
  });
  test('a brain phase pointing at a missing state drops the brain with a plain message', async () => {
    const { compileBrains } = await import('../logic/brains');
    const bad: BrainDef = { id: 'b', tags: [], start: 'a', states: { a: { kind: 'idle', ms: 5, next: 'a' } }, phases: [{ hp: 0.5, state: 'zz' }, { hp: 1.5, state: 'a' }] };
    const r = compileBrains([bad]);
    expect(r.brains.size).toBe(0);
    expect(r.errors).toEqual(['brain "b" dropped: phase goes to missing state "zz"; phase hp 1.5 must be between 0 and 1.']);
  });
});
