// Preallocated pools: pieces (broken prop bits, skip when full) and puffs (cosmetic, replace oldest when full).
import { solidAt } from './map';
import type { MapData } from './map';

export interface Pieces {
  max: number;
  count: number;
  skipped: number;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; rot: Float32Array; vr: Float32Array;
  until: Float64Array;
  colour: Uint8Array;
  alive: Uint8Array;
}

export function createPieces(max: number): Pieces {
  return {
    max, count: 0, skipped: 0,
    x: new Float32Array(max), y: new Float32Array(max), vx: new Float32Array(max), vy: new Float32Array(max),
    rot: new Float32Array(max), vr: new Float32Array(max), until: new Float64Array(max), colour: new Uint8Array(max), alive: new Uint8Array(max),
  };
}

/** Full policy: skip the spawn and count it. */
export function spawnPiece(p: Pieces, x: number, y: number, vx: number, vy: number, vr: number, colour: number, until: number): boolean {
  let i = 0;
  while (i < p.max && p.alive[i]) i++;
  if (i === p.max) {
    p.skipped++;
    return false;
  }
  p.x[i] = x; p.y[i] = y; p.vx[i] = vx; p.vy[i] = vy; p.rot[i] = 0; p.vr[i] = vr; p.until[i] = until; p.colour[i] = colour; p.alive[i] = 1;
  p.count++;
  return true;
}

const PIECE_DRAG = 4;
export function updatePieces(p: Pieces, now: number, dt: number, map: MapData): void {
  if (p.count === 0) return;
  const k = 1 / (1 + PIECE_DRAG * dt);
  for (let i = 0; i < p.max; i++) {
    if (!p.alive[i]) continue;
    if (now >= p.until[i]!) {
      p.alive[i] = 0;
      p.count--;
      continue;
    }
    p.vx[i] = p.vx[i]! * k;
    p.vy[i] = p.vy[i]! * k;
    const nx = p.x[i]! + p.vx[i]! * dt, ny = p.y[i]! + p.vy[i]! * dt;
    if (solidAt(map, nx, p.y[i]!)) p.vx[i] = -p.vx[i]! * 0.5;
    else p.x[i] = nx;
    if (solidAt(map, p.x[i]!, ny)) p.vy[i] = -p.vy[i]! * 0.5;
    else p.y[i] = ny;
    p.rot[i] = p.rot[i]! + p.vr[i]! * dt;
  }
}

export const PUFF = 0, RING = 1, NOTE = 2;

export interface Puffs {
  max: number;
  cursor: number;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array;
  t0: Float64Array; life: Float32Array; size: Float32Array;
  kind: Uint8Array;
}

export function createPuffs(max: number): Puffs {
  return {
    max, cursor: 0,
    x: new Float32Array(max), y: new Float32Array(max), vx: new Float32Array(max), vy: new Float32Array(max),
    t0: new Float64Array(max).fill(-1e9), life: new Float32Array(max), size: new Float32Array(max), kind: new Uint8Array(max),
  };
}

/** Full policy: replace the oldest (ring cursor). */
export function spawnPuff(p: Puffs, kind: number, x: number, y: number, vx: number, vy: number, now: number, life: number, size: number): void {
  const i = p.cursor;
  p.cursor = (p.cursor + 1) % p.max;
  p.x[i] = x; p.y[i] = y; p.vx[i] = vx; p.vy[i] = vy; p.t0[i] = now; p.life[i] = life; p.size[i] = size; p.kind[i] = kind;
}

export function updatePuffs(p: Puffs, now: number, dt: number): void {
  for (let i = 0; i < p.max; i++) {
    if (now - p.t0[i]! >= p.life[i]!) continue;
    p.x[i] = p.x[i]! + p.vx[i]! * dt;
    p.y[i] = p.y[i]! + p.vy[i]! * dt;
    if (p.kind[i] !== RING) {
      p.vx[i] = p.vx[i]! * 0.97;
      p.vy[i] = p.vy[i]! * 0.97;
    }
  }
}
