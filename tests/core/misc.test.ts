import { describe, expect, test } from 'vitest';
import { fitScale } from '../../src/core/display/display';
import { createLogger } from '../../src/core/dev/logger';
import { createReadout } from '../../src/core/dev/readout';
import { createFaultGuard } from '../../src/core/faults/guard';
import { defaultOptions, parseOptions } from '../../src/core/launcher/options';
import { firstPickable, moveCursor } from '../../src/core/ui/menuLogic';
import { wrapText } from '../../src/core/ui/ui';

describe('crash guard (rule 10)', () => {
  test('trips after 3 failed updates in a row', () => {
    const g = createFaultGuard(3);
    const bad = () => {
      throw new Error('boom');
    };
    g.run(bad);
    g.run(bad);
    expect(g.tripped()).toBe(false);
    expect(g.run(bad)).toBe(false);
    expect(g.tripped()).toBe(true);
    expect(g.lastError()).toBe('boom');
  });
  test('a good update resets the count', () => {
    const g = createFaultGuard(3);
    const bad = () => {
      throw new Error('x');
    };
    g.run(bad);
    g.run(bad);
    g.run(() => {});
    g.run(bad);
    g.run(bad);
    expect(g.tripped()).toBe(false);
  });
});

describe('logger', () => {
  test('warns once per key', () => {
    const out: string[] = [];
    const sink = { info: () => {}, warn: (m: string) => out.push(m), error: (m: string) => out.push(m) };
    const log = createLogger('t', sink);
    log.warn('k', 'one');
    log.warn('k', 'two');
    log.error('k', 'three');
    expect(out).toEqual(['[t] one', '[t] three']);
    expect(log.recent()).toEqual(['one', 'three']);
  });
});

describe('menu logic', () => {
  const items = [{ disabled: false }, { disabled: true }, { disabled: false }];
  test('skips disabled and wraps', () => {
    expect(moveCursor(items, 0, 1)).toBe(2);
    expect(moveCursor(items, 2, 1)).toBe(0);
    expect(moveCursor(items, 0, -1)).toBe(2);
    expect(moveCursor([{ disabled: true }], 0, 1)).toBe(-1);
    expect(firstPickable([{ disabled: true }, { disabled: false }])).toBe(1);
  });
  test('wraps text by words', () => {
    expect(wrapText('THE QUICK BROWN FOX', 10)).toEqual(['THE QUICK', 'BROWN FOX']);
    expect(wrapText('A\nB', 10)).toEqual(['A', 'B']);
  });
});

describe('display scale', () => {
  test('largest integer that fits, capped by the option', () => {
    expect(fitScale(1920, 1080, 0)).toBe(5);
    expect(fitScale(1920, 1080, 3)).toBe(3);
    expect(fitScale(1000, 1080, 0)).toBe(2);
    expect(fitScale(192, 108, 0)).toBe(0.5);
  });
});

describe('options', () => {
  test('parse falls back per field', () => {
    expect(parseOptions(null)).toEqual(defaultOptions());
    expect(parseOptions('{bad')).toEqual(defaultOptions());
    const o = parseOptions(JSON.stringify({ volume: 3, scale: 99, reducedFx: true }));
    expect(o.volume).toBe(3);
    expect(o.scale).toBe(0);
    expect(o.reducedFx).toBe(true);
  });
});

describe('dev readout', () => {
  test('averages step time over one second', () => {
    let t = 0;
    const r = createReadout(() => t);
    for (let i = 0; i < 60; i++) {
      r.stepStart();
      t += 2;
      r.stepEnd();
      t += 14.666;
      r.frame();
    }
    t = 1001;
    r.frame();
    expect(r.stats().stepAvg).toBe(2);
    expect(r.stats().stepWorst).toBe(2);
  });
});
