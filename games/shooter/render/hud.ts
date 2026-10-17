// Heads-up display and the end-of-room overlays.
import type { CoreContext } from '../../../src/core/api';
import { clearBonus } from '../logic/score';
import type { World } from '../logic/types';

export function drawHud(ctx: CoreContext, w: World): void {
  const g = ctx.gfx;
  const p = w.player;
  g.rect(4, 4, 62, 8, 2);
  g.rect(5, 5, Math.round((60 * p.hp) / p.maxHp), 6, p.hp / p.maxHp > 0.3 ? 10 : 9);
  g.frame(4, 4, 62, 8, 7);
  g.drawText(ctx.strings('hud_hp'), 70, 5, { colour: 6 });
  g.drawText(ctx.strings('hud_score', { n: w.score }), 380, 5, { align: 'right', colour: 7, shadow: 1 });
  g.drawText(ctx.strings('hud_flares', { n: p.flares }), 4, 206, { colour: 18, shadow: 1 });
  if (w.status === 'dead') {
    g.drawText(ctx.strings('dead_title'), 192, 90, { scale: 2, align: 'center', colour: 10, shadow: 1 });
    g.drawText(ctx.strings('dead_hint'), 192, 112, { align: 'center', colour: 6 });
  } else if (w.status === 'cleared') {
    g.drawText(ctx.strings('clear_title'), 192, 90, { scale: 2, align: 'center', colour: 22, shadow: 1 });
    g.drawText(ctx.strings('clear_score', { n: w.score, b: clearBonus(w) }), 192, 112, { align: 'center', colour: 7 });
    g.drawText(ctx.strings('clear_hint'), 192, 126, { align: 'center', colour: 6 });
  }
}
