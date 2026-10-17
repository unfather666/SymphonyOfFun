import { ACTIONS, SCREEN_H, SCREEN_W, type Action, type EventBus, type GameModule, type Input } from '../api';
import type { CoreChip } from '../chip/chip';
import type { CoreGfx } from '../gfx2d/gfx';
import { keysFor, remapKey } from '../input/bindings';
import type { Options } from './options';

type Screen = 'title' | 'games' | 'options' | 'controls' | 'credits' | 'crash';

export interface LauncherDeps {
  gfx: CoreGfx;
  input: Input;
  chip: CoreChip;
  events: EventBus;
  games: readonly GameModule[];
  options: () => Options;
  setOptions: (o: Options) => void;
  openGame: (id: GameModule['id']) => void;
  captureKey: (cb: (code: string | null) => void) => void;
  now: () => number;
}

export interface Launcher {
  enter(screen?: Screen): void;
  showCrash(message: string): void;
  update(): void;
  draw(): void;
  screen(): Screen;
}

const CREDITS = [
  'SYMPHONY OF FUN',
  '',
  'Design and direction: Un',
  'Built with Claude',
  '',
  'Libraries: Vite, TypeScript, Vitest,',
  'three.js, Rapier, Tauri (see LICENSES-LOG)',
  '',
  'All art and sound made in code.',
];

export function createLauncher(d: LauncherDeps): Launcher {
  const { gfx, input, chip } = d;
  let screen: Screen = 'title';
  let cursor = 0;
  let crashMsg = '';
  let waitingKey: Action | null = null;
  let pulse = 0; // game ms of last beat
  let beatBar = 0;

  d.events.on('chip:beat', (p) => {
    if ((p.step16 as number) % 4 === 0) {
      pulse = d.now();
      beatBar = p.bar as number;
    }
  });

  function startMusic() {
    if (!chip.sequencer.playing()) {
      chip.sequencer.load(chip.demoSong);
      chip.sequencer.play();
    }
  }

  const GAMES_ITEMS = () => d.games.length + 2; // cards, then OPTIONS, CREDITS

  function optionRows(): Array<{ label: string; value: string; adjust?: (dir: number) => void; pick?: () => void }> {
    const o = d.options();
    const set = (patch: Partial<Options>) => d.setOptions({ ...o, ...patch });
    return [
      { label: 'VOLUME', value: `${o.volume}`, adjust: (dir) => set({ volume: Math.max(0, Math.min(10, o.volume + dir)) }) },
      { label: 'SCALE', value: o.scale === 0 ? 'AUTO' : `${o.scale}X`, adjust: (dir) => set({ scale: (o.scale + dir + 7) % 7 }) },
      {
        label: 'REDUCED FX',
        value: o.reducedFx === null ? 'AUTO' : o.reducedFx ? 'ON' : 'OFF',
        adjust: () => set({ reducedFx: o.reducedFx === null ? true : o.reducedFx ? false : null }),
      },
      { label: 'CONTROLS', value: '', pick: () => go('controls') },
      { label: 'BACK', value: '', pick: () => go('games') },
    ];
  }

  function go(s: Screen) {
    screen = s;
    cursor = 0;
  }

  const back = () => input.pressed('b') || input.pressed('select');
  const ok = () => input.pressed('a') || input.pressed('start');

  function vert(n: number) {
    if (input.pressed('up')) { cursor = (cursor - 1 + n) % n; chip.sfx('beep'); }
    if (input.pressed('down')) { cursor = (cursor + 1) % n; chip.sfx('beep'); }
  }

  function cardRect(i: number) {
    const w = 112, h = 112, gap = 10;
    const total = d.games.length * w + (d.games.length - 1) * gap;
    return { x: (SCREEN_W - total) / 2 + i * (w + gap), y: 52, w, h };
  }
  function bottomRect(i: number) {
    return { x: SCREEN_W / 2 - 90 + i * 100, y: 178, w: 80, h: 14 };
  }
  const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  function pickGames(i: number) {
    chip.sfx('select');
    if (i < d.games.length) d.openGame(d.games[i]!.id);
    else go(i === d.games.length ? 'options' : 'credits');
  }

  return {
    screen: () => screen,
    enter(s = 'title') {
      go(s);
      startMusic();
    },
    showCrash(message) {
      crashMsg = message;
      go('crash');
      startMusic();
      chip.sfx('fail');
    },
    update() {
      const p = input.pointer();
      switch (screen) {
        case 'title':
          if (ok() || p.pressed || input.pressed('a')) { chip.sfx('select'); startMusic(); go('games'); }
          return;
        case 'games': {
          const n = GAMES_ITEMS();
          const cards = d.games.length;
          if (input.pressed('left')) { cursor = cursor < cards ? (cursor - 1 + cards) % cards : cards; chip.sfx('beep'); }
          if (input.pressed('right')) { cursor = cursor < cards ? (cursor + 1) % cards : cards + 1; chip.sfx('beep'); }
          if (input.pressed('down') && cursor < cards) { cursor = cards; chip.sfx('beep'); }
          if (input.pressed('up') && cursor >= cards) { cursor = 0; chip.sfx('beep'); }
          if (p.pressed) {
            for (let i = 0; i < n; i++) {
              const r = i < cards ? cardRect(i) : bottomRect(i - cards);
              if (inRect(r, p.x, p.y)) { cursor = i; pickGames(i); return; }
            }
          }
          if (ok()) pickGames(cursor);
          else if (back()) go('title');
          return;
        }
        case 'options': {
          const rows = optionRows();
          vert(rows.length);
          const row = rows[cursor]!;
          if (row.adjust && input.pressed('left')) { row.adjust(-1); chip.sfx('beep'); }
          if (row.adjust && input.pressed('right')) { row.adjust(1); chip.sfx('beep'); }
          if (p.pressed) {
            const i = Math.floor((p.y - 60) / 14);
            if (i >= 0 && i < rows.length) { cursor = i; const r = rows[i]!; if (r.pick) r.pick(); else r.adjust?.(1); chip.sfx('select'); return; }
          }
          if (ok()) { if (row.pick) row.pick(); else row.adjust?.(1); chip.sfx('select'); }
          else if (back()) go('games');
          return;
        }
        case 'controls': {
          if (waitingKey) return;
          const n = ACTIONS.length + 1;
          vert(n);
          if (ok() || p.pressed) {
            if (cursor === ACTIONS.length) { go('options'); return; }
            const a = ACTIONS[cursor]!;
            waitingKey = a;
            d.captureKey((code) => {
              if (code) d.setOptions({ ...d.options(), keys: remapKey(d.options().keys, a, code) });
              waitingKey = null;
            });
          } else if (back()) go('options');
          return;
        }
        case 'credits':
          if (ok() || back() || p.pressed) go('games');
          return;
        case 'crash':
          if (ok() || back() || p.pressed) go('games');
          return;
      }
    },
    draw() {
      const t = d.now();
      gfx.clear(1);
      const beat = Math.max(0, 1 - (t - pulse) / 250);
      // Starfield of notes scrolling with the beat.
      for (let i = 0; i < 24; i++) {
        const x = (i * 53 + t * 0.02 * (1 + (i % 3))) % SCREEN_W;
        const y = (i * 37) % SCREEN_H;
        gfx.rect(x, y, 1, 1, i % 4 === 0 ? 26 : 3);
      }
      switch (screen) {
        case 'title': {
          const s = 3;
          gfx.drawText('SYMPHONY', SCREEN_W / 2, 50, { scale: s, colour: 18, shadow: 9, align: 'center' });
          gfx.drawText('OF FUN', SCREEN_W / 2, 80, { scale: s, colour: 31, shadow: 28, align: 'center' });
          gfx.rect(SCREEN_W / 2 - 40, 112, 80 * beat, 2, 26);
          gfx.drawText('♪  ' + (beatBar + 1), SCREEN_W / 2, 120, { colour: 5, align: 'center' });
          if (Math.floor(t / 500) % 2 === 0) gfx.drawText('PRESS START OR TAP', SCREEN_W / 2, 150, { colour: 7, align: 'center' });
          gfx.drawText('ENTER/A SELECT  ESC/B BACK  F3 DEV', SCREEN_W / 2, 200, { colour: 4, align: 'center' });
          return;
        }
        case 'games': {
          gfx.drawText('CHOOSE A GAME', SCREEN_W / 2, 20, { scale: 2, colour: 18, shadow: 9, align: 'center' });
          d.games.forEach((g, i) => {
            const r = cardRect(i);
            const sel = cursor === i;
            gfx.rect(r.x, r.y - (sel ? Math.round(beat * 2) : 0), r.w, r.h, sel ? 3 : 2);
            gfx.frame(r.x, r.y - (sel ? Math.round(beat * 2) : 0), r.w, r.h, sel ? 18 : 4);
            gfx.drawText(g.title.toUpperCase(), r.x + r.w / 2, r.y + 12, { colour: sel ? 7 : 6, align: 'center' });
            const blurb = (g.blurb ?? '').toUpperCase();
            const words = blurb.split(' ');
            let line = '';
            let ly = r.y + 32;
            for (const w of words) {
              if ((line + ' ' + w).trim().length > 17) { gfx.drawText(line, r.x + r.w / 2, ly, { colour: 5, align: 'center' }); ly += 9; line = w; }
              else line = (line + ' ' + w).trim();
            }
            if (line) gfx.drawText(line, r.x + r.w / 2, ly, { colour: 5, align: 'center' });
          });
          ['OPTIONS', 'CREDITS'].forEach((label, i) => {
            const r = bottomRect(i);
            const sel = cursor === d.games.length + i;
            gfx.rect(r.x, r.y, r.w, r.h, sel ? 3 : 2);
            gfx.drawText(label, r.x + r.w / 2, r.y + 4, { colour: sel ? 7 : 5, align: 'center' });
          });
          return;
        }
        case 'options': {
          gfx.drawText('OPTIONS', SCREEN_W / 2, 24, { scale: 2, colour: 18, shadow: 9, align: 'center' });
          optionRows().forEach((r, i) => {
            const y = 60 + i * 14;
            const sel = cursor === i;
            if (sel) gfx.rect(96, y - 3, 192, 13, 3);
            gfx.drawText(r.label, 104, y, { colour: sel ? 7 : 6 });
            if (r.value) gfx.drawText(r.adjust ? `◄ ${r.value} ►` : r.value, 280, y, { colour: 18, align: 'right' });
          });
          return;
        }
        case 'controls': {
          gfx.drawText('CONTROLS', SCREEN_W / 2, 10, { scale: 2, colour: 18, shadow: 9, align: 'center' });
          const map = d.options().keys;
          ACTIONS.forEach((a, i) => {
            const y = 32 + i * 13;
            const sel = cursor === i;
            if (sel) gfx.rect(96, y - 3, 192, 12, 3);
            gfx.drawText(a.toUpperCase(), 104, y, { colour: sel ? 7 : 6 });
            const keys = waitingKey === a ? 'PRESS A KEY' : keysFor(map, a).map((k) => k.replace(/^Key|^Arrow/, '')).join(' ').toUpperCase();
            gfx.drawText(keys, 280, y, { colour: waitingKey === a ? 31 : 18, align: 'right' });
          });
          const y = 32 + ACTIONS.length * 13;
          if (cursor === ACTIONS.length) gfx.rect(96, y - 3, 192, 12, 3);
          gfx.drawText('BACK', 104, y, { colour: cursor === ACTIONS.length ? 7 : 6 });
          return;
        }
        case 'credits':
          CREDITS.forEach((l, i) => gfx.drawText(l.toUpperCase(), SCREEN_W / 2, 40 + i * 12, { colour: i === 0 ? 18 : 6, align: 'center' }));
          return;
        case 'crash': {
          gfx.drawText('THE GAME STOPPED', SCREEN_W / 2, 50, { scale: 2, colour: 10, align: 'center' });
          const msg = crashMsg.toUpperCase();
          const lines: string[] = [];
          for (let i = 0; i < msg.length && lines.length < 6; i += 56) lines.push(msg.slice(i, i + 56));
          lines.forEach((l, i) => gfx.drawText(l, SCREEN_W / 2, 90 + i * 10, { colour: 6, align: 'center' }));
          gfx.drawText('PRESS A TO RETURN', SCREEN_W / 2, 170, { colour: 7, align: 'center' });
          return;
        }
      }
    },
  };
}
