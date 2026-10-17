// Loads every def kind through core and returns plain arrays for the sim. Broken defs are dropped by the loader and logged here.
import type { CoreContext } from '../../../src/core/api';
import { compileBrains } from '../logic/brains';
import { parseRules, type Rules } from '../logic/rules';
import { parseRoom, type RoomDef } from '../logic/room';
import type { BrainDef, CBrain, EnemyDef, LevelPlan } from '../logic/types';
import rulesRaw from './rules.json';
import type { ItemDef } from '../logic/rig';
import type { Unlocks } from '../logic/unlocks';
import unlocksRaw from './unlocks.json';
import { BRAIN_SCHEMA, ENEMY_SCHEMA, ITEM_SCHEMA, ROOM_SCHEMA, SFX_SCHEMA, SPRITE_SCHEMA } from './schemas';

export interface Content {
  rules: Rules;
  enemies: EnemyDef[];
  brains: Map<string, CBrain>;
  rooms: Map<string, LevelPlan>;
  items: ItemDef[];
  unlocks: Unlocks;
  problems: string[];
}

export function loadContent(ctx: CoreContext): Content {
  const problems: string[] = [];
  const rules = parseRules(rulesRaw);
  problems.push(...rules.errors);

  const enemies = ctx.content.load('enemy', import.meta.glob('./enemies/*.json', { eager: true }), ENEMY_SCHEMA);
  const brainReg = ctx.content.load('brain', import.meta.glob('./brains.json', { eager: true }), BRAIN_SCHEMA);
  const compiled = compileBrains(brainReg.all() as unknown as BrainDef[]);
  problems.push(...compiled.errors);

  const sprites = ctx.content.load('sprite', import.meta.glob('./sprites/*.json', { eager: true }), SPRITE_SCHEMA);
  for (const s of sprites.all()) ctx.gfx.defineSprite(s.id, s as never);

  const sfx = ctx.content.load('sfx', import.meta.glob('./sfx.json', { eager: true }), SFX_SCHEMA);
  for (const s of sfx.all()) ctx.chip.defineSfx(s.id, s as never);

  const roomReg = ctx.content.load('room', import.meta.glob('./rooms/*.json', { eager: true }), ROOM_SCHEMA);
  const rooms = new Map<string, LevelPlan>();
  for (const r of roomReg.all()) {
    const parsed = parseRoom(r as unknown as RoomDef);
    problems.push(...parsed.errors);
    if (parsed.plan) rooms.set(r.id, parsed.plan);
  }

  const itemReg = ctx.content.load('item', import.meta.glob('./weapons/*.json', { eager: true }), ITEM_SCHEMA);
  const items = itemReg.all() as unknown as ItemDef[];

  problems.push(...itemReg.errors, ...enemies.errors, ...brainReg.errors, ...sprites.errors, ...sfx.errors, ...roomReg.errors);
  for (const p of problems) ctx.log.warn(`content:${p.slice(0, 60)}`, p);
  return { rules: rules.rules, enemies: enemies.all() as unknown as EnemyDef[], brains: compiled.brains, rooms, items, unlocks: unlocksRaw as Unlocks, problems };
}
