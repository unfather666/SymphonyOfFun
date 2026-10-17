// Damage, death, hit effects and player harm. Everything that changes hp goes through here.
import { CUE } from './cues';
import { HIT_BLIND, HIT_BURN, HIT_CHAIN, HIT_FREEZE, HIT_PULL, KILL_AMMO, KILL_HEAL } from './effects';
import { gridQuery } from './grid';
import { cue, dropPickup, spark, spawnEnemy } from './world';
import type { Enemy, World } from './types';
import { awardKill } from './score';

export function hurtPlayer(w: World, dmg: number): void {
  const p = w.player;
  if (w.status !== 'play' || w.now < p.iUntil) return;
  p.hp -= dmg;
  p.iUntil = w.now + w.rules.iframe_ms;
  cue(w, CUE.hurt);
  spark(w, p.x, p.y, 6, 10, 0);
  if (p.hp <= 0) {
    p.hp = 0;
    w.status = 'dead';
    cue(w, CUE.dead);
  }
}

export function damageEnemy(w: World, e: Enemy, dmg: number, killMask: number): void {
  if (!e.alive) return;
  e.hp -= dmg;
  e.hurtAt = w.now;
  if (e.hp <= 0) killEnemy(w, e, killMask);
}

export function killEnemy(w: World, e: Enemy, killMask: number): void {
  const def = e.def;
  awardKill(w, def.score, def.tier);
  w.kills++;
  cue(w, CUE.kill);
  spark(w, e.x, e.y, e.elite ? 14 : 8, e.elite ? 18 : 22, 1);
  if (killMask & KILL_HEAL) w.player.hp = Math.min(w.player.maxHp, w.player.hp + w.rules.heal_on_kill);
  if (killMask & KILL_AMMO) w.player.overdriveUntil = w.now + w.rules.overdrive_ms;
  if (def.splitInto) splitEnemy(w, e);
  if (e.elite && w.dropItems.length > 0) dropPickup(w, e.x, e.y, 0, w.dropItems[Math.floor(w.rng.float() * w.dropItems.length)]!);
  else if (w.rng.chance(0.08)) dropPickup(w, e.x, e.y, w.rng.chance(0.3) ? 2 : 1, 0);
  w.enemies.release(e);
}

/** Spawn the def's children around this enemy (built-in 'split' behaviour, also run on death). */
export function splitEnemy(w: World, e: Enemy): void {
  const def = e.def;
  const n = def.splitCount ?? 0;
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + e.phase;
    spawnEnemy(w, def.splitInto!, e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, false, e.room);
  }
}

/** Apply a bullet's on-hit effects to the enemy it hit. dirX/dirY is the bullet's travel direction (unit). */
export function applyHitEffects(w: World, e: Enemy, hitMask: number, dirX: number, dirY: number, dmg: number, killMask: number): void {
  const r = w.rules;
  if (hitMask & HIT_BURN) e.burnUntil = w.now + r.burn_ms;
  if (hitMask & HIT_FREEZE) e.slowUntil = w.now + r.freeze_ms;
  if (hitMask & HIT_BLIND) e.blindUntil = w.now + r.blind_ms;
  if (hitMask & HIT_PULL) {
    const dx = w.player.x - e.x;
    const dy = w.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.kx += (dx / d) * r.pull_speed;
    e.ky += (dy / d) * r.pull_speed;
  }
  if (hitMask & HIT_CHAIN) chainTo(w, e, dmg * r.chain_mul, killMask);
  void dirX;
  void dirY;
}

function chainTo(w: World, from: Enemy, dmg: number, killMask: number): void {
  const range = w.rules.chain_range;
  const n = gridQuery(w.grid, from.x, from.y, range, w.scratch);
  let best: Enemy | null = null;
  let bd = range * range;
  for (let i = 0; i < n; i++) {
    const o = w.enemies.slots[w.scratch[i]!]!;
    if (!o.alive || o === from) continue;
    const d = (o.x - from.x) ** 2 + (o.y - from.y) ** 2;
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (best) {
    spark(w, best.x, best.y, 3, 26, 1);
    damageEnemy(w, best, dmg, killMask);
  }
}

/** Shell splash: damage every enemy within r of (x, y). */
export function splash(w: World, x: number, y: number, r: number, dmg: number, killMask: number): void {
  const n = gridQuery(w.grid, x, y, r + 24, w.scratch);
  // Collect first: damaging can release enemies, and scratch is reused by chain effects.
  const ids = w.scratch;
  for (let i = 0; i < n; i++) {
    const e = w.enemies.slots[ids[i]!]!;
    if (!e.alive) continue;
    const rr = r + e.def.size;
    if ((e.x - x) ** 2 + (e.y - y) ** 2 <= rr * rr) damageEnemy(w, e, dmg, killMask);
  }
  spark(w, x, y, 10, 14, 1);
}
