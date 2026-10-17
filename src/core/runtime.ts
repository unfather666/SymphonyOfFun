import { STEP_MS, type CoreContext, type GameId, type GameInstance, type GameModule } from './api';
import { createChip } from './chip/chip';
import { createSynth } from './chip/synth';
import { createContentLoader } from './content/loader';
import { createStrings } from './content/strings';
import { createLogger } from './dev/logger';
import { createReadout } from './dev/readout';
import { createDisplay } from './display/display';
import { createEventBus } from './events/bus';
import { createFaultGuard } from './faults/guard';
import { createGfx } from './gfx2d/gfx';
import { attachDomInput } from './input/dom';
import { createInputState } from './input/state';
import { createLauncher } from './launcher/launcher';
import { OPTIONS_KEY, parseOptions, type Options } from './launcher/options';
import { createClock } from './loop/clock';
import { createFixedLoop } from './loop/fixedLoop';
import { createRandom } from './random/mulberry32';
import { browserStorage, createSaveStore } from './saves/store';
import { createUi } from './ui/ui';

export interface BootOptions {
  stage: HTMLElement;
  games: readonly GameModule[];
  strings: Record<GameId, Record<string, string>>;
  /** ?game= */
  startGame?: string | null;
  /** ?seed= */
  seed?: number | null;
  /** ?crash=1: the opened game throws in update (crash guard demo). */
  crashDemo?: boolean;
}

function detectPlatform(): 'desktop' | 'phone' | 'browser' {
  const w = globalThis as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) return 'desktop';
  if (globalThis.matchMedia?.('(pointer: coarse)').matches) return 'phone';
  return 'browser';
}

export function boot(opts: BootOptions) {
  const log = createLogger('core');
  const storage = browserStorage();
  let options: Options = parseOptions(storage.get(OPTIONS_KEY));
  const platform = detectPlatform();

  const clock = createClock();
  const loop = createFixedLoop();
  const events = createEventBus(log.warn);
  const input = createInputState();
  const display = createDisplay(opts.stage, (scale, cssW, cssH) => events.emit('display:resized', { scale, cssW, cssH }));
  const makeCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const gfx = createGfx(display.ctx2d, makeCanvas, clock.nowMs, log.warn);
  const synth = createSynth();
  const chip = createChip(clock, events, synth, log.warn);
  const ui = createUi(gfx, input, clock.nowMs, (id) => chip.sfx(id));
  const readout = createReadout();
  const content = createContentLoader((kind, errs) => errs.forEach((e, i) => log.warn(`content:${kind}:${i}`, e)));
  const dom = attachDomInput(input, opts.stage, display.toScreen, (device) => events.emit('input:deviceChanged', { device }));
  dom.onFirstGesture(() => synth.unlock());
  dom.onKey((code) => {
    if (code === 'F3') readout.toggle();
  });

  const reducedFx = () => (options.reducedFx === null ? platform === 'phone' : options.reducedFx);
  function applyOptions() {
    chip.setVolume(options.volume / 10);
    display.setWantedScale(options.scale);
    dom.setKeyMap(options.keys);
  }
  applyOptions();

  const runSeed = opts.seed ?? (Date.now() >>> 0);

  let game: GameInstance | null = null;
  let gameId: GameId | null = null;
  let ready = false;
  let paused = false;
  const updGuard = createFaultGuard(3, (m) => log.error(`update:${m}`, `Game update failed: ${m}`));
  const drawGuard = createFaultGuard(3, (m) => log.error(`draw:${m}`, `Game draw failed: ${m}`));
  let pauseMenu: { close(): void } | null = null;

  function resetSession() {
    ui.closeAll();
    chip.sequencer.stop();
    events.clear();
    events.offAll();
    clock.reset();
    gfx.effects.reset();
    gfx.resetPalette();
    input.releaseAll();
    updGuard.reset();
    drawGuard.reset();
    paused = false;
    pauseMenu = null;
  }

  function leaveGame(crash?: string) {
    if (game) {
      try {
        game.shutdown();
      } catch (e) {
        log.error('shutdown', `Game shutdown failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    game = null;
    gameId = null;
    ready = false;
    resetSession();
    launcher = makeLauncher();
    dom.setAimStick(false);
    if (crash) launcher.showCrash(crash);
    else launcher.enter('games');
  }

  function openGame(id: GameId) {
    const mod = opts.games.find((g) => g.id === id);
    if (!mod) {
      log.warn(`no-game:${id}`, `No game "${id}".`);
      return;
    }
    resetSession();
    const ctx: CoreContext = {
      gameId: id,
      clock,
      random: createRandom(runSeed),
      events,
      input,
      display,
      gfx,
      chip,
      saves: createSaveStore(id, storage),
      content,
      strings: createStrings(opts.strings[id] ?? {}, log.warn),
      ui,
      log: createLogger(id),
      settings: { platform, reducedFx: reducedFx() },
      exit: () => queueMicrotask(() => leaveGame()),
    };
    try {
      const inst = mod.create(ctx);
      if (opts.crashDemo) {
        inst.update = () => {
          throw new Error('Crash demo (?crash=1): update threw on purpose.');
        };
      }
      game = inst;
      gameId = id;
      dom.setAimStick(mod.touch?.aim ?? false);
      ready = false;
      Promise.resolve(inst.init()).then(
        () => {
          if (game === inst) ready = true;
        },
        (e) => {
          if (game === inst) leaveGame(`${mod.title} failed to start: ${e instanceof Error ? e.message : String(e)}`);
        },
      );
    } catch (e) {
      leaveGame(`${mod.title} failed to start: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function setPaused(on: boolean) {
    if (!game || paused === on) return;
    paused = on;
    try {
      game.pause(on);
    } catch (e) {
      log.error('pause', `Game pause failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    events.emit('core:paused', { on });
    if (on) {
      pauseMenu = ui.menu({
        title: 'PAUSED',
        items: [
          { label: 'RESUME', onPick: () => setPaused(false) },
          { label: 'QUIT TO LAUNCHER', onPick: () => leaveGame() },
        ],
        onCancel: () => setPaused(false),
      });
    } else {
      pauseMenu?.close();
      pauseMenu = null;
    }
  }

  const makeLauncher = () =>
    createLauncher({
      gfx,
      input,
      chip,
      events,
      games: opts.games,
      options: () => options,
      setOptions(o) {
        options = o;
        try {
          storage.set(OPTIONS_KEY, JSON.stringify(o));
        } catch {
          /* storage full: options live for this session */
        }
        applyOptions();
      },
      openGame,
      captureKey: (cb) => dom.captureNextKey(cb),
      now: clock.nowMs,
    });
  let launcher = makeLauncher();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      setPaused(true);
      synth.suspend(true);
    } else synth.suspend(false);
  });

  // dev cheats: window.sof.cheat('id') → dev:cheat {id}
  if (import.meta.env.DEV) {
    (globalThis as { sof?: unknown }).sof = {
      cheat: (id: string) => events.emit('dev:cheat', { id }),
      stats: () => readout.stats(),
      state: () => ({ game: gameId, ready, paused, screen: game ? null : launcher.screen(), log: log.recent() }),
    };
  }

  function step() {
    input.latch();
    if (ui.modal()) {
      ui.update();
      events.flush();
      return;
    }
    if (game) {
      if (!ready) return;
      if (input.pressed('select') || input.pressed('start')) {
        setPaused(true);
        return;
      }
      clock.advance();
      chip.sequencer.tick();
      readout.stepStart();
      const g = game;
      updGuard.run(() => g.update(STEP_MS));
      readout.stepEnd();
      events.flush();
      if (updGuard.tripped()) leaveGame(updGuard.lastError());
      return;
    }
    clock.advance();
    chip.sequencer.tick();
    launcher.update();
    events.flush();
  }

  function draw(alpha: number) {
    readout.drawStart();
    gfx.clear();
    gfx.beginFrame();
    if (game) {
      if (ready) {
        const g = game;
        drawGuard.run(() => g.draw(alpha));
      } else gfx.drawText('LOADING', 192, 104, { colour: 6, align: 'center' });
    } else launcher.draw();
    gfx.endFrame();
    ui.draw();
    dom.drawTouch(display.ctx2d);
    readout.drawEnd();
    readout.draw(gfx, gameId ?? 'launcher', clock.step());
    if (game && drawGuard.tripped()) leaveGame(drawGuard.lastError());
  }

  let last = -1;
  function frame(t: number) {
    const dt = last < 0 ? STEP_MS : t - last;
    last = t;
    dom.pollGamepads();
    const { steps, alpha } = loop.frame(Math.min(dt, 250));
    for (let i = 0; i < steps; i++) step();
    draw(alpha);
    readout.frame();
    requestAnimationFrame(frame);
  }

  const start = opts.startGame as GameId | null | undefined;
  if (start && opts.games.some((g) => g.id === start)) openGame(start);
  else launcher.enter('title');
  requestAnimationFrame(frame);
}
