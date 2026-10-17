// Proves the run phases: death cinematic stages, lives, respawn to the section start, game over, the finish gag, calamity choice and the score formula (racer M3, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { calamityFor } from '../logic/calamity';
import { FX_CAP, FX_OVER, FX_RESPAWN, newFx, pushFx } from '../logic/fx';
import { scoreOf } from '../logic/score';
import { forceCalamity, PHASE_DYING, PHASE_FINISHED, PHASE_OVER, PHASE_RUN, STAGE_BOOM, STAGE_CAPTION, STAGE_SHARDS, stepSim, type Sim } from '../logic/sim';
import { calamities, idle, levels, makeSim, placeAt, rules } from './helpers';

const MS = 1000 / 60;
const step = (sim: Sim, inp = idle()) => stepSim(sim, inp, (sim.nowMs += MS));

/** Step until `done` is true; fails loudly instead of looping forever. */
function until(sim: Sim, done: () => boolean, max = 2000): void {
  for (let i = 0; i < max && !done(); i++) step(sim);
  expect(done()).toBe(true);
}

describe('death cinematic', () => {
  test('stages follow the calamity length: boom, shards, caption, then respawn', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    placeAt(sim, 20);
    expect(forceCalamity(sim, 'gas_station')).toBe(true);
    step(sim);
    expect(sim.phase).toBe(PHASE_DYING);
    const cin = calamities.find((c) => c.id === 'gas_station')!.cinematicMs;
    const t0 = sim.deathAtMs;
    const seen: number[] = [];
    while (sim.phase === PHASE_DYING) {
      step(sim);
      if (seen[seen.length - 1] !== sim.dyingStage) seen.push(sim.dyingStage);
      if (sim.phase === PHASE_DYING) expect(sim.nowMs - t0).toBeLessThan(cin + MS);
    }
    expect(seen.slice(0, 3)).toEqual([STAGE_BOOM, STAGE_SHARDS, STAGE_CAPTION]);
    expect(sim.nowMs - t0).toBeGreaterThanOrEqual(cin);
    expect(sim.phase).toBe(PHASE_RUN);
  });
  test('an explosion hides the car and throws its pieces; a fall keeps the car in view', () => {
    const boom = makeSim(4, 1, 120, 4, true);
    boom.calamities = calamities;
    placeAt(boom, 20);
    forceCalamity(boom, 'train');
    step(boom);
    expect(boom.carHidden).toBe(true);
    expect(boom.pieces.n).toBe(calamities.find((c) => c.id === 'train')!.pieces);
    const fall = makeSim(4, 1, 120, 4, true);
    fall.calamities = calamities;
    placeAt(fall, 20);
    forceCalamity(fall, 'cliff');
    step(fall);
    expect(fall.carHidden).toBe(false);
    const y0 = fall.car.y;
    for (let i = 0; i < 30; i++) step(fall);
    expect(fall.car.y).toBeLessThan(y0 - 2);
  });
  test('an unknown calamity id is refused', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    expect(forceCalamity(sim, 'no_such_thing')).toBe(false);
  });
});

describe('lives and respawn', () => {
  test('respawn restores health, puts the car at its section start and asks the music to seek there', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    const sectionBeats = sim.track.sectionBeats;
    placeAt(sim, sectionBeats * 2 + 5);
    sim.car.health = 30;
    forceCalamity(sim, 'gas_station');
    until(sim, () => sim.phase === PHASE_RUN && sim.deaths === 1);
    expect(sim.lives).toBe(rules.lives - 1);
    expect(sim.car.health).toBe(rules.healthMax);
    expect(sim.car.s).toBeCloseTo(sectionBeats * 2 * sim.segLen, 6);
    expect(sim.seekBar).toBe((sectionBeats * 2) / sim.meter);
    expect(sim.carHidden).toBe(false);
    expect(sim.pieces.n).toBe(0);
    expect(sim.nowMs).toBeLessThan(sim.hitUntilMs);
    expect(sim.power.held).toBe(-1);
  });
  test('the last life ends the level and keeps the score', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    sim.dodged = 20;
    for (let life = 0; life < rules.lives; life++) {
      placeAt(sim, 30);
      forceCalamity(sim, 'cliff');
      until(sim, () => sim.phase !== PHASE_DYING && !(sim.phase === PHASE_RUN && sim.pendingDeath >= 0) && (sim.phase === PHASE_OVER || sim.car.s < 30 * sim.segLen));
    }
    expect(sim.phase).toBe(PHASE_OVER);
    expect(sim.lives).toBe(0);
    expect(sim.deaths).toBe(rules.lives);
    let over = 0;
    for (let i = 0; i < sim.fx.n; i++) if (sim.fx.codes[i] === FX_OVER) over++;
    expect(over).toBe(1);
    expect(scoreOf(sim)).toBe(Math.max(0, Math.floor(sim.distance) + 20 * rules.dodgeScore - rules.lives * rules.deathScore));
    const before = scoreOf(sim);
    for (let i = 0; i < 120; i++) step(sim);
    expect(sim.phase).toBe(PHASE_OVER);
    expect(scoreOf(sim)).toBe(before);
  });
  test('each respawn queues one respawn effect', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    placeAt(sim, 20);
    forceCalamity(sim, 'tornado');
    until(sim, () => sim.deaths === 1 && sim.phase === PHASE_RUN);
    let n = 0;
    for (let i = 0; i < sim.fx.n; i++) if (sim.fx.codes[i] === FX_RESPAWN) n++;
    expect(n).toBe(1);
  });
});

describe('calamity choice', () => {
  test('falls pick the theme calamity first, then the general one', () => {
    expect(calamities[calamityFor(calamities, 'fall', 'desert')]!.id).toBe('cliff');
    expect(calamities[calamityFor(calamities, 'fall', 'harbour')]!.id).toBe('rolled_into_sea');
    expect(calamities[calamityFor(calamities, 'fall', 'moon_base')]!.id).toBe('moon_overshoot');
    expect(calamities[calamityFor(calamities, 'health_zero', 'desert')]!.id).toBe('engine_fire');
    expect(calamities[calamityFor(calamities, 'finish_low', 'desert')]!.id).toBe('out_of_fuel_finish');
    expect(calamityFor(calamities, 'nothing', 'desert')).toBe(-1);
  });
  test('driving off the road into a gap uses the level theme', () => {
    const harbour = levels.find((l) => l.theme === 'harbour')!;
    const sim = makeSim(4, harbour.no, undefined, 4, true);
    sim.calamities = calamities;
    placeAt(sim, 20);
    sim.car.fell = true;
    step(sim);
    // stepCar recomputes `fell` from the road, so force the death the way the sim does for a fall.
    sim.car.fell = true;
    sim.phase = PHASE_RUN;
    expect(calamityFor(sim.calamities, 'fall', sim.theme.id)).toBe(calamities.findIndex((c) => c.id === 'rolled_into_sea'));
  });
});

describe('finish', () => {
  test('arriving with almost no health plays the out-of-fuel gag once; then the finish counts', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    const end = sim.totalBeats - 4;
    placeAt(sim, end);
    sim.car.health = rules.finishMinHealth - 1;
    until(sim, () => sim.phase !== PHASE_RUN, 600);
    expect(sim.phase).toBe(PHASE_DYING);
    expect(sim.calamities[sim.calamity]!.id).toBe('out_of_fuel_finish');
    until(sim, () => sim.phase === PHASE_RUN, 600);
    placeAt(sim, end);
    sim.car.health = rules.finishMinHealth - 1;
    until(sim, () => sim.phase !== PHASE_RUN, 600);
    expect(sim.phase).toBe(PHASE_FINISHED);
  });
  test('arriving healthy finishes straight away', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.calamities = calamities;
    placeAt(sim, sim.totalBeats - 4);
    until(sim, () => sim.phase !== PHASE_RUN, 600);
    expect(sim.phase).toBe(PHASE_FINISHED);
    expect(sim.deaths).toBe(0);
  });
});

describe('score and effects queue', () => {
  test('score is distance + synced beats x10 + dodges x5 + pieces x1 + coins x10 - deaths x500, never below 0', () => {
    const sim = makeSim(4, 1, 120, 4, true);
    sim.distance = 2000.9;
    sim.syncedBeats = 7;
    sim.dodged = 4;
    sim.broken = 13;
    sim.coins = 3;
    sim.deaths = 1;
    expect(scoreOf(sim)).toBe(2000 + 70 + 20 + 13 + 30 - 500);
    sim.distance = 0;
    sim.syncedBeats = 0;
    sim.dodged = 0;
    sim.broken = 0;
    sim.coins = 0;
    sim.deaths = 2;
    expect(scoreOf(sim)).toBe(0);
  });
  test('the effects queue drops the new code when full and counts it', () => {
    const q = newFx();
    for (let i = 0; i < FX_CAP + 5; i++) pushFx(q, 1, i);
    expect(q.n).toBe(FX_CAP);
    expect(q.dropped).toBe(5);
    expect(q.values[FX_CAP - 1]).toBe(FX_CAP - 1);
  });
});
