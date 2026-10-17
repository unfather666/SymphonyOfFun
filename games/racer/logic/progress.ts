// Saved progress: which levels are open and the best score and time on each. Pure data in, pure data out.
export const LEVEL_COUNT = 10;
export const PROGRESS_VERSION = 1;

export interface Progress {
  /** Highest level number that may be played (1..LEVEL_COUNT). */
  unlocked: number;
  /** Best score per level, index 0 is level 1. 0 means none. */
  bestScore: number[];
  /** Fastest finished run per level in ms. 0 means none. */
  bestTime: number[];
}

export function newProgress(): Progress {
  return { unlocked: 1, bestScore: new Array<number>(LEVEL_COUNT).fill(0), bestTime: new Array<number>(LEVEL_COUNT).fill(0) };
}

const whole = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);

function column(v: unknown, max: number): number[] {
  const out = new Array<number>(LEVEL_COUNT).fill(0);
  if (Array.isArray(v)) for (let i = 0; i < LEVEL_COUNT; i++) out[i] = whole(v[i], max);
  return out;
}

/** Clamp anything read back from storage into a valid Progress; unknown or damaged parts fall back to "none". */
export function sanitize(data: unknown): Progress {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const p = newProgress();
  p.unlocked = Math.max(1, Math.min(LEVEL_COUNT, whole(d.unlocked, LEVEL_COUNT)));
  p.bestScore = column(d.bestScore, 99999999);
  p.bestTime = column(d.bestTime, 9999999);
  return p;
}

export function copyProgress(from: Progress, to: Progress): void {
  to.unlocked = from.unlocked;
  for (let i = 0; i < LEVEL_COUNT; i++) {
    to.bestScore[i] = from.bestScore[i]!;
    to.bestTime[i] = from.bestTime[i]!;
  }
}

export const isUnlocked = (p: Progress, levelNo: number): boolean => levelNo >= 1 && levelNo <= p.unlocked;

/** A run ended. Score counts whether or not the level was finished; time and the next level only when it was. Returns true if anything changed. */
export function record(p: Progress, levelNo: number, finished: boolean, score: number, runMs: number): boolean {
  if (levelNo < 1 || levelNo > LEVEL_COUNT) return false;
  const i = levelNo - 1;
  let changed = false;
  if (score > p.bestScore[i]!) {
    p.bestScore[i] = Math.floor(score);
    changed = true;
  }
  if (finished) {
    if (p.bestTime[i] === 0 || runMs < p.bestTime[i]!) {
      p.bestTime[i] = Math.floor(runMs);
      changed = true;
    }
    if (levelNo < LEVEL_COUNT && p.unlocked < levelNo + 1) {
      p.unlocked = levelNo + 1;
      changed = true;
    }
  }
  return changed;
}
