// Deep Signal: wiring only. Content loads through core, the sim runs from logic/, render/ draws.
import type { CoreContext, GameInstance, GameModule } from '../../src/core/api';
import { loadContent, type Content } from './content/load';
import { CUE } from './logic/cues';
import { mulberry32 } from './logic/rng';
import { clearBonus } from './logic/score';
import { makeCommand, stepWorld } from './logic/sim';
import { createWorld, resetWorld } from './logic/world';
import type { Command, World } from './logic/types';
import { cameraAt, type Cam } from './render/camera';
import { drawScene } from './render/scene';
import { createMusic, type Music } from './musicControl';
import { tierOf } from './logic/madness';
import { createProgressControl, type ProgressControl } from './progressControl';

const SFX_OF_CUE: Record<number, string> = {
  [CUE.shotBolt]: 'shot_bolt',
  [CUE.shotBeam]: 'shot_beam',
  [CUE.shotArc]: 'shot_arc',
  [CUE.shotShell]: 'shot_shell',
  [CUE.shotWave]: 'shot_wave',
  [CUE.hit]: 'ds_hit',
  [CUE.kill]: 'ds_kill',
  [CUE.pickup]: 'ds_pickup',
  [CUE.hurt]: 'ds_hurt',
  [CUE.dash]: 'jump',
  [CUE.flare]: 'select',
  [CUE.dead]: 'fail',
  [CUE.cleared]: 'pickup',
  [CUE.whisper]: 'whisper',
  [CUE.heartbeat]: 'heartbeat',
  [CUE.bossRoar]: 'boss_roar',
};

function create(ctx: CoreContext): GameInstance {
  let content: Content;
  let world: World;
  const cmd: Command = makeCommand();
  const cam: Cam = { x: 0, y: 0 };
  let endedAt = 0;
  let prog: ProgressControl;
  let banked = false;
  let music: Music;

  function readCommand(): void {
    const inp = ctx.input;
    const mv = inp.axis('move');
    const aim = inp.axis('aim');
    const ptr = inp.pointer();
    cmd.mx = mv.x;
    cmd.my = mv.y;
    cmd.ax = aim.x;
    cmd.ay = aim.y;
    if (ptr.down && aim.x === 0 && aim.y === 0) {
      cameraAt(world, world.player.x, world.player.y, cam);
      cmd.ax = ptr.x + cam.x - world.player.x;
      cmd.ay = ptr.y + cam.y - world.player.y;
    }
    cmd.fire = inp.held('a') || ptr.down;
    cmd.dash = inp.pressed('b');
    cmd.flare = inp.pressed('x');
    if (inp.pressed('y')) prog.openRig();
    if (inp.pressed('l')) prog.cycle(-1);
    if (inp.pressed('r')) prog.cycle(1);
  }

  function drainGained(): void {
    if (world.gainedN === 0) return;
    for (let i = 0; i < world.gainedN; i++) prog.give(world.gained[i]!);
    world.gainedN = 0;
    world.dropItems = prog.drops();
  }

  function drainCues(): void {
    for (let i = 0; i < world.outN; i++) {
      const c = world.out[i]!;
      const id = SFX_OF_CUE[c];
      if (id) ctx.chip.sfx(id);
      if (c === CUE.hurt) ctx.gfx.shake(world.rules.hurt_shake_px, 120);
      else if (c === CUE.kill) ctx.gfx.shake(world.rules.kill_shake_px, 60);
      else if (c === CUE.invertWarn) ctx.gfx.flash(31, 300);
      else if (c === CUE.dead) {
        ctx.gfx.flash(10, 300);
        ctx.gfx.fade(0.6, 900);
      }
    }
    world.outN = 0;
  }

  return {
    init() {
      content = loadContent(ctx);
      const plan = content.rooms.get('test_room');
      if (!plan) throw new Error('Deep Signal has no playable room. Check the console for what was dropped.');
      world = createWorld({
        rules: content.rules,
        rng: ctx.random.stream('shooter_sim'),
        madRng: ctx.random.stream('shooter_madness'),
        fxRng: ctx.random.stream('shooter_fx'),
        plan,
        defs: content.enemies,
        brains: content.brains,
        shot: { shots: [], onHit: 0, onKill: 0 },
        now: ctx.clock.nowMs(),
      });
      prog = createProgressControl(ctx, content, () => world);
      world.dropItems = prog.drops();
      prog.apply(world);
      music = createMusic(ctx);
      music.start(content.songs.get(`tier${plan.tier}`));
      if (content.problems.length) ctx.ui.notice(ctx.strings('content_problem'), 3000);
    },
    update() {
      const now = ctx.clock.nowMs();
      if (world.status === 'play') {
        readCommand();
        endedAt = now;
      } else {
        cmd.mx = cmd.my = cmd.ax = cmd.ay = 0;
        cmd.fire = cmd.dash = cmd.flare = false;
        if (world.status === 'dead' && now - endedAt > world.rules.restart_delay_ms) restart(now);
        else if (world.status === 'cleared' && ctx.input.pressed('a')) restart(now);
      }
      stepWorld(world, cmd, now);
      drainGained();
      if (world.status === 'cleared' && !banked) {
        banked = true;
        prog.progress.totalPoints += world.score + clearBonus(world);
        prog.save();
      }
      if (world.status !== 'play' && endedAt === 0) endedAt = now;
      drainCues();
      music.setWarped(tierOf(world.madness, world.rules) >= 2);
    },
    draw(alpha) {
      drawScene(ctx, world, alpha, prog.hud);
    },
    pause() {},
    shutdown() {
      music.dispose();
    },
  };

  function restart(now: number): void {
    resetWorld(world, now);
    banked = false;
    prog.apply(world);
    world.dropItems = prog.drops();
    ctx.gfx.fade(0, 300);
    endedAt = now;
  }
}

const mod: GameModule = {
  id: 'shooter',
  title: 'Deep Signal',
  blurb: 'Lantern-lit sci-fi shooter in a drowned station',
  touch: { aim: true },
  create,
};
export default mod;
