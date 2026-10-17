// Madness on screen. Everything here is drawing only; tiers 1, 2 and 5 are skipped in reduced-fx mode.
import type { CoreContext } from '../../../src/core/api';
import { hash32 } from '../logic/rng';
import { tierOf } from '../logic/madness';
import type { World } from '../logic/types';
import type { Cam } from './camera';
import { VIEW_H, VIEW_W } from './camera';

/** T1: the dark mask shivers by a pixel. */
export function maskJitter(w: World, out: { x: number; y: number }): void {
  const t = tierOf(w.madness, w.rules);
  out.x = 0;
  out.y = 0;
  if (t < 1) return;
  const h = hash32('jit', w.stepNo >> 2);
  out.x = (h & 3) - 1.5 > 0 ? 1 : (h & 3) === 0 ? -1 : 0;
  out.y = ((h >> 4) & 3) === 0 ? 1 : 0;
}

/** T3: hallucinated enemies and bullets. They never collide. */
export function drawGhosts(ctx: CoreContext, w: World, cam: Cam): void {
  if (w.ghosts.n === 0) return;
  const g = ctx.gfx;
  const c2 = ctx.display.ctx2d;
  const gs = w.ghosts.live;
  for (let i = 0; i < w.ghosts.n; i++) {
    const q = gs[i]!;
    const fade = Math.min(1, (q.dieAt - w.now) / 400);
    c2.globalAlpha = 0.55 * fade;
    if (q.kind === 0) g.drawSprite(w.defList[q.arg]?.sprite ?? 'cultist', (w.stepNo >> 4) & 1, q.x - cam.x - 8, q.y - cam.y - 8, q.vx < 0);
    else g.rect(q.x - cam.x - 1, q.y - cam.y - 1, 3, 3, 10);
    c2.globalAlpha = 1;
  }
}

/** T1 colour drift, T2 row tearing. Called after the scene, before the HUD. */
export function drawMadnessPost(ctx: CoreContext, w: World): void {
  const t = tierOf(w.madness, w.rules);
  if (t < 1) return;
  const c2 = ctx.display.ctx2d;
  const drift = 0.04 + 0.03 * Math.sin(w.stepNo * 0.03);
  c2.fillStyle = `rgba(${t >= 3 ? '160,30,120' : '90,40,170'},${drift})`;
  c2.fillRect(0, 0, VIEW_W, VIEW_H);
  if (t >= 2 && w.stepNo % 8 < 2) {
    const cv = c2.canvas;
    for (let k = 0; k < 3; k++) {
      const h = hash32('tear', w.stepNo >> 3, k);
      const y = (h % 26) * 8;
      const dx = ((h >> 8) % 7) - 3;
      c2.drawImage(cv, 0, y, VIEW_W, 8, dx, y, VIEW_W, 8);
    }
  }
}

/** T5: nearly black except a small circle round the player. */
export function drawTunnel(ctx: CoreContext, w: World, sx: number, sy: number): void {
  if (tierOf(w.madness, w.rules) < 5) return;
  const m = ctx.gfx.mask;
  m.begin(1 - w.rules.t5_brightness);
  m.light(sx, sy, w.rules.t5_radius, 1);
  m.end();
}
