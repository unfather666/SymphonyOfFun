import { SCREEN_H, SCREEN_W, type Input, type MenuOptions, type Ui, type UiHandle } from '../api';
import type { CoreGfx } from '../gfx2d/gfx';
import { firstPickable, moveCursor } from './menuLogic';

interface Modal {
  kind: 'menu' | 'text';
  menu?: MenuOptions;
  text?: string;
  cursor: number;
  open: boolean;
  onClose?: (() => void) | undefined;
}

export interface CoreUi extends Ui {
  /** True while a modal (menu/textBox) is open: core runs ui.update instead of game.update. */
  modal(): boolean;
  update(): void;
  draw(): void;
  closeAll(): void;
}

const BOX_W = 200;
const ROW_H = 12;

/** Word-wrap to a width in characters. */
export function wrapText(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (line && line.length + 1 + word.length > cols) {
        out.push(line);
        line = word;
      } else line = line ? line + ' ' + word : word;
    }
    out.push(line);
  }
  return out;
}

export function createUi(gfx: CoreGfx, input: Input, now: () => number, sfx: (id: string) => void): CoreUi {
  const stack: Modal[] = [];
  let noticeText = '';
  let noticeUntil = 0;

  function handle(m: Modal): UiHandle {
    return {
      close() {
        if (!m.open) return;
        m.open = false;
        const i = stack.indexOf(m);
        if (i >= 0) stack.splice(i, 1);
        m.onClose?.();
      },
      isOpen: () => m.open,
    };
  }

  function menuRect(m: MenuOptions) {
    const rows = m.items.length + (m.title ? 2 : 0);
    const h = rows * ROW_H + 12;
    return { x: (SCREEN_W - BOX_W) / 2, y: Math.max(4, (SCREEN_H - h) / 2), w: BOX_W, h };
  }

  return {
    menu(opts) {
      const m: Modal = { kind: 'menu', menu: opts, cursor: firstPickable(opts.items), open: true };
      stack.push(m);
      return handle(m);
    },
    textBox(text, onClose) {
      const m: Modal = { kind: 'text', text, cursor: 0, open: true, onClose };
      stack.push(m);
      return handle(m);
    },
    notice(text, ms = 2000) {
      noticeText = text;
      noticeUntil = now() + ms;
    },
    modal: () => stack.length > 0,
    closeAll() {
      stack.length = 0;
    },
    update() {
      const m = stack[stack.length - 1];
      if (!m) return;
      const h = handle(m);
      if (m.kind === 'text') {
        if (input.pressed('a') || input.pressed('start') || input.pressed('b') || input.pointer().pressed) h.close();
        return;
      }
      const opts = m.menu!;
      if (input.pressed('up')) { m.cursor = moveCursor(opts.items, m.cursor, -1); sfx('beep'); }
      if (input.pressed('down')) { m.cursor = moveCursor(opts.items, m.cursor, 1); sfx('beep'); }
      const p = input.pointer();
      if (p.pressed) {
        const r = menuRect(opts);
        const top = r.y + 6 + (opts.title ? 2 * ROW_H : 0);
        const i = Math.floor((p.y - top) / ROW_H);
        if (p.x >= r.x && p.x < r.x + r.w && i >= 0 && i < opts.items.length && !opts.items[i]!.disabled) {
          m.cursor = i;
          sfx('select');
          opts.items[i]!.onPick();
          return;
        }
      }
      if (input.pressed('a') || input.pressed('start')) {
        const it = opts.items[m.cursor];
        if (it && !it.disabled) {
          sfx('select');
          it.onPick();
        }
        return;
      }
      if (input.pressed('b') || input.pressed('select')) {
        if (opts.onCancel) opts.onCancel();
        else h.close();
      }
    },
    draw() {
      for (const m of stack) {
        if (m.kind === 'text') {
          const lines = wrapText(m.text ?? '', 30);
          const h = lines.length * 9 + 16;
          const x = (SCREEN_W - BOX_W) / 2, y = SCREEN_H - h - 8;
          gfx.rect(x, y, BOX_W, h, 1);
          gfx.frame(x, y, BOX_W, h, 6);
          lines.forEach((l, i) => gfx.drawText(l, x + 8, y + 8 + i * 9, { colour: 7 }));
          continue;
        }
        const opts = m.menu!;
        const r = menuRect(opts);
        gfx.rect(0, 0, SCREEN_W, SCREEN_H, 'rgba(0,0,0,0.5)');
        gfx.rect(r.x, r.y, r.w, r.h, 1);
        gfx.frame(r.x, r.y, r.w, r.h, 6);
        let y = r.y + 6;
        if (opts.title) {
          gfx.drawText(opts.title, SCREEN_W / 2, y + 2, { colour: 18, align: 'center' });
          y += 2 * ROW_H;
        }
        opts.items.forEach((it, i) => {
          const sel = i === m.cursor;
          if (sel) gfx.rect(r.x + 4, y, r.w - 8, ROW_H - 1, 3);
          gfx.drawText((sel ? '► ' : '  ') + it.label, r.x + 10, y + 2, { colour: it.disabled ? 4 : sel ? 7 : 6 });
          y += ROW_H;
        });
      }
      if (noticeText && now() < noticeUntil) {
        const w = gfx.textWidth(noticeText) + 12;
        gfx.rect((SCREEN_W - w) / 2, 4, w, 13, 2);
        gfx.drawText(noticeText, SCREEN_W / 2, 7, { colour: 19, align: 'center' });
      }
    },
  };
}
