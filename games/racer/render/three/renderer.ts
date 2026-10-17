// WebGL renderer on core's GL canvas: 384x216 backing store, CSS upscale (nearest) is done by core.
import { ColorManagement, LinearSRGBColorSpace, WebGLRenderer } from 'three';

export type GlRenderer = WebGLRenderer;

export function createRenderer(canvas: HTMLCanvasElement, w: number, h: number): GlRenderer {
  // Palette colours are authored as final display values, so no sRGB conversion anywhere.
  ColorManagement.enabled = false;
  const r = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  r.outputColorSpace = LinearSRGBColorSpace;
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.autoClear = true;
  return r;
}

/** Blank the canvas and drop GPU objects; the context itself stays so the next game visit can reuse the canvas. */
export function releaseRenderer(r: WebGLRenderer): void {
  r.setClearColor(0x000000, 1);
  r.clear();
  r.dispose();
}
