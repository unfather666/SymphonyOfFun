// Level select screen: 100 cells, locked ones greyed with the points they need. Reads state only.
import type { CoreContext } from '../../../src/core/api';
import { SEL_COLS, levelStatus } from '../logic/select';
import { levelPoints } from '../logic/unlocks';
import type { Progress } from '../logic/rig';

const CW = 30;
const CH = 15;
const X0 = (384 - SEL_COLS * CW) / 2;
const Y0 = 24;

export function drawLevelSelect(ctx: CoreContext, cursor: number, pr: Progress, mult: number): void {
  const g = ctx.gfx;
  g.clear(1);
  g.drawText(ctx.strings('select_title'), 192, 6, { align: 'center', colour: 26, scale: 2, shadow: 2 });
  for (let n = 1; n <= 100; n++) {
    const x = X0 + ((n - 1) % SEL_COLS) * CW;
    const y = Y0 + Math.floor((n - 1) / SEL_COLS) * CH;
    const st = levelStatus(n, pr.totalPoints, pr.levelsCleared, mult);
    const boss = n % 10 === 0;
    g.rect(x + 1, y + 1, CW - 2, CH - 2, st === 'locked' ? 2 : st === 'cleared' ? 20 : boss ? 8 : 3);
    g.frame(x + 1, y + 1, CW - 2, CH - 2, st === 'locked' ? 3 : st === 'cleared' ? 22 : boss ? 10 : 5);
    g.drawText(String(n), x + CW / 2, y + 4, { align: 'center', colour: st === 'locked' ? 3 : 7 });
  }
  const cx = X0 + ((cursor - 1) % SEL_COLS) * CW;
  const cy = Y0 + Math.floor((cursor - 1) / SEL_COLS) * CH;
  g.frame(cx, cy, CW, CH, 18);
  g.frame(cx - 1, cy - 1, CW + 2, CH + 2, 18);
  const need = levelPoints(cursor, mult);
  const line = pr.totalPoints >= need ? ctx.strings(cursor % 10 === 0 ? 'select_boss' : 'select_level', { n: cursor }) : ctx.strings('select_locked', { p: need, have: pr.totalPoints });
  g.drawText(line, 192, 180, { align: 'center', colour: pr.totalPoints >= need ? 7 : 10, shadow: 1 });
  g.drawText(ctx.strings('select_points', { n: pr.totalPoints }), 192, 192, { align: 'center', colour: 18 });
  g.drawText(ctx.strings('select_hint'), 192, 204, { align: 'center', colour: 4 });
}
