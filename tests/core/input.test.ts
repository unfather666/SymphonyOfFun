import { describe, expect, test } from 'vitest';
import { DEFAULT_KEYS, deadzone, keysFor, remapKey } from '../../src/core/input/bindings';
import { createInputState } from '../../src/core/input/state';
import { stickVector } from '../../src/core/input/touchLayout';

describe('input state', () => {
  test('press is true for exactly one step', () => {
    const i = createInputState();
    i.setRaw(0, 'a', true);
    i.latch();
    expect(i.pressed('a')).toBe(true);
    expect(i.held('a')).toBe(true);
    i.latch();
    expect(i.pressed('a')).toBe(false);
    expect(i.held('a')).toBe(true);
    i.setRaw(0, 'a', false);
    i.latch();
    expect(i.released('a')).toBe(true);
    expect(i.held('a')).toBe(false);
  });
  test('a tap between two steps still counts once', () => {
    const i = createInputState();
    i.setRaw(0, 'b', true);
    i.setRaw(0, 'b', false);
    i.latch();
    expect(i.pressed('b')).toBe(true);
    i.latch();
    expect(i.released('b')).toBe(true);
    expect(i.pressed('b')).toBe(false);
  });
  test('two sources holding the same action: held until both let go', () => {
    const i = createInputState();
    i.setRaw(0, 'up', true);
    i.setRaw(1, 'up', true);
    i.setRaw(0, 'up', false);
    i.latch();
    expect(i.held('up')).toBe(true);
  });
  test('move axis from d-pad is normalised', () => {
    const i = createInputState();
    i.setRaw(0, 'right', true);
    i.setRaw(0, 'down', true);
    i.latch();
    const m = i.axis('move');
    expect(m.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(m.y).toBeCloseTo(Math.SQRT1_2, 9);
  });
  test('pointer press latches for one step', () => {
    const i = createInputState();
    i.setPointer(10, 20, true);
    i.setPointer(10, 20, false);
    i.latch();
    expect(i.pointer()).toMatchObject({ x: 10, y: 20, pressed: true });
    i.latch();
    expect(i.pointer().pressed).toBe(false);
  });
  test('releaseAll clears raw state', () => {
    const i = createInputState();
    i.setRaw(2, 'x', true);
    i.releaseAll();
    i.latch();
    expect(i.held('x')).toBe(false);
  });
});

describe('bindings', () => {
  test('remap replaces the action key, keeps arrows', () => {
    const m = remapKey(DEFAULT_KEYS, 'up', 'KeyI');
    expect(keysFor(m, 'up').sort()).toEqual(['ArrowUp', 'KeyI']);
    expect(m.KeyW).toBeUndefined();
  });
  test('deadzone', () => {
    expect(deadzone(0.1)).toBe(0);
    expect(deadzone(1)).toBe(1);
    expect(deadzone(-0.6)).toBeCloseTo(-0.5, 9);
  });
  test('stick vector clamps to length 1', () => {
    expect(stickVector(0, 0, 48, 0)).toEqual({ x: 1, y: 0 });
    expect(stickVector(0, 0, 12, 0)).toEqual({ x: 0.5, y: 0 });
  });
});
