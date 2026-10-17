import type { Random, SeededStream } from '../api';

/** One mulberry32 step: returns [0,1) and advances state. */
export function mulberry32Next(state: { s: number }): number {
  let t = (state.s = (state.s + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createStream(name: string, seed: number): SeededStream {
  const st = { s: seed | 0 };
  const float = () => mulberry32Next(st);
  return {
    name,
    seed,
    float,
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    range: (min, max) => min + float() * (max - min),
    chance: (p) => float() < p,
    pick<T>(list: readonly T[]): T {
      if (list.length === 0) throw new Error(`random.pick on empty list (stream "${name}")`);
      return list[Math.floor(float() * list.length)]!;
    },
    getState: () => st.s,
    setState(s) {
      st.s = s | 0;
    },
  };
}

export function createRandom(runSeed: number): Random {
  const streams = new Map<string, SeededStream>();
  return {
    runSeed,
    stream(name, seed) {
      const existing = streams.get(name);
      if (existing && seed === undefined) return existing;
      const s = createStream(name, seed ?? (hashString(name) ^ runSeed) >>> 0);
      streams.set(name, s);
      return s;
    },
  };
}
