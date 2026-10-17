// Proves the sim is deterministic per seed and sensitive to seed and input (racer M0, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { hashSim, stepSim } from '../logic/sim';
import { STEP_S, type DriveInput } from '../logic/types';
import { idle, makeSim } from './helpers';

function play(seed: number, steps: number, bias = 0): number {
  const sim = makeSim(seed, 1, 120);
  const inp: DriveInput = idle();
  for (let i = 0; i < steps; i++) {
    inp.accel = i % 7 !== 0;
    inp.accelPressed = i % 30 === 0;
    inp.steer = Math.sin((i + bias) / 25);
    inp.brake = i % 211 === 0;
    inp.jumpPressed = i % 97 === 0;
    stepSim(sim, inp, i * STEP_S * 1000);
  }
  return hashSim(sim);
}

describe('determinism', () => {
  test('same seed and inputs give the same hash after 3000 steps', () => {
    expect(play(7, 3000)).toBe(play(7, 3000));
  });
  test('a different seed gives a different hash', () => {
    expect(play(7, 3000)).not.toBe(play(8, 3000));
  });
  test('different input gives a different hash', () => {
    expect(play(7, 3000)).not.toBe(play(7, 3000, 5));
  });
});
