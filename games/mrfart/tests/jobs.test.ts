// Proves: job generator tiers and counts, every M2 job type completes step by step with its events, leash survives a max fart, lost subjects fail cleanly. Area: mrfart M2. 2026-10-17
import { describe, expect, test } from 'vitest';
import { doFart } from '../logic/farts';
import { countFor, generateOffer, jobText, tierFor } from '../logic/jobs';
import { SS_CARRIED, SS_DONE, SS_FOLLOW, SS_TREE } from '../logic/jobTypes';
import type { JobOffer } from '../logic/jobTypes';
import { buildMap } from '../logic/map';
import { startJob } from '../logic/pipeline';
import { createRng } from '../logic/rng';
import { PR_BOARD, PR_GRAB, PR_TALK, VERBS } from '../logic/verbs';
import strings from '../content/strings.json';
import { IDLE, PRESS, catalog, mapDef, makeSim, rules } from './harness';
import type { Made } from './harness';
import { placeZone } from '../logic/zones';

const jr = rules.jobs;
const idOf = (list: ReadonlyArray<{ id: string }>, id: string) => list.findIndex((x) => x.id === id);
const str = (key: string, params?: Record<string, string | number>) => {
  const s = (strings as Record<string, string>)[key];
  if (s === undefined) return `[${key}]`;
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
};

async function setup(type: string, subject: string, place: string, origin = 0) {
  const m = await makeSim({ people: [], physics: 'null' });
  m.sim.meters.nextRollAt = 1e12;
  const offer: JobOffer = {
    type: idOf(catalog.types, type), subject: idOf(catalog.subjects, subject), place: idOf(catalog.places, place), count: 1,
    tier: catalog.subjects[idOf(catalog.subjects, subject)]!.tier, origin,
  };
  expect(startJob(m.sim, offer)).toBe(true);
  return { m, offer };
}
const tp = (m: Made, x: number, y: number) => m.sim.deps.physics.setPosition(m.sim.player.h, x, y);
const tpSubject = (m: Made, slot: number, x: number, y: number) => m.sim.deps.physics.setPosition(m.sim.subjects[slot]!.h, x, y);
const stepDone = (m: Made) => m.events.filter((e) => e.name === 'mrfart:step_done').map((e) => [e.payload.job, e.payload.step]);
const subj = (m: Made, n = 0) => m.sim.subjects[m.sim.job!.subjects[n]!]!;

describe('tier and counts (design 4.5)', () => {
  test('tier = floor(tasksDone / 50) up to 4', () => {
    const r = createRng(1);
    expect([0, 49, 50, 99, 100, 149, 150, 199].map((n) => tierFor(n, jr, r))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  test('after 200 tasks every tier can come up, biased to the top', () => {
    const r = createRng(3);
    const hits = [0, 0, 0, 0, 0];
    for (let i = 0; i < 2000; i++) hits[tierFor(300, jr, r)]!++;
    expect(hits.every((h) => h > 0)).toBe(true);
    expect(hits[4]).toBeGreaterThan(hits[0]!);
  });
  test('count is always 1 below tier 2; from tier 2 two at 30%; tier 3 three at 15%; capped by the job type', () => {
    const asked: number[] = [];
    const yes = { ...createRng(1), chance: (p: number) => (asked.push(p), true) };
    expect([countFor(0, 3, jr, yes), countFor(1, 3, jr, yes)]).toEqual([1, 1]);
    expect(asked).toEqual([]);
    expect(countFor(2, 3, jr, yes)).toBe(2);
    expect(asked).toEqual([0.3]);
    asked.length = 0;
    expect(countFor(3, 3, jr, yes)).toBe(3);
    expect(asked).toEqual([0.3, 0.15]);
    expect(countFor(3, 1, jr, yes)).toBe(1);
  });
  test('the first 10 jobs for seed 1 are all tier 0 (the escalation must not be obvious)', () => {
    const map = buildMap(mapDef);
    const rng = createRng(1);
    for (let i = 0; i < 10; i++) {
      const o = generateOffer(catalog, map, rules, rng, 0, 100, 100)!;
      expect(o).not.toBeNull();
      expect(o.tier).toBe(0);
      expect(catalog.subjects[o.subject]!.tier).toBe(0);
      expect(o.count).toBe(1);
    }
  });
  test('the board opens with 3 offers and renews when the in-game hour changes', async () => {
    const m = await makeSim({ people: [], physics: 'null' });
    m.sim.meters.nextRollAt = 1e12;
    expect(m.sim.board.offers.length).toBe(3);
    const hour0 = m.sim.board.hour;
    const first = m.sim.board.offers.slice();
    m.step(IDLE, 1200); // 20 s = one in-game hour (480 s / 24)
    expect(m.sim.board.hour).toBe(hour0 + 1);
    expect(m.sim.board.offers).not.toBe(first);
  });
  test('every job type, subject and place has text; every place resolves on the map for some origin', () => {
    const map = buildMap(mapDef);
    const scratch = { x: 0, y: 0, r: 0 };
    for (const t of catalog.types) {
      for (const v of t.steps) expect(Object.keys(VERBS), `${t.id} verb ${v.verb}`).toContain(v.verb);
      expect(str(t.textKey)).not.toMatch(/^\[/);
      const subs = catalog.subjects.filter((s) => t.subjectTags.some((g) => s.tags.includes(g)));
      expect(subs.length, `${t.id} has subjects`).toBeGreaterThan(0);
      for (const pid of t.places) {
        const pi = idOf(catalog.places, pid);
        expect(pi, `${t.id} place ${pid}`).toBeGreaterThanOrEqual(0);
        expect(map.cells.some((c, i) => ['house', 'shop'].includes(c.kind) && placeZone(map, catalog.places[pi]!, i, jr.zoneR, scratch)), `${pid} resolvable`).toBe(true);
        for (const s of subs)
          for (const count of [1, 2]) {
            const text = jobText(str, catalog, { type: idOf(catalog.types, t.id), subject: idOf(catalog.subjects, s.id), place: pi, count, tier: s.tier, origin: 0 });
            expect(text, `${t.id}/${s.id}/${pid}`).not.toMatch(/[[\]{}]/);
          }
      }
    }
  });
});

describe('job pipeline: each step ends in one event', () => {
  test('walk_leash: talk to the cat, then escort it on a leash to the park', async () => {
    const { m } = await setup('walk_leash', 'cat', 'park');
    const s = subj(m);
    expect(m.sim.job!.step).toBe(0);
    tp(m, s.x + 4, s.y);
    m.step(IDLE);
    expect(m.sim.prompt).toBe(PR_TALK);
    m.step(PRESS);
    expect(stepDone(m)).toEqual([[1, 0]]);
    expect(s.state).toBe(SS_FOLLOW);
    expect(s.leash).toBeGreaterThan(0);
    const z = m.sim.job!.place;
    tp(m, z.x, z.y);
    tpSubject(m, s.idx, z.x + 4, z.y);
    m.step(IDLE, 2);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1]]);
    expect(m.sim.job).toBeNull();
    expect(m.sim.progress).toEqual({ tasksDone: 1, coins: 10, absurd: 0 });
    expect(m.sim.meters.reputation).toBe(72);
    expect(m.events.find((e) => e.name === 'mrfart:job_done')!.payload).toMatchObject({ tier: 0, count: 1, rep: 2, coins: 10 });
  });
  test('escort_cross: the old lady follows across the street', async () => {
    const { m } = await setup('escort_cross', 'old_lady', 'across_street');
    const s = subj(m);
    tp(m, s.x, s.y + 3);
    m.step(PRESS);
    expect(stepDone(m)).toEqual([[1, 0]]);
    expect(s.leash).toBe(0);
    const z = m.sim.job!.place;
    tp(m, z.x, z.y);
    m.step(IDLE);
    expect(m.sim.job).not.toBeNull(); // subject has not arrived
    tpSubject(m, s.idx, z.x, z.y + 5);
    m.step(IDLE, 2);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1]]);
    expect(m.sim.progress.tasksDone).toBe(1);
  });
  test('carry_to: grab, carry into the zone, put down; the subject leaves after a moment', async () => {
    const { m } = await setup('carry_to', 'puppy', 'church');
    const s = subj(m);
    tp(m, s.x + 3, s.y);
    m.step(IDLE);
    expect(m.sim.prompt).toBe(PR_GRAB);
    const bodies = m.sim.deps.physics.stats().bodies;
    m.step(PRESS);
    expect(m.sim.carrying).toBe(s.idx);
    expect(s.state).toBe(SS_CARRIED);
    expect(m.sim.deps.physics.stats().bodies).toBe(bodies - 1);
    const z = m.sim.job!.place;
    tp(m, z.x, z.y);
    m.step(IDLE);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1]]);
    m.step(PRESS);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1], [1, 2]]);
    expect(s.state).toBe(SS_DONE);
    expect(m.sim.carrying).toBe(-1);
    m.step(IDLE, 100);
    expect(s.active).toBe(false);
  });
  test('fetch: the subject waits at the place; carry it back to the doorstep', async () => {
    const { m } = await setup('fetch', 'cat', 'park');
    const s = subj(m);
    expect(Math.hypot(s.x - m.sim.job!.place.x, s.y - m.sim.job!.place.y)).toBeLessThan(30);
    tp(m, s.x, s.y + 2);
    m.step(PRESS);
    const o = m.sim.job!.origin;
    tp(m, o.x, o.y);
    m.step(IDLE);
    m.step(PRESS);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1], [1, 2]]);
    expect(m.sim.progress.tasksDone).toBe(1);
  });
  test('rescue_from_tree: the cat starts up the tree, comes down when the tree is shaken, then walks home', async () => {
    const { m } = await setup('rescue_from_tree', 'cat', 'up_the_tree');
    const s = subj(m);
    expect(s.state).toBe(SS_TREE);
    expect(s.h).toBe(0);
    m.step(PRESS); // not at the tree yet
    expect(stepDone(m)).toEqual([]);
    const t = m.sim.job!.tree;
    tp(m, t.x, t.y);
    m.step(IDLE);
    m.step(PRESS);
    expect(stepDone(m)).toEqual([[1, 0]]);
    expect(s.state).toBe(SS_FOLLOW);
    expect(s.h).not.toBe(0);
    const o = m.sim.job!.origin;
    tp(m, o.x, o.y);
    tpSubject(m, s.idx, o.x, o.y + 3);
    m.step(IDLE, 2);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1]]);
  });
  test('deliver: grab, carry, hand over at the church door', async () => {
    const { m } = await setup('deliver', 'toddler', 'church');
    const s = subj(m);
    tp(m, s.x, s.y + 3);
    m.step(PRESS);
    const z = m.sim.job!.place;
    tp(m, z.x, z.y);
    m.step(IDLE);
    m.step(PRESS);
    expect(stepDone(m)).toEqual([[1, 0], [1, 1], [1, 2]]);
    expect(s.state).toBe(SS_DONE);
    expect(m.sim.meters.reputation).toBe(72);
  });
  test('a heavy subject cannot be grabbed', async () => {
    const { m } = await setup('carry_to', 'cat', 'park');
    const s = subj(m);
    (s as { def: unknown }).def = { ...s.def!, carryMult: 0 };
    tp(m, s.x, s.y + 2);
    m.step(PRESS);
    expect(m.sim.carrying).toBe(-1);
  });
  test('the board prompt shows at the sign and A asks for the board', async () => {
    const m = await makeSim({ people: [], physics: 'null' });
    m.step(IDLE);
    expect(m.sim.prompt).toBe(PR_BOARD);
    m.step(PRESS);
    expect(m.sim.wantBoard).toBe(true);
  });
});

describe('failing and leash safety', () => {
  test('a subject lost for 60 s ends the job with no reward and no penalty', async () => {
    const { m } = await setup('walk_leash', 'puppy', 'park');
    tp(m, m.sim.player.x + 400, m.sim.player.y);
    m.step(IDLE, 3599);
    expect(m.sim.job).not.toBeNull();
    m.step(IDLE, 2);
    expect(m.sim.job).toBeNull();
    expect(m.events.filter((e) => e.name === 'mrfart:job_failed').length).toBe(1);
    expect(m.sim.progress.tasksDone).toBe(0);
    expect(m.sim.meters.reputation).toBe(70);
    expect(m.sim.subjects.every((s) => !s.active)).toBe(true);
  });
  test('abandoning frees the subjects and joints', async () => {
    const { m } = await setup('walk_leash', 'goat', 'park');
    const s = subj(m);
    tp(m, s.x, s.y + 2);
    m.step(PRESS);
    expect(m.sim.deps.physics.stats().joints).toBe(3);
    const { abandonJob } = await import('../logic/pipeline');
    abandonJob(m.sim);
    expect(m.sim.deps.physics.stats().joints).toBe(0);
    expect(m.sim.job).toBeNull();
  });
  test('on Rapier a leashed goat survives the strongest fart: finite poses, rope back within 15% of its length', async () => {
    const m = await makeSim({ people: [], physics: 'rapier' });
    m.sim.meters.nextRollAt = 1e12;
    const offer: JobOffer = { type: idOf(catalog.types, 'walk_leash'), subject: idOf(catalog.subjects, 'goat'), place: idOf(catalog.places, 'park'), count: 1, tier: 1, origin: 0 };
    expect(startJob(m.sim, offer)).toBe(true);
    const s = subj(m);
    tp(m, s.x, s.y + 8);
    m.step(IDLE);
    m.step(PRESS);
    expect(s.leash).toBeGreaterThan(0);
    m.step(IDLE, 30);
    doFart(m.sim, 2, 3); // loud x rocket beans = 960 px/s, the legal maximum
    m.step(IDLE, 300);
    for (const v of [m.sim.player.x, m.sim.player.y, s.x, s.y]) expect(Number.isFinite(v)).toBe(true);
    expect(m.sim.deps.physics.stats().joints).toBe(3);
    expect(Math.hypot(s.x - m.sim.player.x, s.y - m.sim.player.y)).toBeLessThan(s.def!.leash * 1.15);
  });
});
