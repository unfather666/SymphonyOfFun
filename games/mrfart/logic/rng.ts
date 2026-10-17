// Local seeded stream with the same shape as core's SeededStream, so logic and tests need no core import.
export interface Rng {
  float(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(list: readonly T[]): T;
  getState(): number;
  setState(state: number): void;
}

/** mulberry32. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const float = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    float,
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    range: (min, max) => min + float() * (max - min),
    chance: (p) => float() < p,
    pick: (list) => list[Math.floor(float() * list.length)]!,
    getState: () => s,
    setState: (v) => {
      s = v >>> 0;
    },
  };
}
