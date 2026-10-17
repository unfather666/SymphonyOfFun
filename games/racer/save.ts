// The one save section Tempo Road registers with core: progress through the levels.
import type { SaveSection } from '../../src/core/api';
import { copyProgress, PROGRESS_VERSION, sanitize, type Progress } from './logic/progress';

export const SAVE_SLOT = 'progress';

/** `p` is read when saving and overwritten when loading. */
export function progressSection(p: Progress): SaveSection<Progress> {
  return {
    key: 'progress',
    version: PROGRESS_VERSION,
    serialize: () => p,
    deserialize: (d) => copyProgress(sanitize(d), p),
    // One shape so far; whatever an older version left is repaired the same way as a damaged one.
    migrate: (d) => sanitize(d),
  };
}
