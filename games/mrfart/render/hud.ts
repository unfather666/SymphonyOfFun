// HUD: reputation bar and clock (top), fart meter (bottom, wobbles near full), witness eyes, first-seconds hints.
import type { Gfx2d } from '../../../src/core/api';
import { SCREEN_H, SCREEN_W } from '../../../src/core/api';
import { formatClock, hourAt } from '../logic/clock';
import type { JobOffer } from '../logic/jobTypes';
import type { Sim } from '../logic/sim';
import { PROMPT_KEYS } from '../logic/verbs';
import { STATUS_PLAYING, STATUS_WON } from '../logic/types';

type Text = (key: string, params?: Record<string, string | number>) => string;

function bar(g: Gfx2d, x: number, y: number, w: number, frac: number, colour: number): void {
  g.rect(x - 1, y - 1, w + 2, 9, 2);
  g.rect(x, y, w * Math.min(1, Math.max(0, frac)), 7, colour);
  g.frame(x - 1, y - 1, w + 2, 9, 7);
}

/** Short progress text for the step in hand: presses so far, or seconds still to go. */
function stepProgress(sim: Sim, text: Text): string {
  const job = sim.job!;
  const step = sim.deps.catalog.types[job.offer.type]!.steps[job.step]!;
  if (step.verb === 'strike') return text('job_hits', { n: job.hits, total: step.n ?? 1 });
  if (step.verb === 'wait' || step.verb === 'hold') {
    const left = Math.max(0, Math.ceil(((step.n ?? 1) * 1000 - (sim.now - job.stepStartedAt)) / 1000));
    return text('job_wait', { n: left });
  }
  return '';
}

export function drawHud(g: Gfx2d, sim: Sim, text: Text, jobLine?: (o: JobOffer) => string): void {
  const { rules } = sim.deps;
  const m = sim.meters;
  const frac = Math.min(1, m.fart / rules.meter.max);
  const wob = frac > 0.85 ? Math.sin(sim.now / 40) * (frac - 0.85) * 12 : 0;
  const y = SCREEN_H - 14 + wob;
  g.drawText(text('meter'), 8, y + 1, { colour: 7, shadow: 2 });
  bar(g, 40, y, 120, frac, frac < 0.4 ? 22 : frac < 0.7 ? 18 : 10);
  if (m.clenchSince >= 0) g.drawText(text('hint_clench'), 168, y + 1, { colour: 18, shadow: 2 });

  const rep = m.reputation / rules.reputation.max;
  g.drawText(text('rep'), 6, 5, { colour: 7, shadow: 2 });
  bar(g, 30, 4, 110, rep, rep < 0.2 ? 10 : rep < 0.4 ? 14 : 22);
  g.drawText(formatClock(hourAt(sim.now, rules.world.dayMs, rules.world.startHour)), SCREEN_W - 6, 5, { colour: 7, shadow: 2, align: 'right' });
  g.drawText(text('day', { n: sim.day + 1 }), SCREEN_W - 6, 15, { colour: 6, shadow: 2, align: 'right' });
  for (let i = 0; i < sim.watchers && i < 6; i++) {
    const x = SCREEN_W - 12 - i * 9;
    g.rect(x, 27, 7, 4, 7);
    g.rect(x + 2, 28, 3, 2, 2);
  }
  g.drawText(text('coins', { n: sim.progress.coins }), 6, 17, { colour: 18, shadow: 2 });
  g.drawText(text('tasks', { n: sim.progress.tasksDone }), 6, 27, { colour: 6, shadow: 2 });
  if (sim.job && jobLine) {
    const steps = sim.deps.catalog.types[sim.job.offer.type]!.steps.length;
    g.rect(0, SCREEN_H - 36, SCREEN_W, 20, 2);
    g.drawText(jobLine(sim.job.offer), 6, SCREEN_H - 34, { colour: 7 });
    g.drawText(`${text('job_step', { n: sim.job.step + 1, total: steps })} ${stepProgress(sim, text)}`, 6, SCREEN_H - 25, { colour: 18 });
    const mod = sim.job.offer.mod >= 0 ? sim.deps.catalog.mods[sim.job.offer.mod]! : null;
    if (mod && mod.cond === 'time') {
      const left = Math.max(0, Math.ceil((mod.limitMs - (sim.now - sim.job.startedAt)) / 1000));
      g.drawText(text('timer', { n: left }), SCREEN_W - 6, SCREEN_H - 25, { colour: left < 15 ? 10 : 7, align: 'right' });
    }
  }
  const inv = sim.inv;
  const held = inv.items[inv.sel];
  g.drawText(held === undefined ? text('item_none') : text('item_hud', { name: text(`item_${sim.deps.items[held]!.id}`), n: inv.sel + 1, total: inv.items.length }),
    SCREEN_W - 6, SCREEN_H - 12, { colour: held === undefined ? 6 : 7, shadow: 2, align: 'right' });
  if (sim.prompt > 0) g.drawText(text(PROMPT_KEYS[sim.prompt]!), SCREEN_W / 2, SCREEN_H - 52, { colour: 7, shadow: 2, align: 'center' });
  if (sim.now < 8000 && !sim.job) {
    g.drawText(text('hint_move'), 8, 40, { colour: 7, shadow: 2 });
    g.drawText(text('hint_run'), 8, 50, { colour: 7, shadow: 2 });
  }
  if (sim.status !== STATUS_PLAYING) {
    const won = sim.status === STATUS_WON;
    g.rect(0, 78, SCREEN_W, 60, 2);
    g.drawText(text(`ending_${sim.ending}`), SCREEN_W / 2, 86, { colour: won ? 22 : 10, shadow: 8, scale: 2, align: 'center' });
    g.drawText(text(`ending_${sim.ending}_text`), SCREEN_W / 2, 108, { colour: 7, align: 'center' });
    g.drawText(text(won ? 'win_hint' : 'game_over_hint'), SCREEN_W / 2, 124, { colour: 18, align: 'center' });
  }
}
