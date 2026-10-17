import { describe, expect, test } from 'vitest';
import { STEP_MS } from '../../src/core/api';
import { createClock } from '../../src/core/loop/clock';
import { createFixedLoop } from '../../src/core/loop/fixedLoop';

describe('clock', () => {
  test('time is steps times STEP_MS', () => {
    const c = createClock();
    for (let i = 0; i < 60; i++) c.advance();
    expect(c.step()).toBe(60);
    expect(c.nowMs()).toBeCloseTo(1000, 9);
    c.reset();
    expect(c.nowMs()).toBe(0);
  });
});

describe('fixed loop (rule 1: fixed 60 Hz, cap 5 steps per frame)', () => {
  test('runs whole steps and carries the remainder as alpha', () => {
    const l = createFixedLoop();
    const r = l.frame(STEP_MS * 2.5);
    expect(r.steps).toBe(2);
    expect(r.alpha).toBeCloseTo(0.5, 9);
    expect(l.frame(STEP_MS * 0.5).steps).toBe(1);
  });
  test('caps at 5 steps and drops the backlog', () => {
    const l = createFixedLoop();
    const r = l.frame(STEP_MS * 20);
    expect(r.steps).toBe(5);
    expect(r.dropped).toBe(15);
    expect(l.frame(0).steps).toBe(0);
  });
  test('ignores negative and non-finite frame times', () => {
    const l = createFixedLoop();
    expect(l.frame(-50).steps).toBe(0);
    expect(l.frame(Number.NaN).steps).toBe(0);
  });
});
