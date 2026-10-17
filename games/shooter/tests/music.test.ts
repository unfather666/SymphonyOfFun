// Proves madness warp drives the core sequencer rate (half speed on, 1 off, kept across song loads). Area: musicControl. 2026-10-17
import { describe, expect, test } from 'vitest';
import type { CoreContext, Song } from '../../../src/core/api';
import { createMusic } from '../musicControl';

function fake() {
  const calls: string[] = [];
  const ctx = {
    chip: {
      sequencer: {
        load: () => calls.push('load'),
        play: (bar: number) => calls.push(`play${bar}`),
        stop: () => calls.push('stop'),
        setRate: (r: number) => calls.push(`rate${r}`),
      },
    },
  } as unknown as CoreContext;
  return { ctx, calls };
}

const song = { id: 't', bpm: 100, sections: [] } as unknown as Song;

describe('music warp', () => {
  test('on drops the rate to 0.5, off restores 1, repeats are ignored', () => {
    const { ctx, calls } = fake();
    const m = createMusic(ctx);
    m.setWarped(false);
    m.setWarped(true);
    m.setWarped(true);
    m.setWarped(false);
    expect(calls).toEqual(['rate0.5', 'rate1']);
  });

  test('a new song keeps the current warp, since load resets the rate', () => {
    const { ctx, calls } = fake();
    const m = createMusic(ctx);
    m.setWarped(true);
    calls.length = 0;
    m.start(song);
    expect(calls).toEqual(['load', 'play0', 'rate0.5']);
  });
});
