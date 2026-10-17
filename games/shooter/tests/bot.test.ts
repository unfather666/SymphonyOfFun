// Proves the reference bot can beat the level 10 and 20 bosses and that nothing ever ends up inside a wall. Area: balance, spawns. 2026-10-17
import { describe, expect, test } from 'vitest';
import { generate } from '../logic/levelgen';
import { resolveRig } from '../logic/rig';
import { DEFAULT_SHOT } from '../logic/shots';
import { makeCommand, stepWorld } from '../logic/sim';
import { compileTiers, type TierTable } from '../logic/tiers';
import { isSolid } from '../logic/tiles';
import { setShot } from '../logic/world';
import { botCommand, runBot } from './bot';
import { ENEMIES, ITEMS, RULES, makeWorld, readJson } from './helpers';

const TIERS = compileTiers(readJson('levels.json') as TierTable[], new Set(ENEMIES.map((e) => e.id))).tiers;
const OPTS = { eliteEvery: RULES.elite_every, hpStep: RULES.level_hp_step };
const base = DEFAULT_SHOT(RULES).shots[0]!;
const rig = (ids: string[]) => resolveRig(ids.map((id) => ITEMS.find((i) => i.id === id)!), base);

describe('reference bot', () => {
  test('beats the level 10 boss with one slot and the level 20 boss with two, three seeds each', () => {
    for (const [level, ids] of [[10, ['wide_lens']], [20, ['wide_lens', 'rivet_hardened']]] as const)
      for (const seed of [1, 2, 3]) {
        const w = makeWorld({ seed, plan: generate(level, TIERS, OPTS) });
        setShot(w, rig([...ids]));
        const r = runBot(w, 120);
        expect(r.status, `level ${level} seed ${seed}: ${JSON.stringify(r)}`).toBe('cleared');
        expect(w.exitOpen).toBe(true);
      }
  });
  test('level 1 is beatable with the starter bolt (at least two of three seeds)', () => {
    let cleared = 0;
    for (const seed of [1, 2, 3]) {
      const w = makeWorld({ seed, plan: generate(1, TIERS, OPTS) });
      if (runBot(w, 300).status === 'cleared') cleared++;
    }
    expect(cleared).toBeGreaterThanOrEqual(2);
  });
  test('no enemy centre is ever inside a wall or outside the map, on any kind of level', () => {
    for (const level of [1, 12, 40, 70, 99]) {
      const w = makeWorld({ seed: 4, plan: generate(level, TIERS, OPTS) });
      setShot(w, rig(['wide_lens', 'rivet_hardened', 'rivet_magazine']));
      const cmd = makeCommand();
      const nav = { dist: new Int16Array(w.map.w * w.map.h), queue: new Int32Array(w.map.w * w.map.h), target: -1 };
      for (let i = 0; i < 150 * 60 && w.status === 'play'; i++) {
        botCommand(w, nav, cmd, 90);
        stepWorld(w, cmd, (w.stepNo + 1) * (1000 / 60));
        for (let k = 0; k < w.enemies.n; k++) {
          const e = w.enemies.live[k]!;
          const tx = Math.floor(e.x / 16);
          const ty = Math.floor(e.y / 16);
          const inside = tx >= 0 && ty >= 0 && tx < w.map.w && ty < w.map.h && !isSolid(w.map.data[ty * w.map.w + tx]!);
          if (!inside) throw new Error(`level ${level} step ${w.stepNo}: ${e.def.id} at ${e.x.toFixed(1)},${e.y.toFixed(1)} is in a wall or off the map`);
        }
      }
    }
  });
});
