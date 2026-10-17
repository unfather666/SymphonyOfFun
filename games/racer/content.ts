// Loads every content kind through the core loader. Broken defs are dropped with a message by the loader; the game still starts.
import type { CoreContext, Def } from '../../src/core/api';
import type { PatternDef } from './logic/songgen';
import type { CalamityDef, HazardDef, KindDef, LevelDef, PowerDef, Rules, ThemeDef } from './logic/types';
import { calamitySchema, hazardSchema, kindSchema, levelSchema, patternSchema, powerSchema, propSchema, rulesSchema, themeSchema, vehicleSchema } from './schemas';

export interface RacerContent {
  rules: Rules;
  kinds: KindDef[];
  themes: ThemeDef[];
  levels: LevelDef[];
  propDefs: Map<string, readonly (readonly number[])[]>;
  carStates: number[][][];
  hazards: HazardDef[];
  powers: PowerDef[];
  calamities: CalamityDef[];
  patterns: PatternDef[];
}

export function loadContent(ctx: CoreContext): RacerContent {
  const load = (kind: string, files: Record<string, unknown>, schema: Parameters<CoreContext['content']['load']>[2]) => ctx.content.load<Def>(kind, files, schema);
  const rules = load('rules', import.meta.glob('./content/rules/*.json', { eager: true }), rulesSchema).get('rules') as unknown as Rules;
  const props = load('prop', import.meta.glob('./content/props/*.json', { eager: true }), propSchema);
  const propDefs = new Map<string, readonly (readonly number[])[]>();
  for (const p of props.all()) propDefs.set(p.id, p.parts as number[][]);
  const vehicles = load('vehicle', import.meta.glob('./content/vehicles/*.json', { eager: true }), vehicleSchema);
  return {
    rules,
    kinds: load('segment', import.meta.glob('./content/segments/*.json', { eager: true }), kindSchema).all() as unknown as KindDef[],
    themes: load('theme', import.meta.glob('./content/themes/*.json', { eager: true }), themeSchema).all() as unknown as ThemeDef[],
    levels: load('level', import.meta.glob('./content/levels/*.json', { eager: true }), levelSchema).all() as unknown as LevelDef[],
    propDefs,
    carStates: (vehicles.get('car').states as number[][][]) ?? [],
    hazards: load('hazard', import.meta.glob('./content/hazards/*.json', { eager: true }), hazardSchema).all() as unknown as HazardDef[],
    powers: load('power', import.meta.glob('./content/powerups/*.json', { eager: true }), powerSchema).all() as unknown as PowerDef[],
    calamities: load('calamity', import.meta.glob('./content/calamities/*.json', { eager: true }), calamitySchema).all() as unknown as CalamityDef[],
    patterns: load('pattern', import.meta.glob('./content/patterns/*.json', { eager: true }), patternSchema).all() as unknown as PatternDef[],
  };
}
