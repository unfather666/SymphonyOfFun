// Display and 2D drawing.

import type { Vec2 } from './input';

// ---- display / gfx --------------------------------------------------------

export interface Display {
  readonly width: number; // 384
  readonly height: number; // 216
  /** 2D layer, drawn above the GL canvas. Cleared to transparent by core each frame. */
  readonly ctx2d: CanvasRenderingContext2D;
  /** Canvas below the 2D layer for Three.js (pass as `canvas` to WebGLRenderer). */
  readonly glCanvas: HTMLCanvasElement;
  /** Current integer CSS scale. */
  scale(): number;
  onResize(cb: (scale: number) => void): () => void;
}

/** Palette index (0..31 default palette) or a CSS colour string. 0 is transparent in sprites only. */
export type Colour = number | string;

export interface SpriteDef {
  w: number;
  h: number;
  /** Each frame is h rows of w chars; '.' = transparent, else a key from `keys`. */
  frames: string[][];
  /** Char → palette index. Default: '0'-'9','a'-'v' = palette 0..31. */
  keys?: Record<string, number>;
}

export interface TileMap {
  /** In tiles. */
  w: number;
  h: number;
  /** Frame index into the tileset sprite per cell; -1 = empty. Row-major. */
  data: ArrayLike<number>;
}

export interface TextOptions {
  colour?: Colour;
  align?: 'left' | 'center' | 'right';
  /** Integer multiplier. */
  scale?: number;
  shadow?: Colour;
}

export interface MaskLayer {
  /** Start a darkness pass: fill black (or colour) at alpha 0..1. */
  begin(alpha: number, colour?: string): void;
  /** Punch a soft radial light. intensity 0..1. */
  light(x: number, y: number, radius: number, intensity?: number): void;
  /** Punch a cone: angle in radians, spread = half-width in radians. */
  cone(x: number, y: number, angle: number, spread: number, radius: number, intensity?: number): void;
  /** Composite the mask onto ctx2d. */
  end(): void;
}

export interface Gfx2d {
  readonly palette: readonly string[];
  /** Override palette entries (e.g. a level tint); reset() restores the default. */
  setPalette(colours: readonly string[]): void;
  resetPalette(): void;
  colour(c: Colour): string;
  clear(c?: Colour): void;
  rect(x: number, y: number, w: number, h: number, c: Colour): void;
  frame(x: number, y: number, w: number, h: number, c: Colour): void;
  line(x0: number, y0: number, x1: number, y1: number, c: Colour): void;
  /** Register a sprite sheet from data. Re-defining an id replaces it. */
  defineSprite(id: string, def: SpriteDef): void;
  drawSprite(id: string, frame: number, x: number, y: number, flipX?: boolean): void;
  drawTiles(tilesetId: string, map: TileMap, camX: number, camY: number): void;
  /** 5x7 bitmap font, 6 px advance, 8 px line height at scale 1. */
  drawText(text: string, x: number, y: number, opts?: TextOptions): void;
  textWidth(text: string, scale?: number): number;
  readonly mask: MaskLayer;
  /** Effects run on the game clock and are drawn by core after game.draw. */
  shake(px: number, ms: number): void;
  flash(c: Colour, ms: number): void;
  /** Fade to black: to 0 = clear, 1 = black, over ms. */
  fade(to: number, ms: number): void;
  /** Current shake offset; apply to the camera if drawing in 3D. */
  shakeOffset(): Readonly<Vec2>;
}
