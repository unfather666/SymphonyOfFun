// Music: one song per tier plus a boss song. Each song has a normal half (bars 0-7) and a warped half (bars 8-15, same tune a semitone off).
// Madness 2+ swings playback into the warped half at bar boundaries. (A real sequencer detune would be nicer: see README Core asks.)
import type { CoreContext, Song } from '../../src/core/api';

const HALF = 8;

export interface Music {
  start(song: Song | undefined): void;
  setWarped(on: boolean): void;
  stop(): void;
  dispose(): void;
}

export function createMusic(ctx: CoreContext): Music {
  let warped = false;
  let active = false;
  const off = ctx.events.on('chip:beat', (p) => {
    if (!active || p.step16 !== 0) return;
    const bar = p.bar as number;
    const half = bar >= HALF ? 1 : 0;
    const want = warped ? 1 : 0;
    if (half !== want) ctx.chip.sequencer.seekBar((bar % HALF) + want * HALF);
  });
  return {
    start(song) {
      if (!song) return;
      ctx.chip.sequencer.load(song);
      ctx.chip.sequencer.play(warped ? HALF : 0);
      active = true;
    },
    setWarped(on) {
      warped = on;
    },
    stop() {
      active = false;
      ctx.chip.sequencer.stop();
    },
    dispose() {
      active = false;
      off();
    },
  };
}
