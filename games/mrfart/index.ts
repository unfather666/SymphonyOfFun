// Mr Fart: wires core to the sim and the renderer. No game rules live here.
import type { CoreContext, GameInstance, GameModule, SfxRecipe, SpriteDef, UiHandle } from '../../src/core/api';
import { SCREEN_H, SCREEN_W } from '../../src/core/api';
import { ENDING_SCHEMA, FART_SCHEMA, ITEM_SCHEMA, JOB_TYPE_SCHEMA, MODIFIER_SCHEMA, PERSON_SCHEMA, PLACE_SCHEMA, PROP_SCHEMA, SUBJECT_SCHEMA } from './content/schemas';
import mapJson from './content/map.json';
import rulesJson from './content/rules.json';
import { applyCheat } from './logic/cheats';
import { jobText } from './logic/jobs';
import type { Catalog } from './logic/jobs';
import type { JobTypeDef, ModifierDef, PlaceDef, SubjectDef } from './logic/jobTypes';
import { buyItem } from './logic/items';
import type { ItemDef } from './logic/items';
import { endRun } from './logic/endings';
import type { EndingDef } from './logic/endings';
import { abandonJob, startJob } from './logic/pipeline';
import { buildMap } from './logic/map';
import type { MapDef } from './logic/map';
import { parseRules } from './logic/rules';
import { createSim, stepSim } from './logic/sim';
import type { Sim } from './logic/sim';
import { STATUS_PLAYING } from './logic/types';
import type { FartDef, PersonDef, PropDef, SimInput } from './logic/types';
import { createRapierPhysics } from './physics/rapier/RapierPhysics';
import type { PhysicsApi } from './physics/PhysicsApi';
import { applyProgress, migrateProgress, OPTIONS_VERSION, PROGRESS_VERSION, sanitizeOptions, serializeProgress } from './logic/save';
import type { Options, Progress } from './logic/save';
import { PERSON_PREFIX, PLAYER_SPRITE, cameraFor, drawWorld } from './render/draw';
import { SIZES } from './render/jobs';
import type { View } from './render/draw';
import { drawHud } from './render/hud';
import { makeTileMap } from './render/tiles';

const SLOT = 'mrfart';
const AUTOSAVE_GAP_MS = 10000;
/** Touch has only A and B, so two taps on the HUD stand in for X (clench, toggle) and Y (use item). */
const TAP_METER = { x: 0, y: SCREEN_H - 18, w: 170, h: 18 };
const TAP_ITEM = { x: SCREEN_W - 130, y: SCREEN_H - 18, w: 130, h: 18 };

type SpriteFile = SpriteDef & { id: string; keys?: Record<string, number> };

function create(ctx: CoreContext): GameInstance {
  let sim: Sim | null = null;
  let physics: PhysicsApi | null = null;
  let view: View | null = null;
  let farts: FartDef[] = [];
  const unsubs: Array<() => void> = [];
  const input: SimInput = { mx: 0, my: 0, run: false, clench: false, interact: false };
  let catalog: Catalog | null = null;
  let items: ItemDef[] = [];
  let endings: EndingDef[] = [];
  let boot: (() => Promise<void>) | null = null;
  let options: Options = { hints: true };
  let lastSaveAt = -1e9;
  let touchClench = false;
  let fresh = true;

  function loadDefs<T>(kind: string, files: Record<string, unknown>, schema: Parameters<CoreContext['content']['load']>[2]): T[] {
    const reg = ctx.content.load(kind, files, schema);
    for (const e of reg.errors) ctx.log.warn(`content:${kind}:${e}`, e);
    return reg.all() as unknown as T[];
  }

  function openBoard(): void {
    if (!sim || !catalog) return;
    const s = sim, cat = catalog;
    let menu: UiHandle | null = null;
    const items = s.board.offers.map((o) => ({
      label: jobText(ctx.strings, cat, o),
      onPick: () => {
        menu?.close();
        if (s.job) abandonJob(s);
        if (!startJob(s, o)) ctx.ui.notice(ctx.strings('job_failed'));
      },
    }));
    if (s.job) items.unshift({ label: ctx.strings('board_abandon'), onPick: () => { menu?.close(); abandonJob(s); } });
    if (items.length === 0) items.push({ label: ctx.strings('board_none'), onPick: () => menu?.close() });
    menu = ctx.ui.menu({ title: ctx.strings('board_title'), items });
  }

  function openShop(): void {
    if (!sim) return;
    const s = sim;
    let menu: UiHandle | null = null;
    const name = (i: number) => ctx.strings(`item_${items[i]!.id}`);
    const rows = s.inv.stock.map((idx, slot) => ({
      label: `${name(idx)}  ${items[idx]!.price}`,
      onPick: () => {
        const price = items[idx]!.price;
        if (s.progress.coins < price) ctx.ui.notice(ctx.strings('shop_poor'), 1800);
        else if (s.inv.items.length >= s.deps.rules.items.max) ctx.ui.notice(ctx.strings('shop_full'), 1800);
        else if (buyItem(s, slot)) {
          ctx.chip.sfx('pickup');
          ctx.ui.notice(ctx.strings('shop_bought', { name: name(idx) }), 1800);
        }
        menu?.close();
      },
    }));
    if (rows.length === 0) rows.push({ label: ctx.strings('shop_none'), onPick: () => menu?.close() });
    rows.push({ label: ctx.strings('shop_leave'), onPick: () => menu?.close() });
    menu = ctx.ui.menu({ title: ctx.strings('shop_title'), items: rows });
  }

  /** Sprites are data: one file per sheet (or an array of them); each person gets the person sheet with their own colours. */
  function defineArt(people: readonly PersonDef[]): void {
    const files = import.meta.glob('./content/sprites/*.json', { eager: true }) as Record<string, { default: SpriteFile | SpriteFile[] }>;
    const sheets = new Map<string, SpriteFile>();
    for (const f of Object.keys(files)) for (const s of [files[f]!.default].flat()) sheets.set(s.id, s);
    for (const s of sheets.values()) {
      ctx.gfx.defineSprite(s.id, s);
      if (s.id.startsWith('subj_')) SIZES.set(s.id.slice(5), s.w);
    }
    const base = sheets.get('person');
    if (!base) return;
    const keys = (shirt: number, skin: number, hair: number) => ({ o: 2, w: 7, e: 2, d: 3, p: 3, s: shirt, k: skin, h: hair });
    people.forEach((p, i) => ctx.gfx.defineSprite(`${PERSON_PREFIX}${i}`, { w: base.w, h: base.h, frames: base.frames, keys: keys(p.shirt, p.skin, p.hair) }));
    ctx.gfx.defineSprite(PLAYER_SPRITE, { w: base.w, h: base.h, frames: base.frames, keys: keys(29, 15, 12) });
  }

  function save(): void {
    if (!sim || sim.status !== STATUS_PLAYING || sim.now - lastSaveAt < AUTOSAVE_GAP_MS) return;
    lastSaveAt = sim.now;
    const r = ctx.saves.save(SLOT);
    if (!r.ok) ctx.log.warn('save-write', r.message);
  }

  /** After an ending: throw the old world away and start a new run. */
  function restart(): void {
    physics?.dispose();
    sim = null;
    physics = null;
    ctx.saves.remove(SLOT);
    fresh = false;
    void boot?.().then(() => {
      if (sim) sim.options = options;
    });
  }

  return {
    async init() {
      const rules = parseRules(rulesJson);
      farts = loadDefs<FartDef>('fart', import.meta.glob('./content/farts/*.json', { eager: true }), FART_SCHEMA).sort((a, b) => a.min - b.min);
      const props = loadDefs<PropDef>('prop', import.meta.glob('./content/props/*.json', { eager: true }), PROP_SCHEMA);
      const people = loadDefs<PersonDef>('person', import.meta.glob('./content/people/*.json', { eager: true }), PERSON_SCHEMA);
      const types = loadDefs<JobTypeDef>('job_type', import.meta.glob('./content/job_types/*.json', { eager: true }), JOB_TYPE_SCHEMA);
      const subjects = loadDefs<SubjectDef>('subject', import.meta.glob('./content/subjects/*.json', { eager: true }), SUBJECT_SCHEMA);
      const places = loadDefs<PlaceDef>('place', import.meta.glob('./content/places/*.json', { eager: true }), PLACE_SCHEMA);
      const mods = loadDefs<ModifierDef>('modifier', import.meta.glob('./content/modifiers/*.json', { eager: true }), MODIFIER_SCHEMA);
      items = loadDefs<ItemDef>('item', import.meta.glob('./content/items/*.json', { eager: true }), ITEM_SCHEMA);
      endings = loadDefs<EndingDef>('ending', import.meta.glob('./content/endings/*.json', { eager: true }), ENDING_SCHEMA);
      catalog = { types, subjects, places, mods };
      if (farts.length === 0) throw new Error('Mr Fart cannot start: no valid fart kinds were loaded.');
      for (const f of farts) ctx.chip.defineSfx(`fart_${f.id}`, (f as unknown as { sfx: SfxRecipe }).sfx);
      defineArt(people);

      const cat = catalog;
      boot = async () => {
        physics = await createRapierPhysics({
          maxBodies: ctx.settings.reducedFx ? rules.caps.bodiesReduced : rules.caps.bodies,
          maxJoints: rules.caps.joints,
          warn: (k, m) => ctx.log.warn(`physics:${k}`, m),
        });
        const stream = (n: string) => ctx.random.stream(`mrfart:${n}`);
        sim = createSim({
          physics, rules, map: buildMap(mapJson as unknown as MapDef), farts, props, people, items, endings,
          rng: { fart: stream('fart'), fx: stream('fx'), people: stream('people'), notice: stream('notice'), jobs: stream('jobs'), items: stream('items') },
          catalog: cat,
          emit: (name, payload) => ctx.events.emit(name, payload),
          reducedFx: ctx.settings.reducedFx,
        });
        view = { tiles: makeTileMap(sim.deps.map), camX: 0, camY: 0 };
      };
      ctx.saves.register<Progress>({
        key: 'progress', version: PROGRESS_VERSION, serialize: () => (sim ? serializeProgress(sim) : migrateProgress({}, 1)),
        deserialize: (d) => { if (sim) applyProgress(sim, d); }, migrate: (d, from) => migrateProgress(d, from),
      });
      ctx.saves.register<Options>({
        key: 'options', version: OPTIONS_VERSION, serialize: () => options,
        deserialize: (d) => { options = sanitizeOptions(d); if (sim) sim.options = options; }, migrate: (d) => d as Options,
      });
      await boot();
      if (fresh && ctx.saves.has(SLOT)) {
        const r = ctx.saves.load(SLOT);
        if (!r.ok) ctx.log.warn('save-load', r.message);
      }
      if (sim) sim.options = options;
      // Dev / test door: ?ending=<id> jumps straight to that ending's screen.
      const want = new URLSearchParams(location.search).get('ending');
      if (want && sim) endRun(sim, want);
      unsubs.push(
        ctx.events.on('mrfart:midnight', () => save()),
        ctx.events.on('mrfart:job_done', (p) => {
          options.hints = false;
          if (sim) sim.options = options;
          save();
          ctx.chip.sfx('pickup');
          ctx.ui.notice(ctx.strings('reward', { rep: p.rep as number, coins: p.coins as number }), 2500);
        }),
        ctx.events.on('mrfart:job_failed', () => {
          ctx.chip.sfx('fail');
          ctx.ui.notice(ctx.strings('job_failed'), 2000);
        }),
        ctx.events.on('mrfart:step_done', () => ctx.chip.sfx('select')),
        ctx.events.on('mrfart:work_hit', () => ctx.chip.sfx('select')),
        ctx.events.on('mrfart:item_found', (p) => {
          ctx.chip.sfx('pickup');
          const it = items[p.item as number]!;
          ctx.ui.notice(it.cursed ? ctx.strings('found_gift') : ctx.strings('found_item', { name: ctx.strings(`item_${it.id}`) }), 2500);
        }),
        ctx.events.on('mrfart:game_over', () => { ctx.chip.sfx('fail'); ctx.saves.remove(SLOT); }),
        ctx.events.on('mrfart:game_won', () => { ctx.chip.sfx('pickup'); ctx.saves.remove(SLOT); }),
        ctx.events.on('dev:cheat', (p) => {
          if (sim) applyCheat(sim, String(p.id));
        }),
        ctx.events.on('mrfart:fart', (p) => {
          const def = farts[p.kind as number]!;
          ctx.chip.sfx(`fart_${def.id}`, { volume: def.volume, key: p.key as number, pitch: p.pitch as number });
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
      input.clench = ctx.input.held('x') || touchClench;
      input.interact = ctx.input.pressed('a');
      input.hold = ctx.input.held('a');
      input.use = ctx.input.pressed('y');
      input.cycle = ctx.input.pressed('l') ? -1 : ctx.input.pressed('r') ? 1 : 0;
      if (sim.status !== STATUS_PLAYING) {
        if (input.interact && boot) restart();
        else stepSim(sim, ctx.clock.nowMs(), input);
        return;
      }
      const ptr = ctx.input.pointer();
      if (ctx.input.device() === 'touch' && ptr.pressed) {
        const hit = (r: { x: number; y: number; w: number; h: number }) => ptr.x >= r.x && ptr.x < r.x + r.w && ptr.y >= r.y && ptr.y < r.y + r.h;
        if (hit(TAP_METER)) touchClench = !touchClench;
        else if (hit(TAP_ITEM)) {
          if (ptr.x < TAP_ITEM.x + 24) input.cycle = -1;
          else if (ptr.x > TAP_ITEM.x + TAP_ITEM.w - 24) input.cycle = 1;
          else input.use = true;
        }
      }
      stepSim(sim, ctx.clock.nowMs(), input);
      if (sim.wantShop) {
        sim.wantShop = false;
        openShop();
      }
      if (sim.wantBoard) {
        sim.wantBoard = false;
        openBoard();
      }
    },
    draw(alpha) {
      if (!sim || !view) {
        ctx.gfx.clear(2);
        ctx.gfx.drawText(ctx.strings('loading'), 192, 104, { colour: 7, align: 'center' });
        return;
      }
      cameraFor(sim, alpha, view);
      drawWorld(ctx.gfx, sim, view, alpha);
      drawHud(ctx.gfx, sim, (k, p) => ctx.strings(k, p), catalog ? (o) => jobText(ctx.strings, catalog!, o) : undefined, ctx.input.device() === 'touch', touchClench);
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
