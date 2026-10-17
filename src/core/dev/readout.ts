import type { CoreGfx } from '../gfx2d/gfx';

/** F3 readout. Uses performance.now (dev only, never in games). */
export interface DevReadout {
  toggle(): void;
  shown(): boolean;
  stepStart(): void;
  stepEnd(): void;
  drawStart(): void;
  drawEnd(): void;
  frame(): void;
  draw(gfx: CoreGfx, label: string, steps: number): void;
  /** Averages over the last second, for tests and the budget line. */
  stats(): { stepAvg: number; stepWorst: number; drawAvg: number; fps: number };
}

export function createReadout(now: () => number = () => performance.now()): DevReadout {
  let on = false;
  let t0 = 0, d0 = 0;
  let stepSum = 0, stepN = 0, stepWorst = 0, drawSum = 0, drawN = 0, frames = 0, windowStart = now();
  const out = { stepAvg: 0, stepWorst: 0, drawAvg: 0, fps: 0 };
  return {
    toggle() { on = !on; },
    shown: () => on,
    stepStart() { t0 = now(); },
    stepEnd() {
      const d = now() - t0;
      stepSum += d; stepN++;
      if (d > stepWorst) stepWorst = d;
    },
    drawStart() { d0 = now(); },
    drawEnd() { drawSum += now() - d0; drawN++; },
    frame() {
      frames++;
      const t = now();
      if (t - windowStart >= 1000) {
        out.stepAvg = stepN ? stepSum / stepN : 0;
        out.stepWorst = stepWorst;
        out.drawAvg = drawN ? drawSum / drawN : 0;
        out.fps = (frames * 1000) / (t - windowStart);
        stepSum = stepN = stepWorst = drawSum = drawN = frames = 0;
        windowStart = t;
      }
    },
    draw(gfx, label, steps) {
      if (!on) return;
      const lines = [
        `${label}`,
        `FPS ${out.fps.toFixed(0)}`,
        `STEP ${out.stepAvg.toFixed(2)} / ${out.stepWorst.toFixed(2)} MS`,
        `DRAW ${out.drawAvg.toFixed(2)} MS`,
        `STEPS ${steps}`,
      ];
      gfx.rect(2, 2, 120, lines.length * 8 + 4, 'rgba(0,0,0,0.7)');
      lines.forEach((l, i) => gfx.drawText(l, 4, 4 + i * 8, { colour: 22 }));
    },
    stats: () => out,
  };
}
