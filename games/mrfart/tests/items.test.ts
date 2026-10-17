// Proves: each item's effect, the shop, found items, every ending and the triggers that reach it, streaming of 60 people. Area: mrfart M3. 2026-10-17
import { describe, expect, test } from 'vitest';
import { doFart } from '../logic/farts';
import { chooseEnding, endRun } from '../logic/endings';
import { buyItem, cycleItem, fartMods, giveItem, itemIndex, newMods, restock, rollFound, useItem } from '../logic/items';
import { checkLost, settleDay } from '../logic/reputation';
import { startJob } from '../logic/pipeline';
import { createRng } from '../logic/rng';
import { placeZone } from '../logic/zones';
import { STATUS_LOST, STATUS_PLAYING, STATUS_WON } from '../logic/types';
import type { JobOffer } from '../logic/jobTypes';
import { makeBot } from './bot';
import { IDLE, catalog, endingDefs, fartDefs, itemDefs, makeSim, rules } from './harness';
import type { Made } from './harness';

const LOUD = fartDefs.length - 1;
const idOf = (list: ReadonlyArray<{ id: string }>, id: string) => {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`no such id ${id}`);
  return i;
};

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

describe('items', () => {
  const ix = (m: Made, id: string) => itemIndex(m.sim, id);
  const mods = () => newMods();
  test('each cursed item changes the fart as described', async () => {
    const m = await makeSim({ people: [] });
    const s = m.sim;
    const give = (id: string) => expect(giveItem(s, ix(m, id))).toBe(true);
    expect(fartMods(s, 0, mods()).kind).toBe(0);
    give('tuba');
    expect(fartMods(s, 0, mods())).toMatchObject({ kind: LOUD, key: 10 });
    s.inv.items.length = 0;
    give('kazoo');
    expect(fartMods(s, LOUD, mods())).toMatchObject({ kind: 1, pitch: 12 });
    s.inv.items.length = 0;
    give('rocket_beans');
    expect(fartMods(s, 0, mods()).forceMul).toBe(3);
    s.inv.items.length = 0;
    give('haunted_whistle');
    expect(fartMods(s, 0, mods())).toMatchObject({ intolMul: 2, key: 9, pitch: -3 });
    s.inv.items.length = 0;
    give('chili_dog');
    s.inv.items.length = 0;
    expect(giveItem(s, ix(m, 'tuba'))).toBe(true);
    expect(giveItem(s, ix(m, 'tuba'))).toBe(false); // cursed ones are held once
  });
  test('tuba: every fart is loud and the sound event carries the key', async () => {
    const m = await makeSim({ people: [] });
    giveItem(m.sim, ix(m, 'tuba'));
    m.sim.meters.fart = 10;
    doFart(m.sim, 0);
    const e = m.events.filter((x) => x.name === 'mrfart:fart')[0]!;
    expect(e.payload).toMatchObject({ kind: LOUD, key: 10, pitch: 0 });
  });
  test('rocket beans triple the force', async () => {
    const a = await makeSim({ people: [] });
    doFart(a.sim, LOUD);
    const b = await makeSim({ people: [] });
    giveItem(b.sim, ix(b, 'rocket_beans'));
    doFart(b.sim, LOUD);
    expect(b.sim.lastFart.force).toBeCloseTo(Math.min(rules.fart.maxForce, a.sim.lastFart.force * 3), 5);
  });
  test('chili dog multiplies meter gain', async () => {
    const run = { ...IDLE, mx: 1, run: true };
    const a = await makeSim({ people: [] });
    const b = await makeSim({ people: [] });
    giveItem(b.sim, ix(b, 'chili_dog'));
    a.sim.meters.nextRollAt = b.sim.meters.nextRollAt = 1e12;
    a.step(run, 40);
    b.step(run, 40);
    expect(b.sim.meters.fart / a.sim.meters.fart).toBeCloseTo(1.5, 2);
  });
  test('butt cork: nothing fires for the duration, then exactly one loud fart', async () => {
    const m = await makeSim({ people: [] });
    giveItem(m.sim, ix(m, 'butt_cork'));
    m.sim.meters.fart = rules.meter.max;
    useItem(m.sim);
    expect(m.sim.inv.items).toHaveLength(0);
    m.step(IDLE, 60 * 59);
    expect(m.sim.lastFart.count).toBe(0);
    m.step(IDLE, 120);
    expect(m.sim.lastFart.count).toBe(1);
    expect(m.sim.lastFart.kind).toBe(LOUD);
  });
  test('comfy pants lower stress; megaphone clears the angriest person', async () => {
    const m = await makeSim({ people: [] });
    m.sim.meters.stress = 50;
    giveItem(m.sim, ix(m, 'comfy_pants'));
    useItem(m.sim);
    expect(m.sim.meters.stress).toBe(30);
    const n = await makeSim();
    n.sim.people[3]!.intol = 7;
    n.sim.people[9]!.intol = 20;
    n.sim.meters.intolToday = 40;
    giveItem(n.sim, ix(n, 'megaphone_of_apology'));
    useItem(n.sim);
    expect(n.sim.people[9]!.intol).toBe(0);
    expect(n.sim.people[3]!.intol).toBe(7);
    expect(n.sim.meters.intolToday).toBe(20);
  });
  test('air freshener halves witness range for a day, cologne cuts notice chance, both end', async () => {
    const m = await makeSim({ people: [] });
    giveItem(m.sim, ix(m, 'air_freshener'));
    giveItem(m.sim, ix(m, 'cologne'));
    useItem(m.sim);
    useItem(m.sim);
    expect(fartMods(m.sim, 0, mods())).toMatchObject({ witnessMul: 0.5, noticeMul: 0.7 });
    m.sim.now += rules.world.dayMs + 1;
    expect(fartMods(m.sim, 0, mods())).toMatchObject({ witnessMul: 1, noticeMul: 1 });
  });
  test('nice shoes add reputation per task; the bag has a cap; cycling wraps', async () => {
    const { m } = await started('carry_to', 'cat');
    giveItem(m.sim, ix(m, 'nice_shoes'));
    m.sim.meters.reputation = 10;
    expect(makeBot(m).play(60 * 600)).toBeGreaterThan(0);
    expect(m.sim.meters.reputation).toBe(10 + rules.jobs.repBase + 1);
    const n = await makeSim({ people: [] });
    for (let i = 0; i < rules.items.max; i++) expect(giveItem(n.sim, ix(n, 'comfy_pants'))).toBe(true);
    expect(giveItem(n.sim, ix(n, 'comfy_pants'))).toBe(false);
    cycleItem(n.sim, 1);
    expect(n.sim.inv.sel).toBe(1);
    cycleItem(n.sim, -1);
    cycleItem(n.sim, -1);
    expect(n.sim.inv.sel).toBe(rules.items.max - 1);
  });
  test('shop: stock is three non-cursed items, buying costs coins, too poor or full bag refuses', async () => {
    const m = await makeSim({ people: [] });
    restock(m.sim);
    expect(m.sim.inv.stock).toHaveLength(rules.items.stock);
    expect(new Set(m.sim.inv.stock).size).toBe(rules.items.stock);
    for (const i of m.sim.inv.stock) expect(itemDefs[i]!.cursed).toBe(false);
    expect(buyItem(m.sim, 0)).toBe(false);
    m.sim.progress.coins = 1000;
    const price = itemDefs[m.sim.inv.stock[0]!]!.price;
    expect(buyItem(m.sim, 0)).toBe(true);
    expect(m.sim.progress.coins).toBe(1000 - price);
    expect(m.sim.inv.items).toHaveLength(1);
  });
  test('found gifts: about a fifth of tasks, a quarter of those cursed (same seed same result)', async () => {
    const counts = { found: 0, cursed: 0 };
    const m = await makeSim({ people: [], rng: { items: createRng(77) } });
    for (let i = 0; i < 2000; i++) {
      m.sim.inv.items.length = 0;
      m.events.length = 0;
      rollFound(m.sim);
      const e = m.events.find((x) => x.name === 'mrfart:item_found');
      if (e) { counts.found++; if (e.payload.cursed) counts.cursed++; }
    }
    expect(counts.found / 2000).toBeGreaterThan(0.16);
    expect(counts.found / 2000).toBeLessThan(0.24);
    expect(counts.cursed / counts.found).toBeGreaterThan(0.18);
    expect(counts.cursed / counts.found).toBeLessThan(0.32);
  });
});

describe('endings', () => {
  const state = async () => {
    const m = await makeSim({ people: [] });
    m.sim.meters.nextRollAt = 1e12;
    return m;
  };
  const lose = (m: Made) => {
    m.sim.meters.reputation = 0;
    checkLost(m.sim);
    return m.sim.ending;
  };
  test('default is the angry crowd', async () => {
    const m = await state();
    expect(lose(m)).toBe('pitchforks');
    expect(m.sim.status).toBe(STATUS_LOST);
  });
  test('each condition picks its ending, in order', async () => {
    const a = await state();
    giveItem(a.sim, itemIndex(a.sim, 'rocket_beans'));
    expect(lose(a)).toBe('moon_shot');
    const b = await state();
    b.sim.stats.maxForce = 200;
    expect(lose(b)).toBe('moon_shot');
    const c = await state();
    c.sim.stats.loudInShop = 3;
    expect(lose(c)).toBe('tar_feather');
    const d = await state();
    d.sim.stats.harbourFart = true;
    expect(lose(d)).toBe('exiled_to_sea');
    const e = await state();
    e.sim.progress.tasksDone = 500;
    expect(lose(e)).toBe('elected_mayor');
    const f = await state();
    for (const id of ['tuba', 'kazoo', 'haunted_whistle']) giveItem(f.sim, itemIndex(f.sim, id));
    expect(lose(f)).toBe('scientific_study');
    const g = await state();
    g.sim.stats.loudInShop = 3;
    g.sim.stats.harbourFart = true;
    expect(lose(g)).toBe('tar_feather'); // lower order wins
  });
  test('a loud fart in a shop and one in the harbour are counted, and midnight starts the count again', async () => {
    const m = await state();
    const shop = m.sim.deps.map.cells.find((c) => c.kind === 'shop')!;
    const harbour = m.sim.deps.map.cells.find((c) => c.kind === 'harbour')!;
    m.sim.deps.physics.setPosition(m.sim.player.h, shop.doorX, shop.doorY);
    m.step(IDLE);
    doFart(m.sim, LOUD);
    doFart(m.sim, 1);
    expect(m.sim.stats.loudInShop).toBe(1);
    m.sim.deps.physics.setPosition(m.sim.player.h, harbour.doorX, harbour.doorY);
    m.step(IDLE);
    doFart(m.sim, 0);
    expect(m.sim.stats.harbourFart).toBe(true);
    settleDay(m.sim, m.sim.day + 1);
    expect(m.sim.stats).toEqual({ loudInShop: 0, harbourFart: false, maxForce: 0 });
  });
  test('holding a clench for the balloon time ends the run', async () => {
    const m = await state();
    const hold = { ...IDLE, clench: true };
    m.step(hold, Math.ceil((rules.meter.balloonMs / 1000) * 60) + 5);
    expect(m.sim.ending).toBe('balloon');
    expect(m.sim.status).toBe(STATUS_LOST);
  });
  test('1000 tasks win with the parade, and the run stops accepting changes', async () => {
    const { m } = await started('carry_to', 'cat');
    m.sim.progress.tasksDone = rules.ending.tasksWin - 1;
    expect(makeBot(m).play(60 * 600)).toBeGreaterThan(0);
    expect(m.sim.status).toBe(STATUS_WON);
    expect(m.sim.ending).toBe('parade');
    expect(endRun(m.sim, 'pitchforks')).toBe(false);
    const fart = m.sim.meters.fart;
    m.step({ ...IDLE, mx: 1, run: true }, 120);
    expect(m.sim.meters.fart).toBe(fart); // rules are frozen after the ending
  });
  test('every ending can be reached by id (the ?ending door)', async () => {
    for (const e of endingDefs) {
      const m = await state();
      expect(endRun(m.sim, e.id), e.id).toBe(true);
      expect(m.sim.status).toBe(e.win ? STATUS_WON : STATUS_LOST);
      expect(m.events.at(-1)!.name).toBe(e.win ? 'mrfart:game_won' : 'mrfart:game_over');
    }
    const m = await state();
    expect(endRun(m.sim, 'nonsense')).toBe(false);
    expect(m.sim.status).toBe(STATUS_PLAYING);
    expect(chooseEnding(m.sim, 'rep_zero')).toBe('pitchforks');
  });
});

describe('60 people', () => {
  test('bodies exist only near the player and stay under the cap', async () => {
    const m = await makeSim();
    expect(m.sim.people).toHaveLength(60);
    const bodies = () => m.sim.deps.physics.stats().bodies;
    const near = m.sim.people.filter((p) => p.h !== 0).length;
    expect(near).toBeLessThan(60);
    expect(bodies()).toBeLessThanOrEqual(rules.caps.bodies);
    const far = m.sim.deps.map;
    m.sim.deps.physics.setPosition(m.sim.player.h, far.pxW - 60, far.pxH - 60);
    m.step(IDLE, rules.stream.every * 2);
    const px = m.sim.player.x, py = m.sim.player.y;
    for (const p of m.sim.people) {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < rules.stream.near - 40) expect(p.h, `person ${p.idx} at ${Math.round(d)}`).not.toBe(0);
      if (d > rules.stream.far + 40) expect(p.h).toBe(0);
    }
    expect(bodies()).toBeLessThanOrEqual(rules.caps.bodies);
  });
  test('everyone walks their route even without a body (ledger positions advance)', async () => {
    const m = await makeSim();
    const p = m.sim.people.find((q) => q.h === 0)!;
    const x0 = p.x, y0 = p.y;
    m.step(IDLE, 60 * 40);
    expect(Math.hypot(p.x - x0, p.y - y0)).toBeGreaterThan(5);
  });
});


describe('budget scene cheat', () => {
  test('load_test fills the body cap and the piece pool, and the sim keeps stepping', async () => {
    const { applyCheat } = await import('../logic/cheats');
    const m = await makeSim({ people: [] });
    expect(applyCheat(m.sim, 'load_test')).toBe(true);
    expect(m.sim.deps.physics.stats().bodies).toBe(rules.caps.bodies);
    expect(m.sim.pieces.count).toBe(rules.caps.pieces);
    m.step(IDLE, 120);
    const p = { x: 0, y: 0, angle: 0, vx: 0, vy: 0 };
    expect(m.sim.deps.physics.pose(m.sim.player.h, p)).toBe(true);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});

describe('reduced effects', () => {
  test('pools shrink to the reduced caps: 128 pieces, 96 bodies', async () => {
    expect(rules.caps.piecesReduced).toBe(128);
    expect(rules.caps.bodiesReduced).toBe(96);
    const { createSim } = await import('../logic/sim');
    const { createRapierPhysics } = await import('../physics/rapier/RapierPhysics');
    const { buildMap } = await import('../logic/map');
    const { createRng } = await import('../logic/rng');
    const { mapDef, fartDefs: farts, personDefs, itemDefs: items, endingDefs: endings, catalog: cat } = await import('./harness');
    const propsJson = (await import('../content/props/props.json')).default as unknown as import('../logic/types').PropDef[];
    const physics = await createRapierPhysics({ maxBodies: rules.caps.bodiesReduced });
    const sim = createSim({
      physics, rules, map: buildMap(mapDef), farts, props: propsJson, people: personDefs, items, endings, catalog: cat, reducedFx: true,
      rng: { fart: createRng(1), fx: createRng(2), people: createRng(3), notice: createRng(4), jobs: createRng(5), items: createRng(6) }, emit: () => {},
    });
    expect(sim.pieces.max).toBe(128);
    for (let i = 0; i < 300; i++) physics.addBody({ kind: 'prop', shape: 'box', x: 50 + i, y: 50, hw: 2, hh: 2, mass: 1 });
    expect(physics.stats().bodies).toBeLessThanOrEqual(96);
  });
});
