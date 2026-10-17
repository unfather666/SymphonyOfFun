// Music: one song per tier plus a boss song. Madness 2+ drags playback to half speed (tape-style, pitch follows) through the core sequencer rate.
import type { CoreContext, Song } from '../../src/core/api';

const WARP_RATE = 0.5;

export interface Music {
  start(song: Song | undefined): void;
  setWarped(on: boolean): void;
  stop(): void;
  dispose(): void;
}

export function createMusic(ctx: CoreContext): Music {
  let warped = false;
  return {
    start(song) {
      if (!song) return;
      ctx.chip.sequencer.load(song);
      ctx.chip.sequencer.play(0);
      ctx.chip.sequencer.setRate(warped ? WARP_RATE : 1);
    },
    setWarped(on) {
      if (on === warped) return;
      warped = on;
      ctx.chip.sequencer.setRate(on ? WARP_RATE : 1);
    },
    stop() {
      ctx.chip.sequencer.stop();
    },
    dispose() {},
  };
}
