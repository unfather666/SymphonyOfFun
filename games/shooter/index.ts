// Deep Signal: wiring only. Content loads through core, the sim runs from logic/, render/ draws.
import type { CoreContext, GameInstance, GameModule } from '../../src/core/api';
import { loadContent, type Content } from './content/load';
import { CUE } from './logic/cues';
import { mulberry32, type Rng } from './logic/rng';
import { clearBonus } from './logic/score';
import { generate, tierOfLevel, isBossLevel } from './logic/levelgen';
import { moveCursor, startCursor } from './logic/select';
import { levelPlayable } from './logic/unlocks';
import { drawLevelSelect } from './render/levelSelect';
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
  let simRng: Rng;
  let madRng: Rng;
  let fxRng: Rng;
  let scene: 'select' | 'play' = 'select';
  let level = 0;
  let cursor = 1;

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
      const fallback = content.rooms.get('test_room');
      const plan = content.tiers.length ? generate(1, content.tiers, genOpts()) : fallback;
      if (!plan) throw new Error('Deep Signal has no playable room. Check the console for what was dropped.');
      if (!content.tiers.length) scene = 'play';
      simRng = ctx.random.stream('shooter_sim');
      madRng = ctx.random.stream('shooter_madness');
      fxRng = ctx.random.stream('shooter_fx');
      world = createWorld({
        rules: content.rules,
        rng: simRng,
        madRng,
        fxRng,
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
      level = plan.level;
      cursor = startCursor(prog.progress.levelsCleared, prog.progress.totalPoints, world.rules.level_points_mult);
      music.start(content.songs.get(`tier${plan.tier}`));
      if (content.problems.length) ctx.ui.notice(ctx.strings('content_problem'), 3000);
    },
    update() {
      const now = ctx.clock.nowMs();
      if (scene === 'select') {
        selectInput(now);
        return;
      }
      if (world.status === 'play') {
        readCommand();
        endedAt = now;
      } else {
        cmd.mx = cmd.my = cmd.ax = cmd.ay = 0;
        cmd.fire = cmd.dash = cmd.flare = false;
        if (world.status === 'dead' && now - endedAt > world.rules.restart_delay_ms) restart(now);
        else if (ctx.input.pressed(world.status === 'cleared' ? 'a' : 'b')) toSelect();
      }
      stepWorld(world, cmd, now);
      drainGained();
      if (world.status === 'cleared' && !banked) {
        banked = true;
        prog.bank(level, world.score + clearBonus(world));
      }
      if (world.status !== 'play' && endedAt === 0) endedAt = now;
      drainCues();
      music.setWarped(tierOf(world.madness, world.rules) >= 2);
    },
    draw(alpha) {
      if (scene === 'select') drawLevelSelect(ctx, cursor, prog.progress, world.rules.level_points_mult);
      else drawScene(ctx, world, alpha, prog.hud);
    },
    pause() {},
    shutdown() {
      music.dispose();
    },
  };

  function genOpts() {
    return { eliteEvery: content.rules.elite_every, hpStep: content.rules.level_hp_step };
  }

  function selectInput(now: number): void {
    const inp = ctx.input;
    const dx = (inp.pressed('right') ? 1 : 0) - (inp.pressed('left') ? 1 : 0);
    const dy = (inp.pressed('down') ? 1 : 0) - (inp.pressed('up') ? 1 : 0);
    if (dx || dy) cursor = moveCursor(cursor, dx, dy);
    if (inp.pressed('y')) prog.openRig();
    if (inp.pressed('a')) {
      if (levelPlayable(cursor, prog.progress.totalPoints, world.rules.level_points_mult)) startLevel(cursor, now);
      else ctx.chip.sfx('ds_hurt');
    }
  }

  function startLevel(n: number, now: number): void {
    const plan = generate(n, content.tiers, genOpts());
    world = createWorld({
      rules: content.rules,
      rng: simRng,
      madRng: madRng,
      fxRng: fxRng,
      plan,
      defs: content.enemies,
      brains: content.brains,
      shot: { shots: [], onHit: 0, onKill: 0 },
      now,
    });
    level = n;
    scene = 'play';
    banked = false;
    prog.apply(world);
    world.dropItems = prog.drops();
    music.start(content.songs.get(isBossLevel(n) ? 'boss' : `tier${tierOfLevel(n)}`));
    ctx.gfx.fade(0, 300);
    endedAt = now;
  }

  function toSelect(): void {
    scene = 'select';
    cursor = level >= 1 && world.status === 'cleared' ? Math.min(100, level + 1) : Math.max(1, level);
    if (!levelPlayable(cursor, prog.progress.totalPoints, world.rules.level_points_mult)) cursor = Math.max(1, level);
    ctx.gfx.fade(0, 300);
  }

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
