// A simple reference player for balance tests: walks room to room, aims at the nearest enemy, keeps its distance, dodges bullets and dashes. Not part of the game.
import { computeFlow } from '../logic/flow';
import { stepWorld, makeCommand } from '../logic/sim';
import { TILE, lineClear } from '../logic/tiles';
import type { Command, World } from '../logic/types';

export interface BotResult {
  status: string;
  seconds: number;
  hp: number;
  kills: number;
}

interface Nav {
  dist: Int16Array;
  queue: Int32Array;
  target: number;
}

function walkTo(w: World, nav: Nav, tx: number, ty: number, cmd: Command): void {
  const key = ty * w.map.w + tx;
  if (nav.target !== key) {
    computeFlow(w.map, tx, ty, nav.dist, nav.queue, 2000);
    nav.target = key;
  }
  const px = Math.floor(w.player.x / TILE);
  const py = Math.floor(w.player.y / TILE);
  let best = nav.dist[py * w.map.w + px]!;
  let bx = tx;
  let by = ty;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = px + dx;
    const ny = py + dy;
    if (nx < 0 || ny < 0 || nx >= w.map.w || ny >= w.map.h) continue;
    const d = nav.dist[ny * w.map.w + nx]!;
    if (d >= 0 && d < best) {
      best = d;
      bx = nx;
      by = ny;
    }
  }
  const gx = bx * TILE + TILE / 2 - w.player.x;
  const gy = by * TILE + TILE / 2 - w.player.y;
  const len = Math.hypot(gx, gy) || 1;
  cmd.mx = gx / len;
  cmd.my = gy / len;
}

export function botCommand(w: World, nav: Nav, cmd: Command, want: number): void {
  const p = w.player;
  let best = -1;
  let bd = Infinity;
  let boss = -1;
  for (let i = 0; i < w.enemies.n; i++) {
    const e = w.enemies.live[i]!;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
    if (e.def.boss) boss = i;
  }
  cmd.fire = false;
  cmd.dash = false;
  cmd.mx = cmd.my = 0;
  let sx = 0;
  let sy = 0;
  let danger = false;
  for (let i = 0; i < w.bullets.n; i++) {
    const b = w.bullets.live[i]!;
    if (b.owner !== 1) continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 56) {
      sx += (dx / d) * ((56 - d) / 56);
      sy += (dy / d) * ((56 - d) / 56);
      if (d < 14) danger = true;
    }
  }
  if (best < 0) {
    let target = -1;
    if (w.exitOpen && w.plan.exit) walkTo(w, nav, Math.floor(w.plan.exit.x / TILE), Math.floor(w.plan.exit.y / TILE), cmd);
    else {
      for (let i = 0; i < w.rooms.length && target < 0; i++) if (w.rooms[i]!.state !== 2) target = i;
      const r = w.plan.rooms[Math.max(0, target)]!;
      walkTo(w, nav, r.x + (r.w >> 1), r.y + (r.h >> 1), cmd);
    }
    return;
  }
  const e = w.enemies.live[bd < 80 * 80 || boss < 0 ? best : boss]!;
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  if (!lineClear(w.map, p.x, p.y, e.x, e.y)) {
    // Walls in the way: walk round to it.
    walkTo(w, nav, Math.floor(e.x / TILE), Math.floor(e.y / TILE), cmd);
    return;
  }
  cmd.ax = dx / d;
  cmd.ay = dy / d;
  cmd.fire = true;
  const radial = d < want - 12 ? -1 : d > want + 12 ? 1 : 0;
  const side = Math.sin(w.now * 0.0021) > 0 ? 1 : -1;
  let mx = (dx / d) * radial - (dy / d) * 0.7 * side + sx * 1.8;
  let my = (dy / d) * radial + (dx / d) * 0.7 * side + sy * 1.8;
  if (Math.sqrt(bd) < 26) {
    // Too close: back off, bending toward the room centre so a wall cannot pin the bot.
    const r = w.plan.rooms[Math.max(0, w.room)]!;
    const cx = (r.x + r.w / 2) * TILE - p.x;
    const cy = (r.y + r.h / 2) * TILE - p.y;
    const cl = Math.hypot(cx, cy) || 1;
    mx = -(dx / d) + (1.4 * cx) / cl;
    my = -(dy / d) + (1.4 * cy) / cl;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  cmd.mx = mx;
  cmd.my = my;
  if ((danger || Math.sqrt(bd) < 22) && w.now >= p.dashReadyAt && len > 0.1) cmd.dash = true;
}

export function runBot(w: World, maxSeconds: number, want = 90): BotResult {
  const cmd = makeCommand();
  const nav: Nav = { dist: new Int16Array(w.map.w * w.map.h), queue: new Int32Array(w.map.w * w.map.h), target: -1 };
  const steps = maxSeconds * 60;
  for (let i = 0; i < steps && w.status === 'play'; i++) {
    botCommand(w, nav, cmd, want);
    stepWorld(w, cmd, (w.stepNo + 1) * (1000 / 60));
  }
  return { status: w.status, seconds: Math.round(w.now / 100) / 10, hp: Math.round(w.player.hp), kills: w.kills };
}
