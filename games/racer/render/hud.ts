// HUD on core's 2D canvas. Reads the sim; strings come from strings.json.
import type { Gfx2d } from '../../../src/core/api';
import { scoreOf } from '../logic/score';
import { PHASE_DYING, PHASE_FINISHED, PHASE_OVER, PHASE_RUN, STAGE_CAPTION, type Sim } from '../logic/sim';

type Str = (key: string, params?: Record<string, string | number>) => string;

const WHITE = '#f4f1e8';
const DIM = '#9a98a8';
const PANEL = '#0b0b14';
const GOLD = '#ffd23f';

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function band(gfx: Gfx2d, y: number, h: number): void {
  gfx.rect(0, y, 384, h, PANEL);
}

function drawEnd(gfx: Gfx2d, str: Str, sim: Sim, title: string, best: number): void {
  band(gfx, 64, 88);
  gfx.drawText(title, 192, 72, { colour: GOLD, align: 'center', shadow: PANEL, scale: 3 });
  gfx.drawText(str('final_score', { n: scoreOf(sim) }), 192, 104, { colour: WHITE, align: 'center', scale: 2 });
  if (best > 0) gfx.drawText(str('best_score', { n: best }), 192, 124, { colour: DIM, align: 'center' });
  gfx.drawText(str('again_hint'), 192, 138, { colour: WHITE, align: 'center' });
}

export interface HudExtras {
  /** Saved best score for this level (0 when none), shown on the end screens. */
  best: number;
  /** Tutorial caption text, or ''. */
  caption: string;
  /** Show the tap-zone labels. */
  touch: boolean;
}

export function drawHud(gfx: Gfx2d, str: Str, sim: Sim, nowMs: number, x: HudExtras): void {
  const best = x.best;
  const car = sim.car;
  const r = sim.rules;
  // Hull bar and lives, top left.
  gfx.drawText(str('hud_health'), 6, 5, { colour: DIM, shadow: PANEL });
  const hp = Math.max(0, Math.min(1, car.health / r.healthMax));
  gfx.rect(5, 15, 82, 8, PANEL);
  gfx.rect(6, 16, Math.round(80 * hp), 6, hp > 0.5 ? '#5ad66f' : hp > 0.25 ? '#f5c542' : '#e8403a');
  gfx.drawText(str('hud_lives'), 6, 26, { colour: DIM, shadow: PANEL });
  for (let i = 0; i < sim.lives; i++) gfx.rect(44 + i * 9, 27, 7, 6, '#e8403a');
  // Score and time, top right and top centre.
  gfx.drawText(str('hud_score'), 378, 5, { colour: DIM, align: 'right', shadow: PANEL });
  gfx.drawText(String(scoreOf(sim)), 378, 14, { colour: WHITE, align: 'right', shadow: PANEL });
  gfx.drawText(mmss(sim.runMs), 192, 5, { colour: WHITE, align: 'center', shadow: PANEL, scale: 2 });
  // Held power-up and active effects, right side.
  if (sim.power.held >= 0) gfx.drawText(str('hud_use', { name: str(`power_${sim.powers[sim.power.held]!.id}`) }), 378, 26, { colour: GOLD, align: 'right', shadow: PANEL });
  if (sim.power.shieldCharges > 0) gfx.drawText(str('hud_shield'), 378, 36, { colour: '#4af0ff', align: 'right', shadow: PANEL });
  if (nowMs < car.boostUntilMs) gfx.drawText(str('hud_boost'), 378, 46, { colour: '#ff9a2f', align: 'right', shadow: PANEL });
  // Speed, bottom left.
  gfx.drawText(str('hud_speed'), 6, 188, { colour: DIM, shadow: PANEL });
  gfx.drawText(String(Math.round(car.speed * 3.6)), 6, 197, { colour: WHITE, shadow: PANEL, scale: 2 });
  // Beat marker, bottom centre: one pip per beat of the bar, the current one lit, and a ring that snaps in on the beat.
  const since = nowMs - sim.beat.edgeMs;
  const pulse = since >= 0 && since < 220 ? 1 - since / 220 : 0;
  const beatInBar = sim.beat.index < 0 ? -1 : ((sim.beat.index % sim.meter) + sim.meter) % sim.meter;
  const w = sim.meter * 12;
  const x0 = Math.round(192 - w / 2);
  for (let i = 0; i < sim.meter; i++) {
    const lit = i === beatInBar;
    gfx.rect(x0 + i * 12, 203, 10, 6, lit ? WHITE : PANEL);
    if (lit && pulse > 0) gfx.frame(x0 + i * 12 - Math.round(pulse * 3), 203 - Math.round(pulse * 3), 10 + Math.round(pulse * 6), 6 + Math.round(pulse * 6), GOLD);
  }
  if (car.syncStacks > 0 && nowMs < car.syncUntilMs) gfx.drawText(str('hud_sync', { n: car.syncStacks }), 192, 192, { colour: GOLD, align: 'center', shadow: PANEL });

  if (x.caption && sim.phase === PHASE_RUN) {
    band(gfx, 40, 14);
    gfx.drawText(x.caption, 192, 44, { colour: WHITE, align: 'center' });
  }
  if (x.touch && sim.phase === PHASE_RUN) {
    gfx.drawText(str('touch_use'), 340, 60, { colour: DIM, align: 'center' });
    gfx.drawText(str('touch_jump'), 340, 120, { colour: DIM, align: 'center' });
  }
  if (sim.phase === PHASE_DYING && sim.dyingStage >= STAGE_CAPTION) {
    const def = sim.calamities[sim.calamity];
    band(gfx, 160, 22);
    if (def) gfx.drawText(str(`calamity_${def.id}`), 192, 168, { colour: WHITE, align: 'center' });
  }
  if (sim.phase === PHASE_FINISHED) drawEnd(gfx, str, sim, str('finish'), best);
  else if (sim.phase === PHASE_OVER) drawEnd(gfx, str, sim, str('game_over'), best);
}
