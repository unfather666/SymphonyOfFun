// Save data for the `progress` section. Loading never throws: bad shapes fall back to defaults and unknown items are dropped.
import { PRESETS, SLOTS, newProgress, type Progress } from './rig';

export const PROGRESS_VERSION = 1;

export function sanitizeProgress(raw: unknown, known: ReadonlySet<string>, startItems: readonly string[]): Progress {
  const base = newProgress(startItems);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const owned = new Set<string>(startItems);
  if (Array.isArray(r.ownedItems)) for (const id of r.ownedItems) if (typeof id === 'string' && known.has(id)) owned.add(id);
  const out: Progress = { ownedItems: [...owned], presets: base.presets, active: 0, totalPoints: 0 };
  if (Array.isArray(r.presets)) {
    for (let p = 0; p < PRESETS; p++) {
      const src = r.presets[p];
      if (!Array.isArray(src)) continue;
      const seen = new Set<string>();
      for (let s = 0; s < SLOTS; s++) {
        const id = src[s];
        out.presets[p]![s] = typeof id === 'string' && owned.has(id) && !seen.has(id) ? id : null;
        if (out.presets[p]![s]) seen.add(id as string);
      }
    }
  }
  if (typeof r.active === 'number' && r.active >= 0 && r.active < PRESETS) out.active = Math.floor(r.active);
  if (typeof r.totalPoints === 'number' && Number.isFinite(r.totalPoints) && r.totalPoints >= 0) out.totalPoints = Math.floor(r.totalPoints);
  return out;
}
