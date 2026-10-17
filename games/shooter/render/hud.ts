// Heads-up display and the end-of-room overlays.
import type { CoreContext } from '../../../src/core/api';
import { clearBonus } from '../logic/score';
import { tierOf } from '../logic/madness';
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
  const tier = tierOf(w.madness, w.rules);
  g.rect(4, 14, 62, 5, 2);
  g.rect(5, 15, Math.round((60 * w.madness) / 100), 3, tier >= 4 ? 10 : tier >= 2 ? 31 : 30);
  g.frame(4, 14, 62, 5, 4);
  g.drawText(ctx.strings('hud_madness'), 70, 13, { colour: tier ? 30 : 4 });
  if (w.inv.phase === 1 && (w.stepNo >> 2) % 2 === 0) g.drawText(ctx.strings('hud_warn'), 192, 30, { align: 'center', colour: 10, scale: 2 });
  else if (w.inv.phase === 2) g.drawText(ctx.strings('hud_inverted'), 192, 30, { align: 'center', colour: 31 });
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
