// Firing and moving bullets. All six projectile kinds are bullets in one pool; arcs are instant and leave a short-lived segment.
import { CUE } from './cues';
import { DT, TAU } from './consts';
import { applyHitEffects, damageEnemy, hurtPlayer, splash } from './combat';
import { ELEMENT_HIT, ELEMENTS, KIND, PROJECTILES } from './effects';
import { gridQuery } from './grid';
import { lineClear, T_FLOOR, T_GLASS, tileAt, TILE, isSolid } from './tiles';
import { cue, spark } from './world';
import type { Bullet, Enemy, Shot, World } from './types';

const CUE_OF_KIND = [CUE.shotBolt, CUE.shotBeam, CUE.shotArc, CUE.shotShell, CUE.shotWave, CUE.shotBolt];
const MAX_ENEMY_HALF = 28;
const visited = new Int32Array(16);

function acquire(w: World, owner: number, kind: number, x: number, y: number, ang: number, speed: number, dmg: number, lifeMs: number, size: number): Bullet | null {
  const b = w.bullets.acquire();
  if (!b) return null;
  b.owner = owner; b.kind = kind;
  b.x = b.px = x; b.y = b.py = y;
  b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
  b.dmg = dmg; b.dieAt = w.now + lifeMs; b.size = size; b.grow = 0;
  b.pierce = 0; b.bounce = 0; b.homing = 0; b.kb = 0; b.hitMask = 0; b.killMask = 0; b.elem = 0;
  b.h0 = b.h1 = b.h2 = b.h3 = -1;
  return b;
}

/** Fire the player's current shot from the muzzle along the aim. */
export function fireShot(w: World, shot: Shot, hitMask: number, killMask: number): void {
  const p = w.player;
  const base = Math.atan2(p.aimY, p.aimX);
  const ox = p.x + p.aimX * 8;
  const oy = p.y + p.aimY * 8;
  const kind = PROJECTILES.indexOf(shot.projectile);
  const elem = ELEMENTS.indexOf(shot.element);
  const mask = hitMask | ELEMENT_HIT[elem]!;
  const dirs = shot.dirs > 1 ? shot.dirs : 1;
  const per = shot.dirs > 1 ? 1 : shot.count;
  for (let d = 0; d < dirs; d++)
    for (let i = 0; i < per; i++) {
      let a = base + (dirs > 1 ? (d * TAU) / dirs : 0);
      if (per > 1) a += (i / (per - 1) - 0.5) * shot.spread;
      else if (shot.spread > 0) a += (w.rng.float() - 0.5) * shot.spread;
      if (kind === KIND.arc) {
        fireArc(w, ox, oy, a, shot, mask, killMask);
        continue;
      }
      const b = acquire(w, 0, kind, ox, oy, a, shot.speed, shot.damage, shot.lifeMs, shot.size);
      if (!b) continue;
      b.pierce = kind === KIND.beam || kind === KIND.wave ? 99 : shot.pierce;
      b.bounce = shot.bounce;
      b.homing = kind === KIND.drone ? Math.max(shot.homing, 0.6) : shot.homing;
      b.kb = shot.knockback;
      b.hitMask = mask;
      b.killMask = killMask;
      b.elem = elem;
      if (kind === KIND.wave) b.grow = shot.size * 4;
    }
  cue(w, CUE_OF_KIND[kind]!);
  const m = w.particles.acquire();
  if (m) {
    m.x = ox; m.y = oy; m.vx = m.vy = 0; m.dieAt = w.now + 34; m.colour = 19; m.size = 3; m.glow = 1;
  }
}

/** Instant lightning: nearest enemy inside the aim cone, then jumps to near neighbours (pierce = extra jumps). */
function fireArc(w: World, ox: number, oy: number, ang: number, shot: Shot, hitMask: number, killMask: number): void {
  const range = (shot.speed * shot.lifeMs) / 1000;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let x = ox;
  let y = oy;
  let jumps = shot.pierce + 1;
  let nVisited = 0;
  const r = w.rules;
  let reach = range;
  while (jumps-- > 0) {
    const n = gridQuery(w.grid, x, y, reach, w.scratch);
    let best: Enemy | null = null;
    let bd = reach * reach;
    for (let i = 0; i < n; i++) {
      const e = w.enemies.slots[w.scratch[i]!]!;
      if (!e.alive) continue;
      let again = false;
      for (let v = 0; v < nVisited; v++) if (visited[v] === e.slot) again = true;
      if (again) continue;
      const ex = e.x - x;
      const ey = e.y - y;
      const d2 = ex * ex + ey * ey;
      if (d2 >= bd) continue;
      if (nVisited === 0 && (ex * dx + ey * dy) / Math.sqrt(d2 || 1) < 0.8) continue;
      if (!lineClear(w.map, x, y, e.x, e.y)) continue;
      bd = d2;
      best = e;
    }
    const seg = acquire(w, 0, KIND.arc, x, y, 0, 0, 0, 110, 1);
    if (seg) {
      seg.vx = seg.vy = 0;
      seg.px = x;
      seg.py = y;
      seg.x = best ? best.x : x + dx * 24;
      seg.y = best ? best.y : y + dy * 24;
    }
    if (!best) break;
    x = best.x;
    y = best.y;
    if (nVisited < visited.length) visited[nVisited++] = best.slot;
    reach = r.chain_range * 1.5;
    const target = best;
    applyHitEffects(w, target, hitMask, dx, dy, shot.damage, killMask);
    damageEnemy(w, target, shot.damage, killMask);
    cue(w, CUE.hit);
  }
}

export function spawnEnemyBullet(w: World, x: number, y: number, ang: number, speed: number, dmg: number): void {
  const b = acquire(w, 1, KIND.bolt, x, y, ang, speed, dmg, w.rules.ebullet_life_ms, w.rules.ebullet_size);
  if (b) b.elem = 0;
}

function remember(b: Bullet, id: number): void {
  b.h3 = b.h2; b.h2 = b.h1; b.h1 = b.h0; b.h0 = id;
}
const seen = (b: Bullet, id: number) => b.h0 === id || b.h1 === id || b.h2 === id || b.h3 === id;

function endBullet(w: World, b: Bullet): void {
  if (b.kind === KIND.shell && b.owner === 0) splash(w, b.x, b.y, b.size * 5, b.dmg * 0.6, b.killMask);
  w.bullets.release(b);
}

function steer(w: World, b: Bullet): void {
  const n = gridQuery(w.grid, b.x, b.y, 120, w.scratch);
  let best: Enemy | null = null;
  let bd = 120 * 120;
  for (let i = 0; i < n; i++) {
    const e = w.enemies.slots[w.scratch[i]!]!;
    if (!e.alive) continue;
    const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (!best) return;
  const sp = Math.hypot(b.vx, b.vy);
  const cur = Math.atan2(b.vy, b.vx);
  let diff = Math.atan2(best.y - b.y, best.x - b.x) - cur;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const turn = Math.max(-b.homing * 6 * DT, Math.min(b.homing * 6 * DT, diff));
  b.vx = Math.cos(cur + turn) * sp;
  b.vy = Math.sin(cur + turn) * sp;
}

/** Returns true when the bullet is gone. */
function advance(w: World, b: Bullet): boolean {
  const dist = Math.hypot(b.vx, b.vy) * DT;
  const subs = Math.max(1, Math.ceil(dist / 6));
  const sx = (b.vx * DT) / subs;
  const sy = (b.vy * DT) / subs;
  const p = w.player;
  const ph = w.rules.player_half;
  for (let s = 0; s < subs; s++) {
    b.x += sx;
    b.y += sy;
    const tx = Math.floor(b.x / TILE);
    const ty = Math.floor(b.y / TILE);
    const t = tileAt(w.map, tx, ty);
    if (isSolid(t)) {
      if (t === T_GLASS && b.owner === 0) {
        w.map.data[ty * w.map.w + tx] = T_FLOOR;
        spark(w, tx * TILE + 8, ty * TILE + 8, 6, 27, 1);
        cue(w, CUE.hit);
      }
      if (b.bounce > 0 && t !== T_GLASS) {
        b.bounce--;
        if (isSolid(tileAt(w.map, Math.floor((b.x - sx) / TILE), ty))) b.vy = -b.vy;
        else b.vx = -b.vx;
        b.x -= sx; b.y -= sy;
        continue;
      }
      endBullet(w, b);
      return true;
    }
    if (b.owner === 1) {
      const rr = b.size + ph;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 <= rr * rr) {
        hurtPlayer(w, b.dmg);
        w.bullets.release(b);
        return true;
      }
      continue;
    }
    const n = gridQuery(w.grid, b.x, b.y, b.size + MAX_ENEMY_HALF, w.scratch);
    for (let i = 0; i < n; i++) {
      const id = w.scratch[i]!;
      const e = w.enemies.slots[id]!;
      if (!e.alive || seen(b, id)) continue;
      const rr = b.size + e.def.size;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
      remember(b, id);
      const len = Math.hypot(b.vx, b.vy) || 1;
      e.kx += (b.vx / len) * b.kb * 40;
      e.ky += (b.vy / len) * b.kb * 40;
      spark(w, b.x, b.y, 2, 19, 0);
      cue(w, CUE.hit);
      applyHitEffects(w, e, b.hitMask, b.vx / len, b.vy / len, b.dmg, b.killMask);
      damageEnemy(w, e, b.dmg, b.killMask);
      if (b.pierce-- <= 0) {
        endBullet(w, b);
        return true;
      }
      // Scratch was reused by effects: re-query is not needed, the pierced bullet continues next sub-step.
      break;
    }
  }
  return false;
}

export function updateBullets(w: World): void {
  const live = w.bullets.live;
  for (let i = w.bullets.n - 1; i >= 0; i--) {
    const b = live[i]!;
    if (w.now >= b.dieAt) {
      if (b.kind === KIND.arc) w.bullets.release(b);
      else endBullet(w, b);
      continue;
    }
    if (b.kind === KIND.arc) continue;
    b.px = b.x;
    b.py = b.y;
    if (b.grow > 0) b.size += b.grow * DT;
    if (b.homing > 0 && b.owner === 0) steer(w, b);
    advance(w, b);
  }
}
