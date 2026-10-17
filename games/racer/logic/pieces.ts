// Pool of flying pieces (also used for smoke). Struct of arrays, swap-remove on expiry, no allocation after createPool.
// Full policy: skip the new piece and count it.
import { randFloat, type Rand } from './rng';

export interface Pool {
  cap: number;
  n: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  rot: Float32Array;
  vr: Float32Array;
  size: Float32Array;
  floor: Float32Array;
  col: Uint8Array;
  expire: Float64Array;
  gravity: number;
  skipped: number;
  spawned: number;
}

export function createPool(cap: number, gravity: number): Pool {
  const f = () => new Float32Array(cap);
  return { cap, n: 0, x: f(), y: f(), z: f(), vx: f(), vy: f(), vz: f(), rot: f(), vr: f(), size: f(), floor: f(), col: new Uint8Array(cap), expire: new Float64Array(cap), gravity, skipped: 0, spawned: 0 };
}

export function clearPool(p: Pool): void {
  p.n = 0;
}

export function spawnPiece(p: Pool, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, col: number, nowMs: number, lifeMs: number, floorY: number): boolean {
  if (p.n >= p.cap) {
    p.skipped++;
    return false;
  }
  const i = p.n++;
  p.x[i] = x;
  p.y[i] = y;
  p.z[i] = z;
  p.vx[i] = vx;
  p.vy[i] = vy;
  p.vz[i] = vz;
  p.rot[i] = 0;
  p.vr[i] = 0;
  p.size[i] = size;
  p.col[i] = col;
  p.expire[i] = nowMs + lifeMs;
  p.floor[i] = floorY;
  p.spawned++;
  return true;
}

function remove(p: Pool, i: number): void {
  const last = --p.n;
  if (i === last) return;
  p.x[i] = p.x[last]!;
  p.y[i] = p.y[last]!;
  p.z[i] = p.z[last]!;
  p.vx[i] = p.vx[last]!;
  p.vy[i] = p.vy[last]!;
  p.vz[i] = p.vz[last]!;
  p.rot[i] = p.rot[last]!;
  p.vr[i] = p.vr[last]!;
  p.size[i] = p.size[last]!;
  p.floor[i] = p.floor[last]!;
  p.col[i] = p.col[last]!;
  p.expire[i] = p.expire[last]!;
}

/** Gravity, bounce on the floor, expire on the game clock. */
export function stepPool(p: Pool, nowMs: number, dt: number): void {
  for (let i = p.n - 1; i >= 0; i--) {
    if (nowMs >= p.expire[i]!) {
      remove(p, i);
      continue;
    }
    p.vy[i] = p.vy[i]! - p.gravity * dt;
    p.x[i] = p.x[i]! + p.vx[i]! * dt;
    p.y[i] = p.y[i]! + p.vy[i]! * dt;
    p.z[i] = p.z[i]! + p.vz[i]! * dt;
    p.rot[i] = p.rot[i]! + p.vr[i]! * dt;
    if (p.gravity > 0 && p.y[i]! < p.floor[i]!) {
      p.y[i] = p.floor[i]!;
      p.vy[i] = Math.abs(p.vy[i]!) > 2 ? -p.vy[i]! * 0.35 : 0;
      p.vx[i] = p.vx[i]! * 0.8;
      p.vz[i] = p.vz[i]! * 0.8;
      p.vr[i] = p.vr[i]! * 0.8;
    }
  }
}

/** `n` pieces from one point, thrown in all directions. Returns how many were taken. */
export function burst(p: Pool, r: Rand, n: number, x: number, y: number, z: number, speed: number, up: number, size: number, col: number, nowMs: number, lifeMs: number, floorY: number): number {
  let taken = 0;
  for (let k = 0; k < n; k++) {
    const a = randFloat(r) * Math.PI * 2;
    const s = speed * (0.4 + randFloat(r) * 0.6);
    const ok = spawnPiece(p, x, y, z, Math.cos(a) * s, up * (0.5 + randFloat(r)), Math.sin(a) * s, size * (0.6 + randFloat(r) * 0.8), col, nowMs, lifeMs * (0.7 + randFloat(r) * 0.3), floorY);
    if (!ok) break;
    p.vr[p.n - 1] = (randFloat(r) - 0.5) * 12;
    taken++;
  }
  return taken;
}
