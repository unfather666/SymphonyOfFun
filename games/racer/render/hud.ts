// HUD on core's 2D canvas. Reads the sim; strings come from strings.json.
import type { Gfx2d } from '../../../src/core/api';
import type { Sim } from '../logic/sim';

type Str = (key: string, params?: Record<string, string | number>) => string;

const WHITE = '#f4f1e8';
const DIM = '#9a98a8';
const PANEL = '#0b0b14';

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function drawHud(gfx: Gfx2d, str: Str, sim: Sim, nowMs: number): void {
  const car = sim.car;
  const r = sim.rules;
  // Hull bar, top left.
  gfx.drawText(str('hud_health'), 6, 5, { colour: DIM, shadow: PANEL });
  const hp = Math.max(0, Math.min(1, car.health / r.healthMax));
  gfx.rect(5, 15, 82, 8, PANEL);
  gfx.rect(6, 16, Math.round(80 * hp), 6, hp > 0.5 ? '#5ad66f' : hp > 0.25 ? '#f5c542' : '#e8403a');
  // Score and distance, top right.
  gfx.drawText(str('hud_dist'), 378, 5, { colour: DIM, align: 'right', shadow: PANEL });
  gfx.drawText(`${Math.floor(sim.distance)} M`, 378, 14, { colour: WHITE, align: 'right', shadow: PANEL });
  // Time, top centre.
  gfx.drawText(mmss(sim.runMs), 192, 5, { colour: WHITE, align: 'center', shadow: PANEL, scale: 2 });
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
    if (lit && pulse > 0) gfx.frame(x0 + i * 12 - Math.round(pulse * 3), 203 - Math.round(pulse * 3), 10 + Math.round(pulse * 6), 6 + Math.round(pulse * 6), '#ffd23f');
  }
  if (car.syncStacks > 0 && nowMs < car.syncUntilMs) gfx.drawText(str('hud_sync', { n: car.syncStacks }), 192, 192, { colour: '#ffd23f', align: 'center', shadow: PANEL });
}
