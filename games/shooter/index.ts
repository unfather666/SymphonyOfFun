// Stub from S0: the shooter game thread replaces this file's body (keep the default export).
import type { CoreContext, GameInstance, GameModule } from '../../src/core/api';

function create(ctx: CoreContext): GameInstance {
  let lastBeat = -1000;
  let unsub = () => {};
  return {
    init() {
      unsub = ctx.events.on('chip:beat', (p) => {
        if (p.step16 === 0) lastBeat = ctx.clock.nowMs();
      });
      ctx.chip.sequencer.load(ctx.chip.demoSong);
      ctx.chip.sequencer.play();
    },
    update() {
      if (ctx.input.pressed('a')) ctx.chip.sfx('pickup');
    },
    draw() {
      const g = ctx.gfx;
      g.clear(2);
      const pulse = Math.max(0, 1 - (ctx.clock.nowMs() - lastBeat) / 300);
      g.rect(192 - 30 - pulse * 6, 140 - pulse * 6, 60 + pulse * 12, 4 + pulse * 12, 26);
      g.drawText(ctx.strings('title'), 192, 70, { scale: 2, colour: 18, shadow: 9, align: 'center' });
      g.drawText(ctx.strings('coming_soon'), 192, 100, { colour: 6, align: 'center' });
      g.drawText(ctx.strings('back_hint'), 192, 180, { colour: 4, align: 'center' });
    },
    pause() {},
    shutdown() {
      unsub();
    },
  };
}

const mod: GameModule = {
  id: 'shooter',
  title: 'Deep Signal',
  blurb: 'Coming soon. Lantern-lit sci-fi shooter in a drowned station',
  touch: { aim: true },
  create,
};
export default mod;
