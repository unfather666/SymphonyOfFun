// Proves the car sim math is exact: coast, brake, accel cap, steering, jump arc, gap and edge falls (racer M0/M1, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { stepSim } from '../logic/sim';
import { generateNext } from '../logic/track';
import { idle, makeSim, placeAt, rules } from './helpers';
import { STEP_S } from '../logic/types';

const run = (sim: ReturnType<typeof makeSim>, n: number, set: (i: ReturnType<typeof idle>, step: number) => void = () => {}) => {
  const inp = idle();
  for (let i = 0; i < n; i++) {
    inp.accelPressed = false;
    inp.jumpPressed = false;
    set(inp, i);
    stepSim(sim, inp, (sim.nowMs += STEP_S * 1000));
  }
};

/** First seed/index where `pick` finds a segment, scanning 400 beats of the desert theme. */
function findSeg(pick: (s: { gap: boolean; ramp: boolean; drop: boolean; index: number }, prev: { ramp: boolean } | null) => boolean): { seed: number; index: number } {
  for (let seed = 1; seed <= 40; seed++) {
    const t = makeSim(seed, 1, 120).track;
    let prev: { ramp: boolean } | null = null;
    for (let i = 0; i < 400; i++) {
      const s = generateNext(t);
      if (pick(s, prev)) return { seed, index: s.index };
      prev = { ramp: s.ramp };
    }
  }
  throw new Error('no segment found');
}

describe('speed', () => {
  test('coasting loses exactly coastDecel per second', () => {
    const sim = makeSim(1, 1, 120);
    run(sim, 60);
    expect(sim.car.speed).toBeCloseTo(sim.cruise - rules.coastDecel, 9);
  });
  test('brake adds brakeDecel on top of coasting', () => {
    const sim = makeSim(1, 1, 120);
    run(sim, 30, (i) => (i.brake = true));
    expect(sim.car.speed).toBeCloseTo(sim.cruise - (rules.coastDecel + rules.brakeDecel) * 0.5, 9);
  });
  test('holding accelerate settles exactly at max speed', () => {
    const sim = makeSim(1, 1, 120);
    run(sim, 900, (i) => (i.accel = true));
    expect(sim.car.speed).toBe(30);
  });
  test('arc distance is speed times time', () => {
    const sim = makeSim(1, 1, 120);
    sim.car.speed = sim.cruise;
    run(sim, 10, (i) => (i.accel = true));
    // accelerating from cruise: s must be at least cruise*t and at most max*t.
    expect(sim.car.s).toBeGreaterThan(sim.cruise * (10 / 60));
    expect(sim.car.s).toBeLessThan(30 * (10 / 60));
  });
});

describe('steering', () => {
  test('full right for half a second moves the lane by steerRate/2', () => {
    const sim = makeSim(1, 1, 120);
    run(sim, 30, (i) => (i.steer = 1));
    expect(sim.car.lane).toBeCloseTo(rules.steerRate * 0.5, 9);
  });
  test('braking tightens steering by brakeSteerBoost', () => {
    const sim = makeSim(1, 1, 120);
    run(sim, 30, (i) => ((i.steer = -1), (i.brake = true)));
    expect(sim.car.lane).toBeCloseTo(-rules.steerRate * rules.brakeSteerBoost * 0.5, 9);
  });
  test('lane stops at the hard limit', () => {
    const sim = makeSim(1, 1, 120);
    run(sim, 200, (i) => (i.steer = 1));
    expect(sim.car.lane).toBe(rules.laneHardLimit);
  });
});

describe('beat sync', () => {
  test('a press on the beat adds one stack of speed ceiling; off the beat adds none', () => {
    const sim = makeSim(1, 1, 120);
    sim.beat.edgeMs = 1000;
    sim.nowMs = 990;
    const inp = idle();
    inp.accelPressed = true;
    stepSim(sim, inp, 1010);
    expect(sim.car.syncStacks).toBe(1);
    expect(sim.syncedBeats).toBe(1);
    stepSim(sim, inp, 1250); // 250 ms from the edge, period 500: nearest edge is 250 away
    expect(sim.car.syncStacks).toBe(1);
  });
  test('stacks expire after a bar', () => {
    const sim = makeSim(1, 1, 120);
    sim.beat.edgeMs = 0;
    const inp = idle();
    inp.accelPressed = true;
    stepSim(sim, inp, 10);
    expect(sim.car.syncStacks).toBe(1);
    inp.accelPressed = false;
    stepSim(sim, inp, 10 + 4 * 500 + 20);
    expect(sim.car.syncStacks).toBe(0);
  });
});

describe('jump, gap and edge', () => {
  test('jump works on a ramp: peak height and landing time follow gravity', () => {
    const f = findSeg((s) => s.ramp && !s.gap);
    const sim = makeSim(f.seed, 1, 120);
    placeAt(sim, f.index);
    const inp = idle();
    inp.accel = true;
    inp.jumpPressed = true;
    stepSim(sim, inp, (sim.nowMs += STEP_S * 1000));
    expect(sim.car.airborne).toBe(true);
    inp.jumpPressed = false;
    let peak = 0;
    let steps = 1;
    while (sim.car.airborne && steps < 200) {
      stepSim(sim, inp, (sim.nowMs += STEP_S * 1000));
      peak = Math.max(peak, sim.car.h);
      steps++;
    }
    const hop = (2 * rules.jumpSpeed) / rules.gravity; // seconds
    expect(steps).toBeGreaterThanOrEqual(Math.floor(hop * 60) - 1);
    expect(steps).toBeLessThanOrEqual(Math.ceil(hop * 60) + 2);
    expect(peak).toBeGreaterThan((rules.jumpSpeed ** 2 / (2 * rules.gravity)) * 0.97);
    expect(peak).toBeLessThan((rules.jumpSpeed ** 2 / (2 * rules.gravity)) * 1.03);
  });
  test('jump does nothing off a ramp', () => {
    const f = findSeg((s) => !s.ramp && !s.gap && s.index > 10);
    const sim = makeSim(f.seed, 1, 120);
    placeAt(sim, f.index);
    const inp = idle();
    inp.jumpPressed = true;
    stepSim(sim, inp, (sim.nowMs += STEP_S * 1000));
    expect(sim.car.airborne).toBe(false);
    expect(sim.car.h).toBe(0);
  });
  test('driving into a gap on the ground is a fall; jumping over it is not', () => {
    const f = findSeg((s, prev) => s.gap && prev !== null && prev.ramp);
    const grounded = makeSim(f.seed, 1, 120);
    placeAt(grounded, f.index - 1);
    run(grounded, 60, (i) => (i.accel = true));
    expect(grounded.deaths).toBe(1);

    const jumper = makeSim(f.seed, 1, 120);
    placeAt(jumper, f.index - 1);
    run(jumper, 70, (i, n) => {
      i.accel = true;
      i.jumpPressed = n === 0;
    });
    expect(jumper.deaths).toBe(0);
  });
  test('leaving a narrow bridge is a fall; staying on is not', () => {
    const f = findSeg((s) => s.drop && s.index > 10);
    const stay = makeSim(f.seed, 1, 120);
    placeAt(stay, f.index);
    run(stay, 20, (i) => (i.accel = true));
    expect(stay.deaths).toBe(0);
    const leave = makeSim(f.seed, 1, 120);
    placeAt(leave, f.index);
    leave.car.lane = 0.9;
    run(leave, 20, (i) => ((i.accel = true), (i.steer = 1)));
    expect(leave.deaths).toBe(1);
  });
});

describe('landing room', () => {
  test('hopBeats grows with a hop that lasts longer and shrinks with a longer segment', async () => {
    const { hopBeats } = await import('../logic/level');
    const { levels } = await import('./helpers');
    const l = levels[0]!;
    expect(hopBeats(l, rules, 1, 12)).toBe(Math.ceil(((2 * 15) / 22) * 30 * 1.2 / 12) + 2);
    expect(hopBeats(l, rules, 0.4, 12)).toBeGreaterThan(hopBeats(l, rules, 1, 12));
    expect(hopBeats(l, rules, 1, 24)).toBeLessThan(hopBeats(l, rules, 1, 12));
  });
});
