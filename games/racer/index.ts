// Tempo Road: wires content, the pure sim, core services and the Three.js view. No game rules live here.
import type { CoreContext, GameInstance, GameModule, Song } from '../../src/core/api';
import { loadContent, type RacerContent } from './content';
import { defineRacerSfx, playFx } from './fxplay';
import { botInput } from './logic/bot';
import { levelBars } from './logic/level';
import { assemble, chooseMeter } from './logic/songgen';
import { createSim, forceCalamity, onBeat, songEnded, stepSim, warpTo, warpToKind, PHASE_FINISHED, PHASE_OVER, PHASE_RUN, type Sim } from './logic/sim';
import { scoreOf } from './logic/score';
import { hasSeg, segAt } from './logic/track';
import type { DriveInput, KindDef, LevelDef, ThemeDef } from './logic/types';
import { drawHud } from './render/hud';
import { createRenderer, releaseRenderer, type GlRenderer } from './render/three/renderer';
import { createScene, type RacerScene } from './render/three/scene';

/** After a run ends, button presses are ignored this long so the last tap on the beat does not restart it. */
const END_LOCK_MS = 900;
/** Reduced effects: pool caps never exceed these. */
const REDUCED_PIECES = 128;
const REDUCED_SMOKE = 64;

/** Dev readout: kinds of the next six segments. */
function aheadKinds(sim: Sim, kinds: readonly KindDef[]): string {
  const i = Math.floor(sim.car.s / sim.segLen);
  let out = String(i);
  for (let k = 1; k <= 6; k++) out += ` ${hasSeg(sim.track, i + k) ? kinds[segAt(sim.track, i + k).kind]!.id : '?'}`;
  return out;
}

function create(ctx: CoreContext): GameInstance {
  const input: DriveInput = { steer: 0, accel: false, accelPressed: false, brake: false, jumpPressed: false, usePressed: false };
  let sim: Sim | null = null;
  let content: RacerContent | null = null;
  let level: LevelDef | null = null;
  let theme: ThemeDef | null = null;
  let scene: RacerScene | null = null;
  let renderer: GlRenderer | null = null;
  let unsubBeat = () => {};
  let glFailed = false;
  let songStarted = false;
  let bot = false;
  let freeze = false;
  let forced = '';
  let endAtMs = -1;

  /** A fresh run of the current level: song, sim and effects reset. */
  function startRun(): void {
    const c = content!;
    const rules = c.rules;
    const lv = level!;
    let song: Song = ctx.chip.demoSong;
    let meter = 4;
    if (c.patterns.length > 0) {
      meter = chooseMeter(lv.meter3Chance ?? 0, ctx.random.runSeed, lv.no, c.patterns);
      song = assemble({ levelNo: lv.no, runSeed: ctx.random.runSeed, bpm: lv.bpm, meter, lengthBars: levelBars(rules.levelSeconds, lv.bpm, meter), sectionBars: rules.sectionBars, patterns: c.patterns });
    } else ctx.log.warn('racer:patterns', 'No music patterns loaded; playing the demo song.');
    ctx.chip.sequencer.load(song);
    const reduced = ctx.settings.reducedFx;
    sim = createSim({
      rules, level: lv, theme: theme!, kinds: c.kinds, hazards: c.hazards, powers: c.powers, calamities: c.calamities, runSeed: ctx.random.runSeed,
      bpm: ctx.chip.sequencer.bpm() || lv.bpm, meter,
      piecesCap: reduced ? Math.min(REDUCED_PIECES, rules.piecesCap) : rules.piecesCap, smokeCap: reduced ? Math.min(REDUCED_SMOKE, rules.smokeCap) : rules.smokeCap,
    });
    endAtMs = -1;
    ctx.gfx.fade(0, 1);
    ctx.chip.sequencer.play(0);
    songStarted = true;
  }

  return {
    init() {
      content = loadContent(ctx);
      const q = new URLSearchParams(location.search);
      const levelNo = Math.max(1, Math.min(10, Number(q.get('level')) || 1));
      level = content.levels.find((l) => l.no === levelNo) ?? content.levels[0]!;
      theme = content.themes.find((t) => t.id === level!.theme)!;
      bot = import.meta.env.DEV && q.get('bot') === '1';
      freeze = import.meta.env.DEV && q.get('freeze') === '1';
      forced = import.meta.env.DEV ? (q.get('calamity') ?? '') : '';
      defineRacerSfx(ctx);
      startRun();
      const s = sim!;

      const at = import.meta.env.DEV ? q.get('at') : null;
      if (at) {
        if (/^\d+$/.test(at)) warpTo(s, Number(at));
        else if (!warpToKind(s, at, content.kinds)) ctx.log.warn('racer:at', `No segment of kind ${at} found.`);
      }
      if (forced && !content.calamities.some((c) => c.id === forced)) {
        ctx.log.warn('racer:calamity', `No calamity called ${forced}.`);
        forced = '';
      }

      try {
        renderer = createRenderer(ctx.display.glCanvas, ctx.display.width, ctx.display.height);
        scene = createScene(renderer, { rules: content.rules, theme, segLen: s.segLen, propDefs: content.propDefs, carStates: content.carStates, archIndex: s.totalBeats - 2, piecesCap: s.pieces.cap, smokeCap: s.smoke.cap });
      } catch (e) {
        glFailed = true;
        ctx.log.error('racer:gl', `WebGL is not available: ${String(e)}`);
      }

      unsubBeat = ctx.events.on('chip:beat', (p) => {
        if (sim && typeof p.step === 'number' && typeof p.step16 === 'number' && p.step16 % 4 === 0) onBeat(sim, p.step, ctx.clock.nowMs());
      });
      if (import.meta.env.DEV) {
        // Dev readout for agent-tests/racer-smoke.mjs and the budget row: draw calls, triangles, live sim numbers.
        (globalThis as { sofRacer?: unknown }).sofRacer = {
          info: () => ({
            calls: scene?.drawCalls() ?? 0, tris: scene?.triangles() ?? 0, s: sim?.car.s ?? 0, speed: sim?.car.speed ?? 0, deaths: sim?.deaths ?? 0, lives: sim?.lives ?? 0,
            health: sim?.car.health ?? 0, score: sim ? scoreOf(sim) : 0, pieces: sim?.pieces.n ?? 0, skipped: sim?.pieces.skipped ?? 0, phase: sim?.phase ?? -1,
            calamity: sim ? (sim.calamities[sim.calamity]?.id ?? '') : '', beat: sim?.beat.index ?? -1, ahead: sim && content ? aheadKinds(sim, content.kinds) : '',
            song: ctx.chip.sequencer.bpm(), bars: ctx.chip.sequencer.lengthBars(),
          }),
        };
      }
    },

    update() {
      const s = sim;
      if (!s || freeze) return;
      const now = ctx.clock.nowMs();
      if (s.phase === PHASE_FINISHED || s.phase === PHASE_OVER) {
        if (endAtMs < 0) endAtMs = now;
        if (now - endAtMs > END_LOCK_MS) {
          if (ctx.input.pressed('a') || ctx.input.pressed('start')) startRun();
          else if (ctx.input.pressed('b')) ctx.exit();
        }
        stepSim(s, input, now);
        playFx(ctx, s);
        return;
      }
      input.steer = ctx.input.axis('move').x;
      input.accel = ctx.input.held('a');
      input.accelPressed = ctx.input.pressed('a');
      input.brake = ctx.input.held('b');
      input.jumpPressed = ctx.input.pressed('y');
      input.usePressed = ctx.input.pressed('x');
      if (bot) botInput(s, input, now);
      if (forced && now > 1500) {
        forceCalamity(s, forced);
        forced = '';
      }
      stepSim(s, input, now);
      playFx(ctx, s);
      if (s.seekBar >= 0) {
        ctx.chip.sequencer.seekBar(s.seekBar);
        s.seekBar = -1;
      }
      if (songStarted && s.phase === PHASE_RUN && !ctx.chip.sequencer.playing()) songEnded(s);
    },

    draw(alpha: number) {
      const s = sim;
      if (!s) return;
      if (glFailed || !scene) {
        ctx.gfx.drawText('WEBGL NOT AVAILABLE', 192, 100, { colour: '#e8403a', align: 'center' });
        return;
      }
      const sh = ctx.gfx.shakeOffset();
      scene.draw(s, alpha, ctx.clock.nowMs(), sh.x, sh.y);
      drawHud(ctx.gfx, ctx.strings, s, ctx.clock.nowMs());
    },

    pause() {},

    shutdown() {
      unsubBeat();
      ctx.chip.sequencer.stop();
      ctx.gfx.fade(0, 1);
      scene?.dispose();
      if (renderer) releaseRenderer(renderer);
      scene = null;
      renderer = null;
      sim = null;
    },
  };
}

const mod: GameModule = {
  id: 'racer',
  title: 'Tempo Road',
  blurb: 'Chiptune racer built to the beat',
  touch: { aim: false },
  create,
};
export default mod;
