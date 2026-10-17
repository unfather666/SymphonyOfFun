import { describe, expect, test } from 'vitest';
import { createEffects } from '../../src/core/gfx2d/effects';
import { GLYPH_DATA, glyphRows, textWidth } from '../../src/core/gfx2d/font';
import { DEFAULT_PALETTE, charToIndex } from '../../src/core/gfx2d/palette';
import { decodeSprite } from '../../src/core/gfx2d/sprites';

describe('font', () => {
  test('every glyph is 7 rows of 5', () => {
    for (const [ch, g] of Object.entries(GLYPH_DATA)) {
      const rows = g.split('|');
      expect(rows.length, ch).toBe(7);
      for (const r of rows) expect(r, ch).toMatch(/^[#.]{5}$/);
    }
  });
  test('covers A-Z, 0-9 and common punctuation', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?\'"-+=*/()[]<>%#_&@$') expect(GLYPH_DATA[ch], ch).toBeDefined();
  });
  test('lowercase maps to uppercase, unknown to ?', () => {
    expect(glyphRows('a')).toEqual(glyphRows('A'));
    expect(glyphRows('é')).toEqual(glyphRows('?'));
    expect(glyphRows('I')).toEqual([0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110]);
  });
  test('text width: 6 px advance minus the last gap, per longest line', () => {
    expect(textWidth('AB')).toBe(11);
    expect(textWidth('AB\nABCD', 2)).toBe(46);
    expect(textWidth('')).toBe(0);
  });
});

describe('palette and sprites', () => {
  test('32 colours, all #rrggbb', () => {
    expect(DEFAULT_PALETTE.length).toBe(32);
    for (const c of DEFAULT_PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
  test('sprite chars map to palette indices', () => {
    expect(charToIndex('.')).toBe(-1);
    expect(charToIndex('9')).toBe(9);
    expect(charToIndex('v')).toBe(31);
    const [f] = decodeSprite('s', { w: 2, h: 2, frames: [['1.', 'vx']], keys: { x: 5 } });
    expect(Array.from(f!)).toEqual([1, -1, 31, 5]);
  });
  test('bad sprites throw plain messages', () => {
    expect(() => decodeSprite('s', { w: 2, h: 1, frames: [['123']] })).toThrow('Sprite "s" frame 0 row 0: 3 chars, expected 2.');
    expect(() => decodeSprite('s', { w: 2, h: 2, frames: [['12']] })).toThrow('Sprite "s" frame 0: 1 rows, expected 2.');
  });
});

describe('effects on the game clock (rule 3: timestamps)', () => {
  test('shake decays to zero at its end time', () => {
    let t = 0;
    const fx = createEffects(() => t);
    fx.shake(4, 100);
    t = 100;
    expect(fx.offset()).toEqual({ x: 0, y: 0 });
  });
  test('a weaker shake does not cut a stronger one short', () => {
    let t = 0;
    const fx = createEffects(() => t);
    fx.shake(8, 1000);
    t = 10;
    fx.shake(1, 20);
    t = 500;
    const o = fx.offset();
    expect(Math.abs(o.x) + Math.abs(o.y)).toBeGreaterThan(0);
  });
  test('flash fades out linearly', () => {
    let t = 0;
    const fx = createEffects(() => t);
    fx.flash('#ffffff', 100);
    t = 25;
    expect(fx.flashState().alpha).toBeCloseTo(0.75, 9);
    t = 100;
    expect(fx.flashState().alpha).toBe(0);
  });
  test('fade goes from current level to target', () => {
    let t = 0;
    const fx = createEffects(() => t);
    fx.fade(1, 200);
    t = 100;
    expect(fx.fadeLevel()).toBeCloseTo(0.5, 9);
    t = 300;
    expect(fx.fadeLevel()).toBe(1);
    fx.fade(0, 100);
    t = 350;
    expect(fx.fadeLevel()).toBeCloseTo(0.5, 9);
  });
});
