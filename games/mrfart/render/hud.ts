// HUD: fart meter at the bottom (wobbles near full) and first-seconds hints.
import type { Gfx2d } from '../../../src/core/api';
import { SCREEN_H } from '../../../src/core/api';
import type { Sim } from '../logic/sim';

export function drawHud(g: Gfx2d, sim: Sim, text: (key: string) => string): void {
  const m = sim.deps.rules.meter;
  const frac = Math.min(1, sim.meters.fart / m.max);
  const wob = frac > 0.85 ? Math.sin(sim.now / 40) * (frac - 0.85) * 12 : 0;
  const x = 40, y = SCREEN_H - 14 + wob, w = 120;
  g.drawText(text('meter'), 8, y + 1, { colour: 7, shadow: 2 });
  g.rect(x - 1, y - 1, w + 2, 9, 2);
  g.rect(x, y, w * frac, 7, frac < 0.4 ? 22 : frac < 0.7 ? 18 : 10);
  g.frame(x - 1, y - 1, w + 2, 9, 7);
  if (sim.now < 8000) {
    g.drawText(text('hint_move'), 8, 8, { colour: 7, shadow: 2 });
    g.drawText(text('hint_run'), 8, 18, { colour: 7, shadow: 2 });
  }
}
