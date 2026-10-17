/** One-shot sfx accounting: at most `cap` in flight; full policy is drop the quietest. */
export const SFX_CAP = 8;

export interface ActiveSfx {
  endSec: number;
  volume: number;
  stop(): void;
}

/** Returns true if the new sfx may play (possibly after stopping the quietest). */
export function admitSfx(active: ActiveSfx[], volume: number, nowSec: number, cap = SFX_CAP): boolean {
  for (let i = active.length - 1; i >= 0; i--) if (active[i]!.endSec <= nowSec) active.splice(i, 1);
  if (active.length < cap) return true;
  let q = 0;
  for (let i = 1; i < active.length; i++) if (active[i]!.volume < active[q]!.volume) q = i;
  if (active[q]!.volume >= volume) return false;
  active[q]!.stop();
  active.splice(q, 1);
  return true;
}
