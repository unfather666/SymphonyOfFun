// Small deterministic generators keyed by (seed, index), so a replay regenerates the same road. No core imports.

export interface Rand {
  s: number;
}

/** Integer mixer (murmur3 finaliser). */
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h | 0;
}

/** Hash up to three integers into one 32-bit integer. */
export function hash32(a: number, b: number, c = 0): number {
  return mix(mix(mix(a | 0) ^ Math.imul(b | 0, 0x9e3779b1)) ^ Math.imul(c | 0, 0x85ebca77));
}

export function newRand(): Rand {
  return { s: 0 };
}

/** Restart `r` at the stream for (a, b, c). */
export function seedRand(r: Rand, a: number, b: number, c = 0): Rand {
  r.s = hash32(a, b, c);
  return r;
}

/** Float in [0,1) (mulberry32). */
export function randFloat(r: Rand): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function randInt(r: Rand, min: number, max: number): number {
  return min + Math.floor(randFloat(r) * (max - min + 1));
}

export function randRange(r: Rand, min: number, max: number): number {
  return min + randFloat(r) * (max - min);
}

/** FNV-1a fold of a number (rounded to 1/1000) into a running hash. */
export function foldHash(h: number, v: number): number {
  const q = Math.round(v * 1000) | 0;
  h = Math.imul(h ^ (q & 0xff), 0x01000193);
  h = Math.imul(h ^ ((q >>> 8) & 0xff), 0x01000193);
  h = Math.imul(h ^ ((q >>> 16) & 0xff), 0x01000193);
  h = Math.imul(h ^ ((q >>> 24) & 0xff), 0x01000193);
  return h | 0;
}

export const HASH_START = 0x811c9dc5 | 0;
