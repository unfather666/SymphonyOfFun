// Darkness mask: ambient black, lights punched out. Reads the world, never changes it.
import type { Gfx2d } from '../../../src/core/api';
import { T_LAMP } from '../logic/tiles';
import type { World } from '../logic/types';
import { VIEW_H, VIEW_W, type Cam } from './camera';

const MAX_LIGHTS = 40;

export interface LightFrame {
  /** Interpolated player position in world px. */
  px: number;
  py: number;
  alpha: number;
}

/** Is a world point lit by the lantern, a flare or the spotlight? (Hidden enemies only show when lit.) */
export function litAt(w: World, x: number, y: number): boolean {
  const r = w.rules;
  const p = w.player;
  const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
  if (w.light.spotOn && (x - w.light.spotX) ** 2 + (y - w.light.spotY) ** 2 < w.light.spotR ** 2) return true;
  if (w.now < p.flareUntil && d2 < 150 * 150) return true;
  if (d2 < r.lantern_glow_r ** 2) return true;
  if (w.light.spotOn || d2 > r.lantern_r ** 2) return false;
  const diff = Math.atan2(Math.sin(Math.atan2(y - p.y, x - p.x) - Math.atan2(p.aimY, p.aimX)), Math.cos(Math.atan2(y - p.y, x - p.x) - Math.atan2(p.aimY, p.aimX)));
  return Math.abs(diff) < (r.lantern_spread_deg * Math.PI) / 180;
}

export function drawLighting(g: Gfx2d, g2d: CanvasRenderingContext2D, w: World, cam: Cam, f: LightFrame, reduced: boolean, jitter: { x: number; y: number }): void {
  const ambient = w.light.strobeOn && !reduced ? Math.max(w.light.ambient, w.rules.ambient_blackout) : w.light.ambient;
  const r = w.rules;
  const m = g.mask;
  m.begin(ambient);
  const breathe = 1 + 0.15 * w.light.pulse;
  let used = 0;
  const sx = f.px - cam.x;
  const sy = f.py - cam.y;
  const ang = Math.atan2(w.player.aimY, w.player.aimX);
  if (w.light.spotOn) {
    m.light(w.light.spotX - cam.x, w.light.spotY - cam.y, w.light.spotR, 1);
    m.light(sx, sy, r.lantern_glow_r * 0.5, 0.8);
    used += 2;
  } else {
    m.cone(sx, sy, ang, (r.lantern_spread_deg * Math.PI) / 180, r.lantern_r * breathe, 1);
    m.light(sx, sy, r.lantern_glow_r * breathe, 1);
    used += 2;
  }
  if (w.now < w.player.flareUntil) {
    const left = (w.player.flareUntil - w.now) / r.flare_ms;
    m.light(sx, sy, 150, Math.min(1, left * 3));
    used++;
  }
  // Station lamps in view flicker a little.
  const x0 = Math.max(0, Math.floor(cam.x / 16));
  const y0 = Math.max(0, Math.floor(cam.y / 16));
  const x1 = Math.min(w.map.w - 1, Math.floor((cam.x + VIEW_W) / 16));
  const y1 = Math.min(w.map.h - 1, Math.floor((cam.y + VIEW_H) / 16));
  for (let ty = y0; ty <= y1 && used < MAX_LIGHTS; ty++)
    for (let tx = x0; tx <= x1 && used < MAX_LIGHTS; tx++)
      if (w.map.data[ty * w.map.w + tx] === T_LAMP) {
        const fl = 0.75 + 0.25 * Math.sin(w.now * 0.011 + tx * 7 + ty * 3) * Math.sin(w.now * 0.0037 + tx);
        m.light(tx * 16 + 8 - cam.x, ty * 16 + 8 - cam.y, 58, fl);
        used++;
      }
  // Glowing particles and bullets.
  const ps = w.particles.live;
  for (let i = 0; i < w.particles.n && used < MAX_LIGHTS; i++) {
    const p = ps[i]!;
    if (p.glow === 0) continue;
    const life = Math.min(1, (p.dieAt - w.now) / 200);
    m.light(p.x - cam.x, p.y - cam.y, 14 + p.size * 3, 0.9 * Math.max(0.2, life));
    used++;
  }
  const bs = w.bullets.live;
  for (let i = 0; i < w.bullets.n && used < MAX_LIGHTS; i++) {
    const b = bs[i]!;
    if (b.kind === 2) continue;
    m.light(b.x - cam.x, b.y - cam.y, b.owner === 0 ? 16 : 12, 0.6);
    used++;
  }
  if (jitter.x || jitter.y) g2d.save(), g2d.translate(jitter.x, jitter.y);
  m.end();
  if (jitter.x || jitter.y) g2d.restore();
}
