// Proves: stress, clench, witnesses, intolerance, midnight settlement and people reactions give the exact numbers in the design. Area: mrfart M1. 2026-10-17
import { describe, expect, test } from 'vitest';
import { dayIndexAt, formatClock, hourAt } from '../logic/clock';
import { doFart } from '../logic/farts';
import type { MapDef } from '../logic/map';
import { clenchForce, rollChance } from '../logic/meters';
import { settledReputation } from '../logic/reputation';
import { createRng } from '../logic/rng';
import type { Rng } from '../logic/rng';
import { intolFor } from '../logic/witness';
import { PS_FLEE, PS_STARTLED, PS_WALK, STATUS_LOST, STATUS_PLAYING } from '../logic/types';
import type { PersonDef, SimInput } from '../logic/types';
import { IDLE, makeSim, rules } from './harness';

/** Open ground, two cells wide. The player starts at tile (15,11); `wall` adds a 1-tile wall at tile x=12 (rows 9..12). */
const open = (wall = false): MapDef => ({
  cell: { w: 16, h: 12, streetX: 13, streetY: 9 },
  layout: ['HH'],
  cells: { H: { kind: 'house', roof: 4, ...(wall ? { building: [11, 8, 1, 4] as [number, number, number, number], door: 0 } : {}) } },
});
const still = (id: string, tx: number, ty: number): PersonDef => ({ id, name: id, role: 'granny', speed: 20, shirt: 5, hair: 6, skin: 15, loop: [[tx, ty, 1e9]] });
const LOUD = 2;
const HOLD: SimInput = { mx: 0, my: 0, run: false, clench: true, interact: false };

describe('clock', () => {
  test('hours, day boundary and format', () => {
    expect(hourAt(0, 480000, 8)).toBe(8);
    expect(hourAt(160000, 480000, 8)).toBe(16);
    expect(dayIndexAt(319999, 480000, 8)).toBe(0);
    expect(dayIndexAt(320000, 480000, 8)).toBe(1);
    expect(formatClock(8.5)).toBe('08:30');
    expect(formatClock(23.99)).toBe('23:59');
  });
});

describe('pure numbers', () => {
  test('settlement: 70 - 47/10 = 65.3, never below 0', () => {
    expect(settledReputation(70, 47, 10)).toBeCloseTo(65.3, 9);
    expect(settledReputation(3, 500, 10)).toBe(0);
  });
  test('intolerance doubles when pushed', () => {
    expect([intolFor(6, false, 2), intolFor(6, true, 2), intolFor(1, true, 2)]).toEqual([6, 12, 2]);
  });
  test('random roll chance: meter 40, stress 50 -> 0.2 x 1.5 = 0.3', () => {
    expect(rollChance(40, 50, 200)).toBeCloseTo(0.3, 12);
    expect(rollChance(40, 0, 200)).toBeCloseTo(0.2, 12);
  });
  test('clench force: +0 at 0 ms, +15% at 1.5 s, capped at +100%', () => {
    expect([clenchForce(0, 1, 10000), clenchForce(1500, 1, 10000), clenchForce(99999, 1, 10000)]).toEqual([1, 1.15, 2]);
  });
});

describe('witnesses', () => {
  test('a loud fart seen from outside its push radius adds 6, stress 12, startles and will flee', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 22, 11)], physics: 'null' });
    doFart(m.sim, LOUD);
    const p = m.sim.people[0]!;
    expect(p.intol).toBe(6);
    expect(m.sim.meters.intolToday).toBe(6);
    expect(m.sim.meters.stress).toBe(12);
    expect(p.state).toBe(PS_STARTLED);
    expect(p.flees).toBe(true);
    expect(m.events.find((e) => e.name === 'mrfart:witnessed')!.payload).toEqual({ person: 0, kind: LOUD, intol: 6 });
  });
  test('a person pushed by the same fart gets double: 12', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 18, 11)], physics: 'null' });
    doFart(m.sim, LOUD);
    expect(m.sim.people[0]!.intol).toBe(12);
  });
  test('out of witness range sees nothing: a quiet fart at 96 px', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 21, 11)], physics: 'null' });
    doFart(m.sim, 0);
    expect(m.sim.people[0]!.intol).toBe(0);
    expect(m.sim.meters.intolToday).toBe(0);
  });
  test('a wall blocks the view', async () => {
    const m = await makeSim({ map: open(true), people: [still('w', 9, 11)], physics: 'null' });
    doFart(m.sim, LOUD);
    expect(m.sim.people[0]!.intol).toBe(0);
    const clear = await makeSim({ map: open(false), people: [still('w', 9, 11)], physics: 'null' });
    doFart(clear.sim, LOUD);
    expect(clear.sim.people[0]!.intol).toBe(6);
  });
  test('notice roll uses the kind probability: quiet 0.3, squeaky 0.7, loud 1', async () => {
    const asked: number[] = [];
    const spy: Rng = { ...createRng(1), chance: (p) => (asked.push(p), true) };
    for (const [kind, near] of [[0, 17], [1, 19], [2, 20]] as const) {
      const m = await makeSim({ map: open(), people: [still('w', near, 11)], physics: 'null', rng: { notice: spy } });
      doFart(m.sim, kind);
    }
    expect(asked).toEqual([0.3, 0.7, 1]);
  });
  test('a failed notice changes nothing', async () => {
    const never: Rng = { ...createRng(1), chance: () => false };
    const m = await makeSim({ map: open(), people: [still('w', 20, 11)], physics: 'null', rng: { notice: never } });
    doFart(m.sim, LOUD);
    expect([m.sim.people[0]!.intol, m.sim.meters.stress]).toEqual([0, 0]);
  });
});

describe('stress', () => {
  test('alone: -2 per second', async () => {
    const m = await makeSim({ map: open(), people: [], physics: 'null' });
    m.sim.meters.stress = 10;
    m.step(IDLE, 60);
    expect(m.sim.meters.stress).toBeCloseTo(8, 6);
  });
  test('watched at reputation 20: +0.5 per second and no calming', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 18, 11)], physics: 'null' });
    m.sim.meters.reputation = 20;
    m.step(IDLE, 60);
    expect(m.sim.watchers).toBe(1);
    expect(m.sim.meters.stress).toBeCloseTo(0.5, 6);
  });
  test('stress above 50 feeds the fart meter 0.5 per second', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 18, 11)], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    m.sim.meters.stress = 80;
    m.step(IDLE, 60);
    expect(m.sim.meters.fart).toBeCloseTo(0.5, 6);
  });
});

describe('clench', () => {
  test('holding delays the fart; release makes a loud one 15% bigger after 1.5 s', async () => {
    const m = await makeSim({ map: open(), people: [], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    m.sim.meters.fart = 10;
    m.step(HOLD, 90);
    expect(m.sim.lastFart.count).toBe(0);
    expect(m.sim.meters.fart).toBeCloseTo(16, 6);
    expect(m.sim.meters.stress).toBeCloseTo(9, 6);
    m.step(IDLE, 1);
    expect(m.sim.lastFart.count).toBe(1);
    expect(m.sim.lastFart.kind).toBe(LOUD);
    expect(m.sim.lastFart.force).toBeCloseTo(368, 3);
    expect(m.sim.meters.fart).toBe(0);
  });
  test('the meter does not fire at max while clenching, and caps at clenchMax', async () => {
    const m = await makeSim({ map: open(), people: [], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    m.sim.meters.fart = 99;
    m.step(HOLD, 600);
    expect(m.sim.lastFart.count).toBe(0);
    expect(m.sim.meters.fart).toBe(rules.meter.clenchMax);
  });
  test('a tap shorter than clenchMinMs does not fart', async () => {
    const m = await makeSim({ map: open(), people: [], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    m.step(HOLD, 5);
    m.step(IDLE, 1);
    expect(m.sim.lastFart.count).toBe(0);
  });
  test('holding 30 s raises the balloon event once', async () => {
    const m = await makeSim({ map: open(), people: [], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    m.step(HOLD, 1900);
    expect(m.events.filter((e) => e.name === 'mrfart:balloon').length).toBe(1);
  });
});

describe('people reactions', () => {
  test('startled for 900 ms, then flees away for 3 s, then walks again', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 22, 11)], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    doFart(m.sim, LOUD);
    const p = m.sim.people[0]!;
    m.step(IDLE, 30);
    expect(p.state).toBe(PS_STARTLED);
    m.step(IDLE, 30); // 60 steps = 1000 ms
    expect(p.state).toBe(PS_FLEE);
    const d0 = p.x - m.sim.player.x;
    m.step(IDLE, 60);
    expect(p.x - m.sim.player.x).toBeGreaterThan(d0 + 20);
    m.step(IDLE, 150);
    expect(p.state).toBe(PS_WALK);
  });
  test('at reputation below 20 people flee without a fart', async () => {
    const m = await makeSim({ map: open(), people: [still('w', 19, 11)], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    m.step(IDLE, 3);
    expect(m.sim.people[0]!.state).not.toBe(PS_FLEE);
    m.sim.meters.reputation = 19.9;
    m.step(IDLE, 3);
    expect(m.sim.people[0]!.state).toBe(PS_FLEE);
  });
});

describe('a scripted day', () => {
  test('8 loud farts in view then midnight: 70 - 48/10 = 65.2, people forget half, the next day starts clean', async () => {
    // Person at 112 px: inside loud witness range (120), outside the watch radius (110) so Mr Fart calms between farts.
    const m = await makeSim({ map: open(), people: [still('w', 22, 11)], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    const fartAt = new Set([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 20000]);
    for (let i = 1; i <= 28800; i++) {
      if (fartAt.has(i)) doFart(m.sim, LOUD);
      m.step(IDLE);
      if (i === 19199) expect(m.sim.day).toBe(0);
    }
    expect(m.events.filter((e) => e.name === 'mrfart:midnight').length).toBe(1);
    expect(m.sim.day).toBe(1);
    expect(m.sim.meters.reputation).toBeCloseTo(65.2, 9);
    expect(m.sim.meters.intolToday).toBe(6);
    expect(m.sim.people[0]!.intol).toBe(24 + 6);
    expect(m.sim.status).toBe(STATUS_PLAYING);
  });
  test('reputation reaching 0 ends the run', async () => {
    const m = await makeSim({ map: open(), people: [], physics: 'null' });
    m.sim.meters.reputation = 2;
    m.sim.meters.intolToday = 100;
    m.step(IDLE, 19200);
    expect(m.sim.meters.reputation).toBe(0);
    expect(m.sim.status).toBe(STATUS_LOST);
    expect(m.events.filter((e) => e.name === 'mrfart:game_over').length).toBe(1);
  });
});
