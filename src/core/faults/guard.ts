/** Crash guard: N failed updates in a row trips it. One good update resets the count. */
export const FAULT_LIMIT = 3;

export interface FaultGuard {
  /** Run fn; returns false if it threw. */
  run(fn: () => void): boolean;
  tripped(): boolean;
  lastError(): string;
  reset(): void;
}

export function createFaultGuard(limit = FAULT_LIMIT, onError: (msg: string) => void = () => {}): FaultGuard {
  let fails = 0;
  let last = '';
  return {
    run(fn) {
      try {
        fn();
        if (fails < limit) fails = 0;
        return true;
      } catch (e) {
        fails++;
        last = e instanceof Error ? e.message : String(e);
        onError(last);
        return false;
      }
    },
    tripped: () => fails >= limit,
    lastError: () => last,
    reset() {
      fails = 0;
      last = '';
    },
  };
}
