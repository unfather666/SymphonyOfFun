// The level list shown on start and after a run. Locked levels are greyed; each open level shows its best score.
import type { CoreContext, MenuItem, UiHandle } from '../../src/core/api';
import { isUnlocked, type Progress } from './logic/progress';
import type { LevelDef } from './logic/types';

export function levelMenuItems(str: CoreContext['strings'], levels: readonly LevelDef[], progress: Progress, pick: (no: number) => void): MenuItem[] {
  return levels.map((lv) => {
    const open = isUnlocked(progress, lv.no);
    const best = progress.bestScore[lv.no - 1] ?? 0;
    const name = str(`theme_${lv.theme}`);
    const n = String(lv.no).padStart(2, ' ');
    const label = !open ? str('menu_locked', { n }) : best > 0 ? str('menu_level_best', { n, name, score: best }) : str('menu_level', { n, name });
    return { label, disabled: !open, onPick: () => pick(lv.no) };
  });
}

export function openLevelMenu(ctx: CoreContext, levels: readonly LevelDef[], progress: Progress, pick: (no: number) => void): UiHandle {
  const h: UiHandle = ctx.ui.menu({
    title: ctx.strings('menu_title'),
    items: levelMenuItems(ctx.strings, levels, progress, (no) => {
      h.close();
      pick(no);
    }),
    onCancel: () => ctx.exit(),
  });
  return h;
}
