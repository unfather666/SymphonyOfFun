// Turns the sim's effect codes into sound and screen effects. The only place the sim's events touch core services.
import type { CoreContext, SfxRecipe } from '../../src/core/api';
import { FX_BOOM, FX_BREAK, FX_COIN, FX_FALL, FX_FINISH, FX_HIT, FX_JUMP, FX_OVER, FX_POWER, FX_RESPAWN, FX_USE } from './logic/fx';
import type { Sim } from './logic/simtypes';

const RECIPES: Record<string, SfxRecipe> = {
  racer_coin: { layers: [{ voice: 'pulseA', freq: 988, durMs: 50, volume: 0.25, duty: 0.25 }, { voice: 'pulseA', freq: 1319, delayMs: 50, durMs: 90, volume: 0.25, duty: 0.25 }] },
  racer_use: { layers: [{ voice: 'pulseB', freq: 330, freqEnd: 990, durMs: 220, volume: 0.28, duty: 0.5 }] },
  racer_fanfare: { layers: [{ voice: 'pulseA', freq: 523, durMs: 120, volume: 0.28, duty: 0.25 }, { voice: 'pulseA', freq: 659, delayMs: 120, durMs: 120, volume: 0.28, duty: 0.25 }, { voice: 'pulseA', freq: 784, delayMs: 240, durMs: 320, volume: 0.28, duty: 0.25 }] },
  racer_break: { layers: [{ voice: 'noise', freq: 1800, freqEnd: 600, durMs: 120, volume: 0.22 }] },
};

export function defineRacerSfx(ctx: CoreContext): void {
  for (const id of Object.keys(RECIPES)) ctx.chip.defineSfx(id, RECIPES[id]!);
}

/** Handle and clear everything the sim queued this step. */
export function playFx(ctx: CoreContext, sim: Sim): void {
  const q = sim.fx;
  for (let i = 0; i < q.n; i++) {
    const v = q.values[i]!;
    switch (q.codes[i]) {
      case FX_JUMP: ctx.chip.sfx('jump'); break;
      case FX_HIT: ctx.chip.sfx('hit'); ctx.gfx.shake(4, 160); break;
      case FX_BREAK: ctx.chip.sfx('racer_break'); break;
      case FX_COIN: ctx.chip.sfx('racer_coin'); break;
      case FX_POWER: ctx.chip.sfx('pickup'); break;
      case FX_USE: ctx.chip.sfx('racer_use'); break;
      case FX_BOOM:
      case FX_FALL: {
        const def = sim.calamities[v];
        if (def) {
          ctx.chip.sfx(ctx.chip.hasSfx(def.sfx) ? def.sfx : 'explode');
          ctx.gfx.shake(def.shake, 400);
          ctx.gfx.flash(def.flash, 260);
          ctx.gfx.fade(0.55, def.cinematicMs);
        }
        break;
      }
      case FX_RESPAWN: ctx.gfx.fade(0, 400); break;
      case FX_FINISH: ctx.chip.sfx('racer_fanfare'); break;
      case FX_OVER: ctx.chip.sfx('fail'); break;
      default: break;
    }
  }
  q.n = 0;
}
