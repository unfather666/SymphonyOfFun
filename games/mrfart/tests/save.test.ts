// Proves: progress and options save sections round-trip, a v1 save migrates to v2, bad data is clamped not fatal. Area: mrfart M4. 2026-10-17
import { describe, expect, test } from 'vitest';
import { applyProgress, migrateProgress, PROGRESS_VERSION, sanitizeOptions, serializeProgress } from '../logic/save';
import { giveItem, itemIndex } from '../logic/items';
import v1 from './fixtures/progress_v1.json';
import { IDLE, makeSim, rules } from './harness';

describe('save sections', () => {
  test('version is 2 and a v1 fixture migrates with defaults for the new fields', () => {
    expect(PROGRESS_VERSION).toBe(2);
    expect(migrateProgress(v1, 1)).toEqual({ tasksDone: 42, reputation: 61.5, coins: 380, items: [], dayIndex: 0, intolerance: [] });
    expect(migrateProgress(null, 1).reputation).toBe(70);
  });
  test('round trip: everything that carries over comes back in a fresh sim', async () => {
    const a = await makeSim({ seed: 3 });
    a.sim.progress.tasksDone = 77;
    a.sim.progress.coins = 123;
    a.sim.meters.reputation = 55.5;
    giveItem(a.sim, itemIndex(a.sim, 'nice_shoes'));
    giveItem(a.sim, itemIndex(a.sim, 'tuba'));
    a.sim.people[4]!.intol = 9;
    a.sim.people[41]!.intol = 200;
    a.sim.day = 5;
    const data = JSON.parse(JSON.stringify(serializeProgress(a.sim)));
    const b = await makeSim({ seed: 9 });
    applyProgress(b.sim, data);
    expect(b.sim.progress).toMatchObject({ tasksDone: 77, coins: 123 });
    expect(b.sim.meters.reputation).toBe(55.5);
    expect(b.sim.inv.items.map((i) => b.sim.deps.items[i]!.id)).toEqual(['nice_shoes', 'tuba']);
    expect(b.sim.people[4]!.intol).toBe(9);
    expect(b.sim.people[41]!.intol).toBe(200);
    expect(b.sim.day).toBe(5);
    expect(b.sim.dayBase).toBe(5);
  });
  test('a loaded day carries on from the saved day: midnight settles on the next one, not at once', async () => {
    const m = await makeSim({ people: [] });
    m.sim.meters.nextRollAt = 1e12;
    applyProgress(m.sim, { dayIndex: 3, reputation: 70 });
    m.step(IDLE, 10);
    expect(m.sim.day).toBe(3);
    expect(m.events.some((e) => e.name === 'mrfart:midnight')).toBe(false);
    m.step(IDLE, Math.ceil(((24 - rules.world.startHour) / 24) * rules.world.dayMs / (1000 / 60)) + 5);
    expect(m.sim.day).toBe(4);
    expect(m.events.filter((e) => e.name === 'mrfart:midnight')).toHaveLength(1);
  });
  test('bad data is clamped or dropped and the game still starts', async () => {
    const m = await makeSim({ people: [] });
    applyProgress(m.sim, { tasksDone: -5, coins: 'lots', reputation: 999, items: ['nope', 'tuba', 'tuba', 'comfy_pants', 'comfy_pants', 'comfy_pants', 'comfy_pants', 'comfy_pants', 'comfy_pants', 'comfy_pants'], intolerance: 'x' });
    expect(m.sim.progress).toMatchObject({ tasksDone: 0, coins: 0 });
    expect(m.sim.meters.reputation).toBe(rules.reputation.max);
    expect(m.sim.inv.items).toHaveLength(rules.items.max);
    expect(m.sim.inv.items.filter((i) => m.sim.deps.items[i]!.id === 'tuba')).toHaveLength(1);
    applyProgress(m.sim, 'garbage');
    expect(m.sim.meters.reputation).toBe(rules.reputation.start);
  });
  test('options default to showing hints and ignore junk', () => {
    expect(sanitizeOptions(undefined)).toEqual({ hints: true });
    expect(sanitizeOptions({ hints: false })).toEqual({ hints: false });
    expect(sanitizeOptions({ hints: 'no' })).toEqual({ hints: true });
  });
});
