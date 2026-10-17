// Which calamity a death trigger maps to. Pure lookups over the calamity defs.
import type { CalamityDef } from './types';

export function calamityIndex(list: readonly CalamityDef[], id: string): number {
  for (let i = 0; i < list.length; i++) if (list[i]!.id === id) return i;
  return -1;
}

/** First def for the trigger that names this theme, else the first with no theme. -1 when none applies. */
export function calamityFor(list: readonly CalamityDef[], trigger: string, themeId: string): number {
  let plain = -1;
  for (let i = 0; i < list.length; i++) {
    const c = list[i]!;
    if (c.trigger !== trigger) continue;
    if (c.theme === themeId) return i;
    if (c.theme === undefined && plain < 0) plain = i;
  }
  return plain;
}
