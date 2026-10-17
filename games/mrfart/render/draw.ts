// Drawing only: reads the sim, never changes it. Placeholder rects until the M4 pixel art lands.
import type { Gfx2d, TileMap } from '../../../src/core/api';
import { SCREEN_H, SCREEN_W } from '../../../src/core/api';
import { PS_DWELL, PS_FLEE, PS_STARTLED } from '../logic/types';
import type { Sim } from '../logic/sim';
import { NOTE, RING } from '../logic/pools';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

export interface View {
  tiles: TileMap;
  camX: number;
  camY: number;
}

export function cameraFor(sim: Sim, alpha: number, view: View): void {
  const pl = sim.player;
  const x = lerp(pl.px, pl.x, alpha), y = lerp(pl.py, pl.y, alpha);
  const { pxW, pxH } = sim.deps.map;
  view.camX = pxW <= SCREEN_W ? (pxW - SCREEN_W) / 2 : Math.min(Math.max(x - SCREEN_W / 2, 0), pxW - SCREEN_W);
  view.camY = pxH <= SCREEN_H ? (pxH - SCREEN_H) / 2 : Math.min(Math.max(y - SCREEN_H / 2, 0), pxH - SCREEN_H);
}

export function drawWorld(g: Gfx2d, sim: Sim, view: View, alpha: number): void {
  g.clear(1);
  g.drawTiles('tiles', view.tiles, view.camX, view.camY);
  const cx = Math.round(view.camX), cy = Math.round(view.camY);

  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.broken) continue;
    const x = lerp(p.px, p.x, alpha) - cx, y = lerp(p.py, p.y, alpha) - cy;
    if (x < -24 || y < -24 || x > SCREEN_W + 24 || y > SCREEN_H + 24) continue;
    const w = p.knocked ? p.def.h : p.def.w, h = p.knocked ? p.def.w : p.def.h;
    g.rect(x - w / 2, y - h / 2, w, h, p.def.colour);
    g.frame(x - w / 2, y - h / 2, w, h, 2);
  }

  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    const x = lerp(p.px, p.x, alpha) - cx, y = lerp(p.py, p.y, alpha) - cy;
    if (x < -16 || y < -20 || x > SCREEN_W + 16 || y > SCREEN_H + 20) continue;
    g.rect(x - 4, y - 6, 8, 10, p.def.shirt);
    g.rect(x - 4, y - 12, 8, 7, p.def.skin);
    g.rect(x - 4, y - 13, 8, 3, p.def.hair);
    if (p.state === PS_DWELL) g.rect(x - 1, y + 4, 2, 1, 2);
    if (p.state === PS_STARTLED) g.drawText('!', x - 2, y - 23, { colour: 18, shadow: 2 });
    else if (p.state === PS_FLEE) g.drawText('!!', x - 5, y - 23, { colour: 10, shadow: 2 });
  }

  const pl = sim.player;
  const px = lerp(pl.px, pl.x, alpha) - cx, py = lerp(pl.py, pl.y, alpha) - cy;
  g.rect(px - 4, py - 6, 8, 10, 29);
  g.rect(px - 4, py - 13, 8, 8, 15);
  g.rect(px - 4, py - 14, 8, 3, 12);
  g.rect(px - 3 + (pl.facing === 3 ? 2 : pl.facing === 2 ? -2 : 0), py - 10, 2, 2, 2);

  const pc = sim.pieces;
  for (let i = 0; i < pc.max; i++) if (pc.alive[i]) g.rect(pc.x[i]! - cx - 1, pc.y[i]! - cy - 1, 3, 3, pc.colour[i]!);

  const pf = sim.puffs;
  for (let i = 0; i < pf.max; i++) {
    const age = sim.now - pf.t0[i]!;
    const life = pf.life[i]!;
    if (age < 0 || age >= life) continue;
    const t = age / life;
    const x = pf.x[i]! - cx, y = pf.y[i]! - cy;
    const kind = pf.kind[i]!;
    if (kind === RING) {
      const r = pf.size[i]! * t;
      for (let k = 0; k < 20; k++) g.rect(x + Math.cos((k / 20) * TAU) * r, y + Math.sin((k / 20) * TAU) * r, 2, 2, t < 0.5 ? 23 : 22);
    } else if (kind === NOTE) {
      g.rect(x, y, 2, 4, 18);
      g.rect(x + 2, y, 2, 2, 18);
    } else {
      const s = pf.size[i]! * (0.6 + t);
      g.rect(x - s / 2, y - s / 2, s, s, t < 0.6 ? 22 : 21);
    }
  }
}
