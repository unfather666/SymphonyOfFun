// A small ring of effect codes the sim raises and index.ts turns into sound and screen effects. Full policy: drop the new code.
export const FX_JUMP = 1;
export const FX_LAND = 2;
export const FX_HIT = 3;
export const FX_BREAK = 4;
export const FX_COIN = 5;
export const FX_POWER = 6;
export const FX_USE = 7;
export const FX_BOOM = 8;
export const FX_FALL = 9;
export const FX_FINISH = 10;
export const FX_OVER = 11;
export const FX_RESPAWN = 12;

export const FX_CAP = 32;

export interface FxQueue {
  codes: Int16Array;
  /** Payload per code (calamity index, damage, ...). */
  values: Float32Array;
  n: number;
  dropped: number;
}

export function newFx(): FxQueue {
  return { codes: new Int16Array(FX_CAP), values: new Float32Array(FX_CAP), n: 0, dropped: 0 };
}

export function pushFx(q: FxQueue, code: number, value = 0): void {
  if (q.n >= FX_CAP) {
    q.dropped++;
    return;
  }
  q.codes[q.n] = code;
  q.values[q.n] = value;
  q.n++;
}
