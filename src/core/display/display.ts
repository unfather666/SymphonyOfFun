import { SCREEN_H, SCREEN_W, type Display } from '../api';

/** Integer scale that fits the window; below 1x it shrinks fractionally so phones still see everything. */
export function fitScale(winW: number, winH: number, want: number): number {
  const fit = Math.min(winW / SCREEN_W, winH / SCREEN_H);
  if (fit < 1) return fit;
  const max = Math.floor(fit);
  return want > 0 ? Math.min(want, max) : max;
}

export interface CoreDisplay extends Display {
  setWantedScale(n: number): void;
  /** Client coords → 384x216 space. */
  toScreen(clientX: number, clientY: number): { x: number; y: number };
  readonly canvas2d: HTMLCanvasElement;
}

export function createDisplay(stage: HTMLElement, onResized: (scale: number, w: number, h: number) => void): CoreDisplay {
  const glCanvas = document.createElement('canvas');
  glCanvas.width = SCREEN_W;
  glCanvas.height = SCREEN_H;
  const canvas2d = document.createElement('canvas');
  canvas2d.width = SCREEN_W;
  canvas2d.height = SCREEN_H;
  stage.append(glCanvas, canvas2d);
  const ctx2d = canvas2d.getContext('2d')!;
  ctx2d.imageSmoothingEnabled = false;
  let wanted = 0;
  let scale = 1;
  const subs = new Set<(s: number) => void>();

  function layout() {
    scale = fitScale(window.innerWidth, window.innerHeight, wanted);
    const w = Math.floor(SCREEN_W * scale);
    const h = Math.floor(SCREEN_H * scale);
    for (const c of [glCanvas, canvas2d]) {
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    onResized(scale, w, h);
    for (const s of subs) s(scale);
  }
  window.addEventListener('resize', layout);
  layout();

  return {
    width: SCREEN_W,
    height: SCREEN_H,
    ctx2d,
    glCanvas,
    canvas2d,
    scale: () => scale,
    onResize(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    setWantedScale(n) {
      wanted = n;
      layout();
    },
    toScreen(cx, cy) {
      const r = canvas2d.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * SCREEN_W, y: ((cy - r.top) / r.height) * SCREEN_H };
    },
  };
}
