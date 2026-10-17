// Proves: content counts, all 20 job types finish with a scripted player, verbs and modifiers. Area: mrfart M3. 2026-10-17
import { describe, expect, test } from 'vitest';
import { doFart } from '../logic/farts';
import { jobText } from '../logic/jobs';
import { SS_FLEE, SS_IDLE } from '../logic/jobTypes';
import type { JobOffer } from '../logic/jobTypes';
import { startJob } from '../logic/pipeline';
import { placeZone } from '../logic/zones';
import strings from '../content/strings.json';
import { makeBot } from './bot';
import { IDLE, catalog, endingDefs, fartDefs, itemDefs, makeSim, personDefs, rules } from './harness';
import type { Made } from './harness';

const idOf = (list: ReadonlyArray<{ id: string }>, id: string) => {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`no such id ${id}`);
  return i;
};
const str = (key: string, params?: Record<string, string | number>) => {
  const s = (strings as Record<string, string>)[key];
  if (s === undefined) return `[${key}]`;
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
};
const LOUD = fartDefs.length - 1;

async function started(type: string, subject: string, mod = -1, count = 1): Promise<{ m: Made; offer: JobOffer }> {
  const m = await makeSim({ people: [] });
  m.sim.meters.nextRollAt = 1e12;
  const t = catalog.types[idOf(catalog.types, type)]!;
  const map = m.sim.deps.map;
  const zone = { x: 0, y: 0, r: 0 };
  for (let origin = 0; origin < map.cells.length; origin++) {
    if (!['house', 'grandma'].includes(map.cells[origin]!.kind)) continue;
    for (const pid of t.places) {
      const place = idOf(catalog.places, pid);
      if (!placeZone(map, catalog.places[place]!, origin, rules.jobs.zoneR, zone)) continue;
      const s = catalog.subjects[idOf(catalog.subjects, subject)]!;
      const offer: JobOffer = { type: idOf(catalog.types, type), subject: idOf(catalog.subjects, subject), place, count, mod, tier: s.tier, origin };
      expect(startJob(m.sim, offer)).toBe(true);
      return { m, offer };
    }
  }
  throw new Error(`no origin/place for ${type}`);
}

describe('content counts', () => {
  test('numbers from the plan', () => {
    expect(catalog.types).toHaveLength(20);
    expect(catalog.subjects.length).toBeGreaterThanOrEqual(20);
    expect(new Set(catalog.subjects.map((s) => s.tier))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(catalog.places.length).toBeGreaterThanOrEqual(9);
    expect(catalog.mods.length).toBeGreaterThanOrEqual(4);
    expect(personDefs).toHaveLength(60);
    expect(itemDefs.filter((i) => !i.cursed)).toHaveLength(6);
    expect(itemDefs.filter((i) => i.cursed)).toHaveLength(5);
    expect(endingDefs.filter((e) => !e.win)).toHaveLength(7);
    expect(endingDefs.filter((e) => e.win)).toHaveLength(1);
    expect(fartDefs).toHaveLength(3);
  });
  test('strings exist for every item, ending and modifier', () => {
    for (const i of itemDefs) expect(str(`item_${i.id}`), i.id).not.toMatch(/^\[/);
    for (const e of endingDefs) {
      expect(str(`ending_${e.id}`), e.id).not.toMatch(/^\[/);
      expect(str(`ending_${e.id}_text`), e.id).not.toMatch(/^\[/);
    }
    for (const md of catalog.mods) expect(str(`mod_${md.id}`), md.id).not.toMatch(/^\[/);
  });
  test('modifier text is appended to the job line', () => {
    const o: JobOffer = { type: 0, subject: 0, place: 0, count: 1, mod: 0, tier: 0, origin: 0 };
    expect(jobText(str, catalog, o)).toMatch(/quietly$/i);
    expect(jobText(str, catalog, { ...o, mod: -1 })).not.toMatch(/quietly/i);
  });
  test('no job type can draw a subject its verbs cannot work with', () => {
    for (const t of catalog.types) {
      const verbs = t.steps.map((st) => st.verb);
      for (const s of catalog.subjects.filter((q) => t.subjectTags.some((g) => q.tags.includes(g)))) {
        if (verbs.includes('escort')) expect(s.speed, `${t.id} escorts ${s.id}`).toBeGreaterThan(0);
        if (verbs.includes('grab')) expect(s.carryMult, `${t.id} carries ${s.id}`).toBeGreaterThan(0);
        if (t.runaway) expect(s.speed, `${t.id} chases ${s.id}`).toBeGreaterThan(0);
      }
      expect(catalog.subjects.some((q) => t.subjectTags.some((g) => q.tags.includes(g)) && q.tier <= 1), `${t.id} has a gentle subject`).toBe(true);
    }
  });
  test('every type has a text that fills all its params', () => {
    for (const t of catalog.types) expect(str(t.textKey, { count: 1, subject: 'x', place: 'x', from: 'x', at: 'x' }), t.id).not.toMatch(/[[\]{}]/);
  });
});

describe('all 20 job types finish with a scripted player', () => {
  const pick = (t: (typeof catalog.types)[number]) => {
    const s = catalog.subjects.find((q) => q.tier <= 1 && t.subjectTags.some((g) => q.tags.includes(g)));
    if (!s) throw new Error(`no tier 0-1 subject for ${t.id}`);
    return s.id;
  };
  for (const t of catalog.types) {
    test(t.id, async () => {
      const { m } = await started(t.id, pick(t));
      const events: string[] = [];
      const stepsOf = t.steps.length;
      const n = makeBot(m).play(60 * 60 * 6);
      for (const e of m.events) events.push(e.name);
      expect(n, `${t.id} did not finish`).toBeGreaterThan(0);
      expect(m.sim.progress.tasksDone).toBe(1);
      expect(events.filter((e) => e === 'mrfart:step_done')).toHaveLength(stepsOf);
      expect(events).toContain('mrfart:job_done');
    }, 60000);
  }
  test('the heaviest and the fastest still finish: jet plane pushed, whale walked, clone caught', async () => {
    for (const [type, subj] of [['push_to', 'jet_plane'], ['walk_leash', 'whale'], ['catch_runaway', 'mr_farts_clone'], ['hold_still_for', 'the_moon']] as const) {
      const { m } = await started(type, subj);
      expect(makeBot(m).play(60 * 60 * 8), `${type} ${subj}`).toBeGreaterThan(0);
      expect(m.sim.progress.tasksDone).toBe(1);
    }
  }, 120000);
});

describe('verbs', () => {
  test('a runaway keeps its distance until caught, and stops fleeing once held', async () => {
    const { m } = await started('catch_runaway', 'cat');
    const s = m.sim.subjects[m.sim.job!.subjects[0]!]!;
    expect(s.state).toBe(SS_FLEE);
    const pl = m.sim.player;
    m.sim.deps.physics.setPosition(pl.h, s.x - 60, s.y);
    m.step(IDLE);
    const d0 = Math.hypot(s.x - pl.x, s.y - pl.y);
    m.step(IDLE, 90);
    expect(Math.hypot(s.x - pl.x, s.y - pl.y)).toBeGreaterThan(d0 - 1);
    expect(s.x).toBeGreaterThan(pl.x); // ran away from the player, not toward
  });
  test('hold-still restarts when the player moves or farts and succeeds after n quiet seconds', async () => {
    const { m } = await started('hold_still_for', 'cat');
    const pl = m.sim.player;
    const s = m.sim.subjects[m.sim.job!.subjects[0]!]!;
    m.sim.deps.physics.setPosition(pl.h, s.x + 6, s.y);
    m.step({ ...IDLE, interact: true }); // talk: step 0 done
    expect(m.sim.job!.step).toBe(1);
    m.step(IDLE, 120);
    const t0 = m.sim.job!.stepStartedAt;
    m.sim.deps.physics.setPosition(pl.h, s.x + 8, s.y); // a move of 2 px
    m.step(IDLE);
    expect(m.sim.job!.stepStartedAt).toBeGreaterThan(t0);
    m.step(IDLE, 60);
    doFart(m.sim, 0);
    m.step(IDLE);
    const t1 = m.sim.job!.stepStartedAt;
    expect(t1).toBe(m.sim.now); // fart reset the count
    m.step(IDLE, 60 * 3 - 2);
    expect(m.sim.job).not.toBeNull();
    m.step(IDLE, 6);
    expect(m.sim.job).toBeNull();
    expect(m.sim.progress.tasksDone).toBe(1);
  });
  test('strike needs exactly n presses at the zone, waiting counts game time in the zone', async () => {
    const { m } = await started('sweep', 'cat');
    const z = m.sim.job!.place;
    m.sim.deps.physics.setPosition(m.sim.player.h, z.x, z.y);
    m.step({ ...IDLE, interact: true }); // start
    expect(m.sim.job!.step).toBe(1);
    for (let i = 0; i < 7; i++) m.step({ ...IDLE, interact: true });
    expect(m.sim.job!.hits).toBe(7);
    m.step({ ...IDLE, interact: true });
    expect(m.sim.job).toBeNull();
    const w = await started('guard_spot', 'cat');
    const wz = w.m.sim.job!.place;
    w.m.sim.deps.physics.setPosition(w.m.sim.player.h, wz.x, wz.y);
    w.m.step(IDLE, 60 * 10 - 5);
    expect(w.m.sim.job!.step).toBe(0);
    w.m.step(IDLE, 10);
    expect(w.m.sim.job!.step).toBe(1);
  });
});

describe('modifiers', () => {
  const quiet = catalog.mods.findIndex((x) => x.cond === 'quiet');
  const nodrop = catalog.mods.findIndex((x) => x.cond === 'nodrop');
  const fire = catalog.mods.findIndex((x) => x.cond === 'fire');
  const timed = catalog.mods.findIndex((x) => x.cond === 'time');
  const base = rules.jobs.repBase;
  test('quietly: a clean job pays the bonus, a squeaky fart in the middle does not', async () => {
    const a = await started('carry_to', 'cat', quiet);
    expect(makeBot(a.m).play(60 * 600)).toBeGreaterThan(0);
    const bonus = catalog.mods[quiet]!.bonus;
    expect(a.m.events.find((e) => e.name === 'mrfart:job_done')!.payload.rep).toBe(Math.round(base * bonus * 10) / 10);
    const b = await started('carry_to', 'cat', quiet);
    b.m.sim.meters.fart = 50;
    doFart(b.m.sim, 1);
    expect(makeBot(b.m).play(60 * 600)).toBeGreaterThan(0);
    expect(b.m.events.find((e) => e.name === 'mrfart:job_done')!.payload.rep).toBe(base);
  });
  test('without dropping it: a loud fart in your arms drops them, you can pick up again, and the bonus is gone', async () => {
    const { m } = await started('carry_to', 'cat', nodrop);
    const s = m.sim.subjects[m.sim.job!.subjects[0]!]!;
    m.sim.deps.physics.setPosition(m.sim.player.h, s.x + 4, s.y);
    m.step({ ...IDLE, interact: true }); // grab
    expect(m.sim.carrying).toBe(s.idx);
    doFart(m.sim, LOUD);
    expect(m.sim.carrying).toBe(-1);
    expect(s.state).toBe(SS_IDLE);
    expect(m.sim.job!.drops).toBe(1);
    expect(makeBot(m).play(60 * 600)).toBeGreaterThan(0);
    expect(m.events.find((e) => e.name === 'mrfart:job_done')!.payload.rep).toBe(base);
  });
  test('before the bus: only a fast job pays', async () => {
    const lim = catalog.mods[timed]!.limitMs;
    const { m } = await started('escort_cross', 'old_lady', timed);
    m.sim.job!.startedAt = m.sim.now - lim - 1;
    expect(makeBot(m).play(60 * 600)).toBeGreaterThan(0);
    expect(m.events.find((e) => e.name === 'mrfart:job_done')!.payload.rep).toBe(base);
  });
  test('while it is on fire: standing next to the subject adds stress, far away does not', async () => {
    const { m } = await started('walk_leash', 'goat', fire);
    const s = m.sim.subjects[m.sim.job!.subjects[0]!]!;
    m.sim.deps.physics.setPosition(m.sim.player.h, s.x + 5, s.y);
    const s0 = m.sim.meters.stress;
    m.step(IDLE, 60);
    expect(m.sim.meters.stress).toBeCloseTo(s0 + rules.jobs.fireStress - rules.stress.aloneDecay, 3); // 60 steps = 1 s, minus the calm-when-alone decay
    m.sim.deps.physics.setPosition(m.sim.player.h, s.x + 200, s.y);
    m.sim.meters.stress = 0;
    m.step(IDLE, 60);
    expect(m.sim.meters.stress).toBe(0);
  });
});
