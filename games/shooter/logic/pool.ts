// Fixed-size object pool with a dense live list (iterate 0..n-1, or downwards when releasing).
// Full policy is chosen per pool: 'skip' returns null, 'replaceOldest' recycles the live item with the lowest `born`.
export interface PoolItem {
  alive: boolean;
  /** Position in the live list (managed by the pool). */
  idx: number;
  /** Stable slot id 0..cap-1 (managed by the pool). */
  slot: number;
  /** Order stamp for replaceOldest (set by the pool). */
  born: number;
}

export type FullPolicy = 'skip' | 'replaceOldest';

export interface Pool<T extends PoolItem> {
  readonly cap: number;
  readonly policy: FullPolicy;
  /** Live items are live[0..n-1]. */
  readonly live: T[];
  n: number;
  /** All items by slot id. */
  readonly slots: T[];
  acquire(): T | null;
  release(item: T): void;
  clear(): void;
  stats: { skipped: number; replaced: number; doubleRelease: number; peak: number };
}

export function createPool<T extends PoolItem>(cap: number, make: () => T, policy: FullPolicy): Pool<T> {
  const slots: T[] = [];
  const free: number[] = [];
  for (let i = 0; i < cap; i++) {
    const it = make();
    it.alive = false;
    it.idx = -1;
    it.slot = i;
    it.born = 0;
    slots.push(it);
    free.push(cap - 1 - i);
  }
  const live: T[] = new Array<T>(cap);
  let seq = 0;
  const pool: Pool<T> = {
    cap,
    policy,
    live,
    n: 0,
    slots,
    stats: { skipped: 0, replaced: 0, doubleRelease: 0, peak: 0 },
    acquire() {
      let it: T;
      if (free.length > 0) it = slots[free.pop()!]!;
      else if (policy === 'skip') {
        pool.stats.skipped++;
        return null;
      } else {
        let oldest = live[0]!;
        for (let i = 1; i < pool.n; i++) if (live[i]!.born < oldest.born) oldest = live[i]!;
        pool.release(oldest);
        pool.stats.replaced++;
        it = slots[free.pop()!]!;
      }
      it.alive = true;
      it.born = ++seq;
      it.idx = pool.n;
      live[pool.n++] = it;
      if (pool.n > pool.stats.peak) pool.stats.peak = pool.n;
      return it;
    },
    release(it) {
      if (!it.alive) {
        pool.stats.doubleRelease++;
        return;
      }
      const last = live[pool.n - 1]!;
      live[it.idx] = last;
      last.idx = it.idx;
      pool.n--;
      it.alive = false;
      it.idx = -1;
      free.push(it.slot);
    },
    clear() {
      while (pool.n > 0) pool.release(live[pool.n - 1]!);
    },
  };
  return pool;
}
