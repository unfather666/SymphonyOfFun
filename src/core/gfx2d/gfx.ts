import type { Colour, Gfx2d, MaskLayer, SpriteDef, TextOptions, TileMap } from '../api';
import { createEffects, type Effects } from './effects';
import { ADVANCE, GLYPHS, GLYPH_H, GLYPH_W, LINE_H, glyphRows, textWidth } from './font';
import { DEFAULT_PALETTE } from './palette';
import { decodeSprite } from './sprites';

type MakeCanvas = (w: number, h: number) => HTMLCanvasElement;

interface Sheet {
  w: number;
  h: number;
  frames: number;
  canvas: HTMLCanvasElement;
  def: SpriteDef;
  indices: Int8Array[];
}

export interface CoreGfx extends Gfx2d {
  readonly effects: Effects;
  /** Core: before game.draw (applies shake). */
  beginFrame(): void;
  /** Core: after game.draw (restores, draws flash and fade). */
  endFrame(): void;
}

export function createGfx(ctx: CanvasRenderingContext2D, makeCanvas: MakeCanvas, now: () => number, warn: (k: string, m: string) => void): CoreGfx {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  let palette: string[] = [...DEFAULT_PALETTE];
  const sheets = new Map<string, Sheet>();
  const effects = createEffects(now);

  const colour = (c: Colour) => (typeof c === 'number' ? (palette[c & 31] ?? '#ff00ff') : c);

  function renderSheet(s: Sheet) {
    const c = s.canvas.getContext('2d')!;
    c.clearRect(0, 0, s.canvas.width, s.canvas.height);
    const img = c.createImageData(s.w * s.frames, s.h);
    const rgb = palette.map((p) => {
      const n = parseInt(p.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
    });
    s.indices.forEach((ix, f) => {
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const v = ix[y * s.w + x]!;
          if (v < 0) continue;
          const o = (y * s.w * s.frames + f * s.w + x) * 4;
          const [r, g, b] = rgb[v] ?? [255, 0, 255];
          img.data[o] = r;
          img.data[o + 1] = g;
          img.data[o + 2] = b;
          img.data[o + 3] = 255;
        }
    });
    c.putImageData(img, 0, 0);
  }

  // Font atlas: white glyphs in one row; tinted copies cached per colour.
  const atlas = makeCanvas(GLYPHS.length * ADVANCE, GLYPH_H);
  const glyphIndex = new Map<string, number>();
  {
    const a = atlas.getContext('2d')!;
    a.fillStyle = '#ffffff';
    GLYPHS.forEach((g, i) => {
      glyphIndex.set(g, i);
      const rows = glyphRows(g);
      for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < GLYPH_W; x++) if ((rows[y]! >> (GLYPH_W - 1 - x)) & 1) a.fillRect(i * ADVANCE + x, y, 1, 1);
    });
  }
  const tinted = new Map<string, HTMLCanvasElement>();
  function tint(css: string): HTMLCanvasElement {
    let t = tinted.get(css);
    if (t) return t;
    if (tinted.size > 64) tinted.clear();
    t = makeCanvas(atlas.width, atlas.height);
    const c = t.getContext('2d')!;
    c.drawImage(atlas, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = css;
    c.fillRect(0, 0, t.width, t.height);
    tinted.set(css, t);
    return t;
  }
  const qIndex = glyphIndex.get('?')!;
  function glyphAt(ch: string): number {
    return glyphIndex.get(ch) ?? glyphIndex.get(ch.toUpperCase()) ?? qIndex;
  }
  function textRun(text: string, x: number, y: number, css: string, scale: number) {
    const src = tint(css);
    let cx = x;
    let cy = y;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (ch === '\n') {
        cx = x;
        cy += LINE_H * scale;
        continue;
      }
      if (ch !== ' ') ctx.drawImage(src, glyphAt(ch) * ADVANCE, 0, GLYPH_W, GLYPH_H, cx, cy, GLYPH_W * scale, GLYPH_H * scale);
      cx += ADVANCE * scale;
    }
  }

  const maskCanvas = makeCanvas(W, H);
  const mctx = maskCanvas.getContext('2d')!;
  const mask: MaskLayer = {
    begin(alpha, c = '#000000') {
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, W, H);
      mctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      mctx.fillStyle = c;
      mctx.fillRect(0, 0, W, H);
      mctx.globalAlpha = 1;
      mctx.globalCompositeOperation = 'destination-out';
    },
    light(x, y, r, intensity = 1) {
      const g = mctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${intensity})`);
      g.addColorStop(0.6, `rgba(0,0,0,${intensity * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = g;
      mctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
    cone(x, y, angle, spread, r, intensity = 1) {
      const g = mctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${intensity})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = g;
      mctx.beginPath();
      mctx.moveTo(x, y);
      mctx.arc(x, y, r, angle - spread, angle + spread);
      mctx.closePath();
      mctx.fill();
    },
    end() {
      mctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(maskCanvas, 0, 0);
    },
  };

  const gfx: CoreGfx = {
    get palette() {
      return palette;
    },
    setPalette(cols) {
      palette = [...DEFAULT_PALETTE];
      cols.forEach((c, i) => {
        if (i < 32) palette[i] = c;
      });
      for (const s of sheets.values()) renderSheet(s);
    },
    resetPalette() {
      gfx.setPalette([]);
    },
    colour,
    clear(c) {
      if (c === undefined) ctx.clearRect(0, 0, W, H);
      else {
        ctx.fillStyle = colour(c);
        ctx.fillRect(0, 0, W, H);
      }
    },
    rect(x, y, w, h, c) {
      ctx.fillStyle = colour(c);
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    frame(x, y, w, h, c) {
      ctx.fillStyle = colour(c);
      x = Math.round(x);
      y = Math.round(y);
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillRect(x, y, 1, h);
      ctx.fillRect(x + w - 1, y, 1, h);
    },
    line(x0, y0, x1, y1, c) {
      // Bresenham, pixel exact.
      ctx.fillStyle = colour(c);
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 2048; n++) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    defineSprite(id, def) {
      try {
        const indices = decodeSprite(id, def);
        const s: Sheet = { w: def.w, h: def.h, frames: indices.length, canvas: makeCanvas(def.w * indices.length, def.h), def, indices };
        renderSheet(s);
        sheets.set(id, s);
      } catch (e) {
        warn(`sprite:${id}`, e instanceof Error ? e.message : String(e));
      }
    },
    drawSprite(id, f, x, y, flipX = false) {
      const s = sheets.get(id);
      if (!s) {
        warn(`sprite-missing:${id}`, `Sprite "${id}" is not defined.`);
        return;
      }
      const fi = ((f % s.frames) + s.frames) % s.frames;
      const dx = Math.round(x);
      const dy = Math.round(y);
      if (flipX) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(s.canvas, fi * s.w, 0, s.w, s.h, -dx - s.w, dy, s.w, s.h);
        ctx.restore();
      } else ctx.drawImage(s.canvas, fi * s.w, 0, s.w, s.h, dx, dy, s.w, s.h);
    },
    drawTiles(tilesetId, map, camX, camY) {
      const s = sheets.get(tilesetId);
      if (!s) {
        warn(`sprite-missing:${tilesetId}`, `Tileset "${tilesetId}" is not defined.`);
        return;
      }
      const tw = s.w, th = s.h;
      const cx = Math.round(camX), cy = Math.round(camY);
      const x0 = Math.max(0, Math.floor(cx / tw)), y0 = Math.max(0, Math.floor(cy / th));
      const x1 = Math.min(map.w - 1, Math.floor((cx + W) / tw)), y1 = Math.min(map.h - 1, Math.floor((cy + H) / th));
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++) {
          const f = map.data[ty * map.w + tx]!;
          if (f < 0 || f >= s.frames) continue;
          ctx.drawImage(s.canvas, f * tw, 0, tw, th, tx * tw - cx, ty * th - cy, tw, th);
        }
    },
    drawText(text, x, y, opts?: TextOptions) {
      const scale = Math.max(1, Math.floor(opts?.scale ?? 1));
      const w = textWidth(text, scale);
      const ax = opts?.align === 'center' ? Math.round(x - w / 2) : opts?.align === 'right' ? Math.round(x - w) : Math.round(x);
      const ay = Math.round(y);
      if (opts?.shadow !== undefined) textRun(text, ax + scale, ay + scale, colour(opts.shadow), scale);
      textRun(text, ax, ay, colour(opts?.colour ?? 7), scale);
    },
    textWidth,
    mask,
    shake: (px, ms) => effects.shake(px, ms),
    flash: (c, ms) => effects.flash(colour(c), ms),
    fade: (to, ms) => effects.fade(to, ms),
    shakeOffset: () => effects.offset(),
    effects,
    beginFrame() {
      const o = effects.offset();
      ctx.save();
      if (o.x || o.y) ctx.translate(o.x, o.y);
    },
    endFrame() {
      ctx.restore();
      const f = effects.flashState();
      if (f.alpha > 0) {
        ctx.globalAlpha = f.alpha;
        ctx.fillStyle = f.colour;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      const fade = effects.fadeLevel();
      if (fade > 0) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    },
  };
  return gfx;
}

export type { Sheet };
export { GLYPH_H, LINE_H };
