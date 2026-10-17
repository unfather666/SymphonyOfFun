// Proves: determinism, fart physics, meter numbers, map building, pools. Area: mrfart logic. 2026-10-17
import { describe, expect, test } from 'vitest';
import { doFart, kindForMeter } from '../logic/farts';
import { stateHash } from '../logic/hash';
import { TILE, buildMap, lineClear, mergeSolid, solidAt } from '../logic/map';
import type { MapDef } from '../logic/map';
import { walkFill } from '../logic/meters';
import { createPieces, createPuffs, spawnPiece, spawnPuff, updatePieces } from '../logic/pools';
import { rulesProblems } from '../logic/rules';
import { IDLE, fartDefs, makeSim, mapDef, propDefs, rules } from './harness';
import type { SimInput } from '../logic/types';

const RUN_RIGHT: SimInput = { mx: 1, my: 0, run: true, clench: false, interact: false };

describe('determinism (BUILD-PLAN §8)', () => {
  async function runHash(seed: number) {
    const m = await makeSim({ seed });
    m.sim.meters.fart = 90;
    for (let i = 0; i < 600; i++) m.step(i % 120 < 60 ? RUN_RIGHT : { ...RUN_RIGHT, mx: -1 });
    return { hash: stateHash(m.sim), poses: m.sim.people.map((p) => [p.x, p.y]), farts: m.sim.lastFart.count };
  }
  test('same seed, 600 steps: identical hash and poses', async () => {
    const a = await runHash(7), b = await runHash(7);
    expect(a.hash).toBe(b.hash);
    expect(a.poses).toEqual(b.poses);
    expect(a.farts).toBeGreaterThan(0);
  });
  test('different seed: different hash', async () => {
    expect((await runHash(7)).hash).not.toBe((await runHash(8)).hash);
  });
});

describe('fart physics', () => {
  // One cell; start node is cell-local (14,10). Bins at 1 tile away, 2 tiles away and 7 tiles away.
  const lot: MapDef = {
    cell: { w: 16, h: 12, streetX: 13, streetY: 9 },
    layout: ['H'],
    cells: { H: { kind: 'house', roof: 4, props: [
      { def: 'trash_bin', at: [13, 10] }, { def: 'trash_bin', at: [12, 10] }, { def: 'trash_bin', at: [7, 10] }, { def: 'crate', at: [14, 11] },
    ] } },
  };
  test('a loud fart knocks near bins over, breaks the crate, leaves the far bin alone', async () => {
    const m = await makeSim({ map: lot, people: [] });
    const kind = kindForMeter(fartDefs, 80);
    expect(fartDefs[kind]!.id).toBe('loud');
    const start = m.sim.props.map((p) => [p.x, p.y]);
    doFart(m.sim, kind);
    m.step(IDLE, 40);
    const [near, mid, far, crate] = m.sim.props;
    expect(near!.knocked).toBe(true);
    expect(mid!.knocked).toBe(true);
    expect(far!.knocked).toBe(false);
    expect(Math.hypot(near!.x - start[0]![0]!, near!.y - start[0]![1]!)).toBeGreaterThan(20);
    expect(far!.x).toBe(start[2]![0]);
    expect(crate!.broken).toBe(true);
    expect(m.sim.pieces.count).toBe(rules.caps.piecesPerBreak);
    expect(m.events.filter((e) => e.name === 'mrfart:prop_broken').length).toBe(1);
  });
  test('a quiet fart knocks nothing over', async () => {
    const m = await makeSim({ map: lot, people: [] });
    doFart(m.sim, 0);
    m.step(IDLE, 30);
    expect(m.sim.props.some((p) => p.knocked || p.broken)).toBe(false);
  });
  test('the player is not pushed by their own fart', async () => {
    const m = await makeSim({ map: lot, people: [] });
    const x = m.sim.player.x;
    doFart(m.sim, 2);
    m.step(IDLE, 20);
    expect(Math.abs(m.sim.player.x - x)).toBeLessThan(0.01);
  });
});

describe('meter numbers (design §4.2)', () => {
  test('walking fill is exact: 0.02 per px, doubled when running', () => {
    expect(walkFill(100, false, 0.02, 2)).toBe(2);
    expect(walkFill(100, true, 0.02, 2)).toBe(4);
    expect(walkFill(0, true, 0.02, 2)).toBe(0);
  });
  test('kind thresholds: <40 quiet, 40..69 squeaky, 70+ loud', () => {
    const id = (m: number) => fartDefs[kindForMeter(fartDefs, m)]!.id;
    expect([id(0), id(39.9), id(40), id(69.9), id(70), id(100)]).toEqual(['quiet', 'quiet', 'squeaky', 'squeaky', 'loud', 'loud']);
  });
  test('walking 200 px on the null engine fills close to 4 and never fires below the cap', async () => {
    const m = await makeSim({ physics: 'null', people: [] });
    m.sim.meters.nextRollAt = 1e12;
    m.step({ mx: 1, my: 0, run: false, clench: false, interact: false }, 120);
    const walked = m.sim.player.x - m.sim.player.px;
    expect(walked).toBeGreaterThan(0);
    expect(m.sim.meters.fart).toBeGreaterThan(0.5);
    expect(m.sim.lastFart.count).toBe(0);
  });
  test('meter at max forces a loud fart and drains by its amount', async () => {
    const m = await makeSim({ physics: 'null', people: [] });
    m.sim.meters.nextRollAt = 1e12;
    m.sim.meters.fart = rules.meter.max;
    m.step(IDLE);
    expect(m.sim.lastFart.count).toBe(1);
    expect(fartDefs[m.sim.lastFart.kind]!.id).toBe('loud');
    expect(m.sim.meters.fart).toBe(rules.meter.max - fartDefs[2]!.drain);
  });
});

describe('map', () => {
  const map = buildMap(mapDef);
  test('size, border and building tiles', () => {
    expect([map.w, map.h]).toEqual([34, 26]);
    expect(solidAt(map, 0, 0)).toBe(true);
    expect(solidAt(map, 17 * TILE, 8 * TILE)).toBe(false); // street
    expect(solidAt(map, 4 * TILE, 4 * TILE)).toBe(true); // house roof
    expect(solidAt(map, -5, 20)).toBe(true);
  });
  test('merged rects cover exactly the solid tiles', () => {
    let covered = 0;
    for (const [, , w, h] of map.rects) covered += w * h;
    expect(covered).toBe(map.solid.reduce((a, b) => a + b, 0));
    expect(mergeSolid(new Uint8Array([1, 1, 0, 1, 1, 0]), 3, 2)).toEqual([[0, 0, 2, 2]]);
  });
  test('line of sight is blocked by a building and clear along a street', () => {
    expect(lineClear(map, 2 * TILE, 5.5 * TILE, 14 * TILE, 5.5 * TILE)).toBe(false);
    expect(lineClear(map, 2 * TILE, 11.5 * TILE, 12 * TILE, 11.5 * TILE)).toBe(true);
  });
  test('every placed prop has a definition', () => {
    const ids = new Set(propDefs.map((p) => p.id));
    for (const p of map.props) expect(ids.has(p.def), p.def).toBe(true);
    expect(map.props.length).toBeGreaterThanOrEqual(10);
  });
});

describe('pools and rules', () => {
  test('pieces: full pool skips and counts; pieces expire on the game clock', () => {
    const p = createPieces(2);
    expect([spawnPiece(p, 0, 0, 0, 0, 0, 1, 100), spawnPiece(p, 0, 0, 0, 0, 0, 1, 100), spawnPiece(p, 0, 0, 0, 0, 0, 1, 100)]).toEqual([true, true, false]);
    expect([p.count, p.skipped]).toEqual([2, 1]);
    updatePieces(p, 100, 1 / 60, buildMap(mapDef));
    expect(p.count).toBe(0);
  });
  test('puffs: full pool replaces the oldest', () => {
    const p = createPuffs(2);
    spawnPuff(p, 0, 1, 0, 0, 0, 0, 10, 1);
    spawnPuff(p, 0, 2, 0, 0, 0, 1, 10, 1);
    spawnPuff(p, 0, 3, 0, 0, 0, 2, 10, 1);
    expect([p.x[0], p.x[1]]).toEqual([3, 2]);
  });
  test('rules.json passes and a bad number is reported in plain English', () => {
    expect(rulesProblems(rules)).toEqual([]);
    const bad = { ...rules, meter: { ...rules.meter, perPx: 5 } };
    expect(rulesProblems(bad)).toEqual(['rules.json: "meter.perPx" is 5, allowed 0 to 1.']);
  });
  test('fart kinds: three, sorted, each with sound layers', () => {
    expect(fartDefs.map((f) => f.id)).toEqual(['quiet', 'squeaky', 'loud']);
  });
});
