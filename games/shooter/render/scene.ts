// Draws the world. Reads state only.
import type { CoreContext } from '../../../src/core/api';
import { KIND } from '../logic/effects';
import type { World } from '../logic/types';
import { cameraAt, type Cam } from './camera';
import { drawHud } from './hud';
import type { HudRig } from '../progressControl';
import { drawLighting, litAt } from './lighting';
import { drawGhosts, drawMadnessPost, drawTunnel, maskJitter } from './madnessFx';

const cam: Cam = { x: 0, y: 0 };
const jitter = { x: 0, y: 0 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function drawBullets(ctx: CoreContext, w: World): void {
  const g = ctx.gfx;
  const c2 = ctx.display.ctx2d;
  const bs = w.bullets.live;
  for (let i = 0; i < w.bullets.n; i++) {
    const b = bs[i]!;
    const x = b.x - cam.x;
    const y = b.y - cam.y;
    if (b.kind === KIND.arc) {
      const px = b.px - cam.x;
      const py = b.py - cam.y;
      const mx = (px + x) / 2 + Math.sin(w.stepNo * 1.7 + b.px) * 4;
      const my = (py + y) / 2 + Math.cos(w.stepNo * 2.3 + b.py) * 4;
      g.line(px, py, mx, my, 27);
      g.line(mx, my, x, y, 7);
    } else if (b.kind === KIND.beam) {
      g.line(b.px - cam.x - b.vx * 0.012, b.py - cam.y - b.vy * 0.012, x, y, 27);
    } else if (b.kind === KIND.wave) {
      c2.strokeStyle = g.colour(26);
      c2.lineWidth = 1;
      c2.beginPath();
      c2.arc(x, y, b.size, 0, Math.PI * 2);
      c2.stroke();
    } else {
      const s = Math.max(2, Math.round(b.size));
      g.rect(x - s / 2, y - s / 2, s, s, b.owner === 1 ? 10 : b.kind === KIND.shell ? 14 : 19);
    }
  }
}

export function drawScene(ctx: CoreContext, w: World, alpha: number, rig: HudRig): void {
  const g = ctx.gfx;
  const p = w.player;
  const ppx = lerp(p.px, p.x, alpha);
  const ppy = lerp(p.py, p.y, alpha);
  cameraAt(w, ppx, ppy, cam);

  g.clear(1);
  g.drawTiles('tiles', w.map, cam.x, cam.y);

  const ks = w.pickups.live;
  for (let i = 0; i < w.pickups.n; i++) {
    const k = ks[i]!;
    const bob = Math.sin(w.now * 0.006 + k.x) * 1.5;
    g.rect(k.x - cam.x - 3, k.y - cam.y - 3 + bob, 6, 6, k.kind === 0 ? 31 : k.kind === 1 ? 10 : 18);
    g.frame(k.x - cam.x - 4, k.y - cam.y - 4 + bob, 8, 8, 7);
  }

  const frame = (w.stepNo >> 4) & 1;
  const es = w.enemies.live;
  for (let i = 0; i < w.enemies.n; i++) {
    const e = es[i]!;
    const x = lerp(e.px, e.x, alpha) - cam.x;
    const y = lerp(e.py, e.y, alpha) - cam.y;
    if (e.def.hidden && !litAt(w, e.x, e.y)) continue;
    g.drawSprite(e.def.sprite, frame, x - 8, y - 8, e.vx < 0);
    if (e.def.turnDegS) g.line(x, y, x + Math.cos(e.heading) * 14, y + Math.sin(e.heading) * 14, 10);
    if (w.now - e.hurtAt < w.rules.hit_flash_ms) g.frame(x - 7, y - 7, 14, 14, 7);
    else if (e.elite) g.frame(x - 7, y - 7, 14, 14, 18);
  }

  if (!(w.now < p.iUntil && w.now >= p.dashUntil && (w.stepNo >> 2) & 1)) {
    const side = Math.abs(p.aimX) > Math.abs(p.aimY);
    const walking = ((p.walk >> 3) & 1) === 1;
    const f = side ? 4 + (walking ? 1 : 0) : (p.aimY < 0 ? 2 : 0) + (walking ? 1 : 0);
    g.drawSprite('player', f, ppx - cam.x - 8, ppy - cam.y - 8, side && p.aimX < 0);
  }
  g.rect(ppx - cam.x + p.aimX * 14 - 1, ppy - cam.y + p.aimY * 14 - 1, 2, 2, 18);

  drawBullets(ctx, w);
  const ps = w.particles.live;
  for (let i = 0; i < w.particles.n; i++) {
    const q = ps[i]!;
    g.rect(q.x - cam.x, q.y - cam.y, q.size, q.size, q.colour);
  }

  const reduced = ctx.settings.reducedFx;
  drawGhosts(ctx, w, cam);
  maskJitter(w, jitter);
  if (reduced) jitter.x = jitter.y = 0;
  drawLighting(g, ctx.display.ctx2d, w, cam, { px: ppx, py: ppy, alpha }, reduced, jitter);

  // Eyes glow through the dark.
  for (let i = 0; i < w.enemies.n; i++) {
    const e = es[i]!;
    const x = lerp(e.px, e.x, alpha) - cam.x;
    const y = lerp(e.py, e.y, alpha) - cam.y;
    if (e.def.hidden && !litAt(w, e.x, e.y)) continue;
    g.rect(x - 3, y - 4, 2, 2, 18);
    g.rect(x + 1, y - 4, 2, 2, 18);
  }
  if (!reduced) {
    drawMadnessPost(ctx, w);
    drawTunnel(ctx, w, ppx - cam.x, ppy - cam.y);
  }
  drawHud(ctx, w, rig);
}
