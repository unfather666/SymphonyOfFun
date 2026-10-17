// Mr Fart: wires core to the sim and the renderer. No game rules live here.
import type { CoreContext, GameInstance, GameModule, SfxRecipe, SpriteDef } from '../../src/core/api';
import { FART_SCHEMA, PERSON_SCHEMA, PROP_SCHEMA } from './content/schemas';
import mapJson from './content/map.json';
import rulesJson from './content/rules.json';
import { applyCheat } from './logic/cheats';
import { buildMap } from './logic/map';
import type { MapDef } from './logic/map';
import { parseRules } from './logic/rules';
import { createSim, stepSim } from './logic/sim';
import type { Sim } from './logic/sim';
import type { FartDef, PersonDef, PropDef, SimInput } from './logic/types';
import { createRapierPhysics } from './physics/rapier/RapierPhysics';
import type { PhysicsApi } from './physics/PhysicsApi';
import { cameraFor, drawWorld } from './render/draw';
import type { View } from './render/draw';
import { drawHud } from './render/hud';
import { makeTileMap } from './render/tiles';

function create(ctx: CoreContext): GameInstance {
  let sim: Sim | null = null;
  let physics: PhysicsApi | null = null;
  let view: View | null = null;
  let farts: FartDef[] = [];
  const unsubs: Array<() => void> = [];
  const input: SimInput = { mx: 0, my: 0, run: false, clench: false };

  function loadDefs<T>(kind: string, files: Record<string, unknown>, schema: Parameters<CoreContext['content']['load']>[2]): T[] {
    const reg = ctx.content.load(kind, files, schema);
    for (const e of reg.errors) ctx.log.warn(`content:${kind}:${e}`, e);
    return reg.all() as unknown as T[];
  }

  return {
    async init() {
      const rules = parseRules(rulesJson);
      farts = loadDefs<FartDef>('fart', import.meta.glob('./content/farts/*.json', { eager: true }), FART_SCHEMA).sort((a, b) => a.min - b.min);
      const props = loadDefs<PropDef>('prop', import.meta.glob('./content/props/*.json', { eager: true }), PROP_SCHEMA);
      const people = loadDefs<PersonDef>('person', import.meta.glob('./content/people/*.json', { eager: true }), PERSON_SCHEMA);
      if (farts.length === 0) throw new Error('Mr Fart cannot start: no valid fart kinds were loaded.');
      for (const f of farts) ctx.chip.defineSfx(`fart_${f.id}`, (f as unknown as { sfx: SfxRecipe }).sfx);
      const sprites = import.meta.glob('./content/sprites/*.json', { eager: true }) as Record<string, { default: SpriteDef & { id: string } }>;
      for (const file of Object.keys(sprites)) ctx.gfx.defineSprite(sprites[file]!.default.id, sprites[file]!.default);

      physics = await createRapierPhysics({
        maxBodies: ctx.settings.reducedFx ? rules.caps.bodiesReduced : rules.caps.bodies,
        maxJoints: rules.caps.joints,
        warn: (k, m) => ctx.log.warn(`physics:${k}`, m),
      });
      const stream = (n: string) => ctx.random.stream(`mrfart:${n}`);
      sim = createSim({
        physics, rules, map: buildMap(mapJson as unknown as MapDef), farts, props, people,
        rng: { fart: stream('fart'), fx: stream('fx'), people: stream('people'), notice: stream('notice') },
        emit: (name, payload) => ctx.events.emit(name, payload),
        reducedFx: ctx.settings.reducedFx,
      });
      view = { tiles: makeTileMap(sim.deps.map), camX: 0, camY: 0 };
      unsubs.push(
        ctx.events.on('dev:cheat', (p) => {
          if (sim) applyCheat(sim, String(p.id));
        }),
        ctx.events.on('mrfart:fart', (p) => {
          const def = farts[p.kind as number]!;
          ctx.chip.sfx(`fart_${def.id}`, { volume: def.volume });
          if (def.shake > 0) ctx.gfx.shake(def.shake, 260);
        }),
      );
    },
    update() {
      if (!sim) return;
      const a = ctx.input.axis('move');
      input.mx = a.x;
      input.my = a.y;
      input.run = ctx.input.held('b');
      input.clench = ctx.input.held('x');
      stepSim(sim, ctx.clock.nowMs(), input);
    },
    draw(alpha) {
      if (!sim || !view) {
        ctx.gfx.clear(2);
        ctx.gfx.drawText(ctx.strings('loading'), 192, 104, { colour: 7, align: 'center' });
        return;
      }
      cameraFor(sim, alpha, view);
      drawWorld(ctx.gfx, sim, view, alpha);
      drawHud(ctx.gfx, sim, (k, p) => ctx.strings(k, p));
    },
    pause() {},
    shutdown() {
      for (const u of unsubs) u();
      unsubs.length = 0;
      physics?.dispose();
      sim = null;
      physics = null;
    },
  };
}

const mod: GameModule = {
  id: 'mrfart',
  title: 'Mr Fart',
  blurb: 'Everything you do makes you fart. Stay socially acceptable. Somehow.',
  touch: { aim: false },
  create,
};
export default mod;
