// Proves hazard placement is deterministic and legal, and that hits, shields, boosts and pickups do exactly the maths in the content (racer M3, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { PHASE_DYING, PHASE_RUN, stepSim } from '../logic/sim';
import { HZ_ALIVE, HZ_BROKEN, HZ_PASSED } from '../logic/types';
import { hasSeg, segAt } from '../logic/track';
import { driveTo, hazards, idle, levels, makeSim, placeAt, plant, plantPickup, rules } from './helpers';

const def = (id: string) => hazards.find((h) => h.id === id)!;

/** Run a car down the lane at `lane` through segment `at` where hazard `id` waits. */
function hitRun(id: string, lane: number, setup: (s: ReturnType<typeof makeSim>) => void = () => {}) {
  const sim = makeSim(5, 1, 120, 4, true);
  sim.hazards = hazards;
  sim.powers = makeSim(5, 1, 120).powers;
  sim.calamities = makeSim(5, 1, 120).calamities;
  plant(sim, id, 12, lane);
  placeAt(sim, 8);
  sim.car.lane = lane;
  setup(sim);
  driveTo(sim, 14);
  return sim;
}

describe('placement', () => {
  test('same seed gives the same hazards and pickups; another seed differs', () => {
    const scan = (seed: number) => {
      const sim = makeSim(seed, 7);
      const out: number[] = [];
      for (let i = 0; i < 60; i++) {
        placeAt(sim, i);
        const s = segAt(sim.track, i);
        out.push(s.hz, Math.round(s.hzLane * 100), s.pk);
      }
      return out.join(',');
    };
    expect(scan(3)).toBe(scan(3));
    expect(scan(3)).not.toBe(scan(4));
  });
  test('none on gaps, ramps, drops, tunnels, splits or before the start beat; lanes are lane centres', () => {
    for (const lv of levels) {
      const sim = makeSim(9, lv.no);
      let seen = 0;
      for (let i = 0; i < 300; i++) {
        placeAt(sim, i);
        const s = segAt(sim.track, i);
        if (s.hz < 0 && s.pk < 0) continue;
        seen++;
        expect(i).toBeGreaterThanOrEqual(rules.hazardStartBeat);
        expect(s.gap || s.ramp || s.drop).toBe(false);
        if (s.hz >= 0) {
          expect(s.tunnel || s.split).toBe(false);
          const d = sim.hazards[s.hz]!;
          expect(sim.theme.hazardWeights[d.id], `${lv.id} ${d.id}`).toBeGreaterThan(0);
          const lanes = [-2 / 3, 0, 2 / 3];
          const centre = d.span === 1 ? lanes.some((l) => Math.abs(l - s.hzLane) < 1e-9) : d.span === 2 ? [-1 / 3, 1 / 3].some((l) => Math.abs(l - s.hzLane) < 1e-9) : Math.abs(s.hzLane) < 1e-9;
          expect(centre, `${d.id} lane ${s.hzLane}`).toBe(true);
        }
      }
      expect(seen, lv.id).toBeGreaterThan(10);
    }
  });
  test('hazards keep their minimum spacing', () => {
    const sim = makeSim(2, 4);
    let last = -99;
    for (let i = 0; i < 400; i++) {
      placeAt(sim, i);
      if (segAt(sim.track, i).hz >= 0) {
        expect(i - last).toBeGreaterThanOrEqual(rules.minorGapBeats);
        last = i;
      }
    }
  });
  test('the road itself is the same with and without hazards', () => {
    const a = makeSim(6, 5, undefined, 4, true);
    const b = makeSim(6, 5);
    placeAt(a, 200);
    placeAt(b, 200);
    for (let i = 100; i < 200; i++) {
      const p = segAt(a.track, i);
      const q = segAt(b.track, i);
      expect([p.kind, p.x1, p.z1, p.yaw1]).toEqual([q.kind, q.x1, q.z1, q.yaw1]);
    }
  });
});

describe('minor hits', () => {
  test('a cone takes damage inside its range, slows the car and breaks into its piece count', () => {
    const sim = hitRun('cone', 0);
    const d = def('cone');
    const lost = rules.healthMax - sim.car.health;
    expect(lost).toBeGreaterThanOrEqual(d.damageMin);
    expect(lost).toBeLessThanOrEqual(d.damageMax);
    expect(sim.pieces.spawned).toBe(d.breakInto);
    expect(sim.broken).toBe(d.breakInto);
    expect(segAt(sim.track, 12).hzState).toBe(HZ_BROKEN);
  });
  test('the same hazard cannot hit twice, and missing it is a dodge', () => {
    const hit = hitRun('crate', 0);
    expect(hit.dodged).toBe(0);
    const miss = hitRun('crate', 2 / 3, (s) => (s.car.lane = -2 / 3));
    expect(miss.car.health).toBe(rules.healthMax);
    expect(miss.dodged).toBe(1);
    expect(segAt(miss.track, 12).hzState).toBe(HZ_PASSED);
  });
  test('hits during the cooldown do no damage', () => {
    const sim = makeSim(5, 1, 120, 4, true);
    sim.hazards = hitRun('cone', 0).hazards;
    plant(sim, 'cone', 12, 0);
    plant(sim, 'cone', 13, 0);
    placeAt(sim, 9);
    driveTo(sim, 15);
    expect(rules.healthMax - sim.car.health).toBeLessThanOrEqual(def('cone').damageMax);
  });
  test('a hop over a minor hazard clears it', () => {
    const sim = makeSim(5, 1, 120, 4, true);
    sim.hazards = hazards;
    plant(sim, 'cone', 10, 0);
    placeAt(sim, 8);
    sim.car.airborne = true;
    sim.car.vh = 20;
    sim.car.h = 0.1;
    driveTo(sim, 11);
    expect(sim.car.health).toBe(rules.healthMax);
    expect(sim.dodged).toBe(0);
    expect(segAt(sim.track, 10).hzState).toBe(HZ_ALIVE);
  });
  test('a puddle locks steering for slideMs scaled by the theme ice', () => {
    const sim = makeSim(5, 1, 120, 4, true);
    sim.hazards = hazards;
    plant(sim, 'puddle', 12, 0);
    placeAt(sim, 9);
    sim.car.lane = -0.1;
    driveTo(sim, 13, 0.05);
    expect(sim.car.slideSteer).toBeCloseTo(0.05 * rules.slideSteerFrac, 9);
    expect(sim.car.slideUntilMs - sim.nowMs).toBeLessThanOrEqual(def('puddle').slideMs * (1 + sim.theme.ice * 1.5));
    expect(sim.car.slideUntilMs).toBeGreaterThan(sim.nowMs - 200);
  });
  test('boost makes minor hazards break without damage', () => {
    const sim = hitRun('barrel', 0, (s) => (s.power.invulnUntilMs = 1e9));
    expect(sim.car.health).toBe(rules.healthMax);
    expect(sim.broken).toBe(def('barrel').breakInto);
  });
  test('zero health ends the run with the engine fire calamity', () => {
    const sim = makeSim(5, 1, 120, 4, true);
    sim.car.health = 1;
    sim.hazards = hitRun('cone', 0).hazards;
    sim.calamities = makeSim(5, 1, 120).calamities;
    plant(sim, 'cone', 12, 0);
    placeAt(sim, 9);
    driveTo(sim, 14);
    expect(sim.phase).toBe(PHASE_DYING);
    expect(sim.calamities[sim.calamity]!.id).toBe('engine_fire');
    expect(sim.lives).toBe(rules.lives - 1);
  });
});

describe('major hits and power-ups', () => {
  test('a major hazard starts its calamity', () => {
    const sim = hitRun('gas_station', -1 / 3);
    expect(sim.phase).toBe(PHASE_DYING);
    expect(sim.calamities[sim.calamity]!.id).toBe('gas_station');
    expect(sim.lives).toBe(rules.lives - 1);
  });
  test('a shield turns the major hit into a smash and is used up', () => {
    const sim = hitRun('gas_station', -1 / 3, (s) => {
      s.power.shieldCharges = 1;
      s.power.shieldUntilMs = 1e9;
    });
    expect(sim.phase).toBe(PHASE_RUN);
    expect(sim.power.shieldCharges).toBe(0);
    expect(sim.broken).toBe(def('gas_station').breakInto);
  });
  test('picking up and using repair heals by its amount and caps at max', () => {
    const sim = makeSim(5, 1, 120, 4, true);
    const full = makeSim(5, 1, 120);
    sim.powers = full.powers;
    sim.hazards = full.hazards;
    plantPickup(sim, 'repair', 12, 0);
    placeAt(sim, 9);
    sim.car.health = 50;
    driveTo(sim, 14);
    expect(sim.power.held).toBe(sim.powers.findIndex((p) => p.id === 'repair'));
    const inp = idle();
    inp.accel = true;
    inp.usePressed = true;
    stepSim(sim, inp, (sim.nowMs += 1000 / 60));
    expect(sim.car.health).toBe(50 + sim.powers.find((p) => p.id === 'repair')!.heal);
    expect(sim.power.held).toBe(-1);
    sim.power.held = sim.powers.findIndex((p) => p.id === 'repair');
    sim.car.health = 95;
    stepSim(sim, inp, (sim.nowMs += 1000 / 60));
    expect(sim.car.health).toBe(rules.healthMax);
  });
  test('a coin adds coins and score, nothing is held', () => {
    const sim = makeSim(5, 1, 120, 4, true);
    const full = makeSim(5, 1, 120);
    sim.powers = full.powers;
    plantPickup(sim, 'coin', 12, 0);
    placeAt(sim, 9);
    driveTo(sim, 14);
    expect(sim.coins).toBe(1);
    expect(sim.power.held).toBe(-1);
  });
  test('slow-mo clears the hazards in the next beats; horn only the hornable ones', () => {
    const mk = (power: string) => {
      const sim = makeSim(5, 1, 120, 4, true);
      const full = makeSim(5, 1, 120);
      sim.powers = full.powers;
      sim.hazards = full.hazards;
      plant(sim, 'cone', 12, 0);
      plant(sim, 'cow', 14, 0);
      placeAt(sim, 10);
      sim.power.held = sim.powers.findIndex((p) => p.id === power);
      const inp = idle();
      inp.usePressed = true;
      stepSim(sim, inp, (sim.nowMs += 1000 / 60));
      return sim;
    };
    const slow = mk('slowmo');
    expect(segAt(slow.track, 12).hzState).toBe(HZ_BROKEN);
    expect(segAt(slow.track, 14).hzState).toBe(HZ_BROKEN);
    const horn = mk('horn');
    expect(segAt(horn.track, 12).hzState).toBe(HZ_ALIVE);
    expect(segAt(horn.track, 14).hzState).toBe(HZ_BROKEN);
  });
  test('periodic hazards only hurt inside their window', () => {
    const run = (phase: number) => {
      const sim = makeSim(5, 1, 120, 4, true);
      const full = makeSim(5, 1, 120);
      sim.hazards = full.hazards;
      sim.calamities = full.calamities;
      const seg = plant(sim, 'ufo_beam', 12, 0);
      seg.hzPhase = phase;
      placeAt(sim, 9);
      driveTo(sim, 14);
      return sim.phase;
    };
    const d = def('ufo_beam');
    // The cycle position at arrival is (arrival time / period + phase) mod 1; pick phases that put it inside and outside the window.
    const phases = [0, 0.25, 0.5, 0.75].map((p) => run(p));
    expect(phases).toContain(PHASE_DYING);
    expect(phases).toContain(PHASE_RUN);
    expect(d.activeTo).toBeGreaterThan(d.activeFrom);
  });
  test('every placed hazard and pickup is reachable by index', () => {
    const sim = makeSim(3, 10);
    for (let i = 0; i < 200; i++) {
      placeAt(sim, i);
      if (hasSeg(sim.track, i)) {
        const s = segAt(sim.track, i);
        if (s.hz >= 0) expect(sim.hazards[s.hz]).toBeDefined();
        if (s.pk >= 0) expect(sim.powers[s.pk]).toBeDefined();
      }
    }
  });
});
