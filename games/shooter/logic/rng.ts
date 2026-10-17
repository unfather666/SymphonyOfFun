// Seeded randomness for pure logic. In the game the sim is handed a core stream (same shape); tests and the level generator use these.
export interface Rng {
  float(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  chance(p: number): boolean;
}

export interface SeededRng extends Rng {
  getState(): number;
  setState(s: number): void;
}

/** FNV-1a over the parts joined by "|". Stable across runs and platforms. */
export function hash32(...parts: Array<string | number>): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): SeededRng {
  let a = seed >>> 0;
  const float = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    float,
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    range: (min, max) => min + float() * (max - min),
    chance: (p) => float() < p,
    getState: () => a,
    setState: (s) => {
      a = s >>> 0;
    },
  };
}
