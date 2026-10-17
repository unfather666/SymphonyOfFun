// Heads-up display and the end-of-room overlays.
import type { CoreContext } from '../../../src/core/api';
import { clearBonus } from '../logic/score';
import type { World } from '../logic/types';
import type { HudRig } from '../progressControl';

const KIND_COLOUR = { core: 18, mod: 26, aux: 31 } as const;

function drawSlots(ctx: CoreContext, rig: HudRig): void {
  const g = ctx.gfx;
  const x0 = 192 - 3 * 14;
  for (let s = 0; s < rig.slots.length; s++) {
    const x = x0 + s * 14;
    const it = rig.slots[s];
    const open = s < rig.unlocked;
    g.rect(x, 200, 12, 12, open ? 2 : 1);
    g.frame(x, 200, 12, 12, open ? 5 : 3);
    if (it) g.rect(x + 3, 203, 6, 6, KIND_COLOUR[it.kind]);
    else if (!open) g.line(x + 3, 203, x + 8, 208, 3);
  }
  g.drawText(String(rig.active + 1), x0 - 8, 203, { colour: 6 });
}

export function drawHud(ctx: CoreContext, w: World, rig: HudRig): void {
  const g = ctx.gfx;
  const p = w.player;
  g.rect(4, 4, 62, 8, 2);
  g.rect(5, 5, Math.round((60 * p.hp) / p.maxHp), 6, p.hp / p.maxHp > 0.3 ? 10 : 9);
  g.frame(4, 4, 62, 8, 7);
  g.drawText(ctx.strings('hud_hp'), 70, 5, { colour: 6 });
  g.drawText(ctx.strings('hud_score', { n: w.score }), 380, 5, { align: 'right', colour: 7, shadow: 1 });
  g.drawText(ctx.strings('hud_flares', { n: p.flares }), 4, 206, { colour: 18, shadow: 1 });
  drawSlots(ctx, rig);
  if (w.status === 'dead') {
    g.drawText(ctx.strings('dead_title'), 192, 90, { scale: 2, align: 'center', colour: 10, shadow: 1 });
    g.drawText(ctx.strings('dead_hint'), 192, 112, { align: 'center', colour: 6 });
  } else if (w.status === 'cleared') {
    g.drawText(ctx.strings('clear_title'), 192, 90, { scale: 2, align: 'center', colour: 22, shadow: 1 });
    g.drawText(ctx.strings('clear_score', { n: w.score, b: clearBonus(w) }), 192, 112, { align: 'center', colour: 7 });
    g.drawText(ctx.strings('clear_hint'), 192, 126, { align: 'center', colour: 6 });
  }
}
