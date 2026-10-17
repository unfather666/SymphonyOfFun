// Drawing only: reads the sim, never changes it. Placeholder rects until the M4 pixel art lands.
import type { Gfx2d, TileMap } from '../../../src/core/api';
import { SCREEN_H, SCREEN_W } from '../../../src/core/api';
import { FACE_RIGHT, PS_FLEE, PS_STARTLED, PS_WALK } from '../logic/types';
import { hourAt } from '../logic/clock';
import type { Sim } from '../logic/sim';
import { NOTE, RING } from '../logic/pools';
import { drawBoard, drawShops, drawSubjects, drawZone } from './jobs';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

export const PERSON_PREFIX = 'p_';
export const PLAYER_SPRITE = 'player';
/** Sheet order: down, up, side (facing left; right is mirrored), two walk frames each. */
export function personFrame(facing: number, walking: boolean, steps: number): number {
  const dir = facing === 0 ? 0 : facing === 1 ? 1 : 2;
  return dir * 2 + (walking && ((steps >> 3) & 1) === 1 ? 1 : 0);
}

/** Night darkness 0..1 from the in-game hour: dark 21:00 to 05:00, easing over an hour at each end. */
export function nightAlpha(hour: number): number {
  const h = hour % 24;
  if (h >= 22 || h < 5) return 0.5;
  if (h >= 21) return (h - 21) * 0.5;
  if (h < 6) return (6 - h) * 0.5;
  return 0;
}

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
    const size = Math.max(p.def.w, p.def.h);
    g.drawSprite(p.def.sprite, p.knocked ? 1 : 0, Math.round(x - size / 2), Math.round(y - size / 2));
  }

  drawBoard(g, sim, cx, cy);
  drawShops(g, sim, cx, cy);
  drawZone(g, sim, cx, cy);
  drawSubjects(g, sim, cx, cy, alpha);

  for (let i = 0; i < sim.people.length; i++) {
    const p = sim.people[i]!;
    const x = lerp(p.px, p.x, alpha) - cx, y = lerp(p.py, p.y, alpha) - cy;
    if (x < -16 || y < -20 || x > SCREEN_W + 16 || y > SCREEN_H + 20) continue;
    const walking = p.state === PS_WALK || p.state === PS_FLEE;
    g.drawSprite(`${PERSON_PREFIX}${p.idx}`, personFrame(p.facing, walking, sim.steps), Math.round(x - 8), Math.round(y - 13), p.facing === FACE_RIGHT);
    if (p.state === PS_STARTLED) g.drawText('!', x - 2, y - 23, { colour: 18, shadow: 2 });
    else if (p.state === PS_FLEE) g.drawText('!!', x - 5, y - 23, { colour: 10, shadow: 2 });
  }

  const pl = sim.player;
  const px = lerp(pl.px, pl.x, alpha) - cx, py = lerp(pl.py, pl.y, alpha) - cy;
  g.drawSprite(PLAYER_SPRITE, personFrame(pl.facing, pl.moved > 0.05, sim.steps), Math.round(px - 8), Math.round(py - 13), pl.facing === FACE_RIGHT);

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

  if (!sim.deps.reducedFx) {
    const a = nightAlpha(hourAt(sim.now, sim.deps.rules.world.dayMs, sim.deps.rules.world.startHour));
    if (a > 0.01) {
      g.mask.begin(a, '#0b0b2a');
      g.mask.light(px, py, 46, 0.9);
      g.mask.end();
    }
  }
}
