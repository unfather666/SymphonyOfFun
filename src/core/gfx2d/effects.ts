import type { Vec2 } from '../api';

/** Screen shake / flash / fade, timed on the game clock (timestamps compared on read). */
export interface Effects {
  shake(px: number, ms: number): void;
  flash(colour: string, ms: number): void;
  fade(to: number, ms: number): void;
  offset(): Readonly<Vec2>;
  /** Current flash colour and alpha (alpha 0 = none). */
  flashState(): Readonly<{ colour: string; alpha: number }>;
  fadeLevel(): number;
  reset(): void;
}

export function createEffects(now: () => number): Effects {
  let shakePx = 0, shakeStart = 0, shakeEnd = 0;
  let flashColour = '#ffffff', flashStart = 0, flashEnd = 0;
  let fadeFrom = 0, fadeTo = 0, fadeStart = 0, fadeEnd = 0;
  const off = { x: 0, y: 0 };
  const fl = { colour: flashColour, alpha: 0 };
  return {
    shake(px, ms) {
      const t = now();
      // Stronger shake wins; a weaker one does not cut a strong one short.
      if (t >= shakeEnd || px >= shakePx) {
        shakePx = px;
        shakeStart = t;
        shakeEnd = t + ms;
      }
    },
    flash(colour, ms) {
      flashColour = colour;
      flashStart = now();
      flashEnd = flashStart + ms;
    },
    fade(to, ms) {
      fadeFrom = this.fadeLevel();
      fadeTo = Math.max(0, Math.min(1, to));
      fadeStart = now();
      fadeEnd = fadeStart + Math.max(0, ms);
    },
    offset() {
      const t = now();
      if (t >= shakeEnd || shakePx <= 0) {
        off.x = 0;
        off.y = 0;
        return off;
      }
      const k = 1 - (t - shakeStart) / (shakeEnd - shakeStart);
      const a = shakePx * k;
      off.x = Math.round(Math.sin(t * 0.091) * a);
      off.y = Math.round(Math.cos(t * 0.113) * a);
      return off;
    },
    flashState() {
      const t = now();
      fl.colour = flashColour;
      fl.alpha = t < flashEnd ? 1 - (t - flashStart) / (flashEnd - flashStart) : 0;
      return fl;
    },
    fadeLevel() {
      const t = now();
      if (t >= fadeEnd) return fadeTo;
      return fadeFrom + (fadeTo - fadeFrom) * ((t - fadeStart) / (fadeEnd - fadeStart));
    },
    reset() {
      shakeEnd = flashEnd = fadeEnd = 0;
      shakePx = 0;
      fadeFrom = fadeTo = 0;
    },
  };
}
