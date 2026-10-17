// Tempo Road: wires content, the pure sim, core services and the Three.js view. No game rules live here.
import type { CoreContext, Def, GameInstance, GameModule, Registry } from '../../src/core/api';
import { botInput } from './logic/bot';
import { hasSeg, segAt } from './logic/track';
import { createSim, onBeat, stepSim, songEnded, warpTo, warpToKind, PHASE_RUN, type Sim } from './logic/sim';
import type { DriveInput, KindDef, LevelDef, Rules, ThemeDef } from './logic/types';
import { drawHud } from './render/hud';
import { createRenderer, releaseRenderer, type GlRenderer } from './render/three/renderer';
import { createScene, type RacerScene } from './render/three/scene';
import { kindSchema, levelSchema, propSchema, rulesSchema, themeSchema, vehicleSchema } from './schemas';

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
  let kindList: readonly KindDef[] = [];
  let scene: RacerScene | null = null;
  let renderer: GlRenderer | null = null;
  let unsubBeat = () => {};
  let glFailed = false;
  let songStarted = false;
  let bot = false;
  let freeze = false;

  return {
    init() {
      const rules = ctx.content.load<Def>('rules', import.meta.glob('./content/rules/*.json', { eager: true }), rulesSchema).get('rules') as unknown as Rules;
      const kinds = ctx.content.load<Def>('segment', import.meta.glob('./content/segments/*.json', { eager: true }), kindSchema).all() as unknown as KindDef[];
      kindList = kinds;
      const themes = ctx.content.load<Def>('theme', import.meta.glob('./content/themes/*.json', { eager: true }), themeSchema);
      const levels = ctx.content.load<Def>('level', import.meta.glob('./content/levels/*.json', { eager: true }), levelSchema);
      const props = ctx.content.load<Def>('prop', import.meta.glob('./content/props/*.json', { eager: true }), propSchema);
      const vehicles = ctx.content.load<Def>('vehicle', import.meta.glob('./content/vehicles/*.json', { eager: true }), vehicleSchema);

      const levelNo = Math.max(1, Math.min(10, Number(new URLSearchParams(location.search).get('level')) || 1));
      const level = (levels.all() as unknown as LevelDef[]).find((l) => l.no === levelNo) ?? (levels.all()[0] as unknown as LevelDef);
      const theme = themes.get(level.theme) as unknown as ThemeDef;

      const q = new URLSearchParams(location.search);
      bot = import.meta.env.DEV && q.get('bot') === '1';
      freeze = import.meta.env.DEV && q.get('freeze') === '1';
      ctx.chip.sequencer.load(ctx.chip.demoSong);
      const bpm = ctx.chip.sequencer.bpm();
      sim = createSim({ rules, level, theme, kinds, runSeed: ctx.random.runSeed, bpm });

      const at = import.meta.env.DEV ? q.get('at') : null;
      if (at) {
        if (/^\d+$/.test(at)) warpTo(sim, Number(at));
        else if (!warpToKind(sim, at, kinds)) ctx.log.warn('racer:at', `No segment of kind ${at} found.`);
      }

      const propDefs = new Map<string, readonly (readonly number[])[]>();
      for (const p of props.all()) propDefs.set(p.id, p.parts as number[][]);
      const carStates = (vehicles.get('car').states as number[][][]) ?? [];
      try {
        renderer = createRenderer(ctx.display.glCanvas, ctx.display.width, ctx.display.height);
        scene = createScene(renderer, { rules, theme, segLen: sim.segLen, propDefs, carStates, archIndex: sim.totalBeats - 2 });
      } catch (e) {
        glFailed = true;
        ctx.log.error('racer:gl', `WebGL is not available: ${String(e)}`);
      }

      unsubBeat = ctx.events.on('chip:beat', (p) => {
        if (sim && typeof p.step === 'number' && typeof p.step16 === 'number' && p.step16 % 4 === 0) onBeat(sim, p.step, ctx.clock.nowMs());
      });
      ctx.chip.sequencer.play(0);
      songStarted = true;
      if (import.meta.env.DEV) {
        // Dev readout for agent-tests/racer-smoke.mjs and the budget row: draw calls, triangles, live sim numbers.
        (globalThis as { sofRacer?: unknown }).sofRacer = {
          info: () => ({ calls: scene?.drawCalls() ?? 0, tris: scene?.triangles() ?? 0, s: sim?.car.s ?? 0, speed: sim?.car.speed ?? 0, deaths: sim?.deaths ?? 0, phase: sim?.phase ?? -1, beat: sim?.beat.index ?? -1, ahead: sim ? aheadKinds(sim, kindList) : '' }),
        };
      }
    },

    update() {
      const s = sim;
      if (!s || freeze) return;
      input.steer = ctx.input.axis('move').x;
      input.accel = ctx.input.held('a');
      input.accelPressed = ctx.input.pressed('a');
      input.brake = ctx.input.held('b');
      input.jumpPressed = ctx.input.pressed('y');
      input.usePressed = ctx.input.pressed('x');
      if (bot) botInput(s, input, ctx.clock.nowMs());
      stepSim(s, input, ctx.clock.nowMs());
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
