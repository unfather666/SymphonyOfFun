// Shared test setup: real content files, a sim factory, and a mini schema check mirroring the core loader.
import type { Schema } from '../../../src/core/api';
import carJson from '../content/vehicles/car.json';
import levelsJson from '../content/levels/levels.json';
import propsJson from '../content/props/props.json';
import rulesJson from '../content/rules/rules.json';
import kindsJson from '../content/segments/segments.json';
import themesJson from '../content/themes/themes.json';
import { createSim, type Sim } from '../logic/sim';
import type { PatternDef } from '../logic/songgen';
import { ensure } from '../logic/track';
import type { DriveInput, KindDef, LevelDef, Rules, ThemeDef } from '../logic/types';

export const rules = rulesJson as unknown as Rules;
export const kinds = kindsJson as unknown as KindDef[];
export const themes = themesJson as unknown as ThemeDef[];
export const levels = levelsJson as unknown as LevelDef[];
export const props = propsJson as unknown as Array<{ id: string; parts: number[][] }>;
export const car = carJson as unknown as { id: string; states: number[][][] };

const patternFiles = import.meta.glob('../content/patterns/*.json', { eager: true }) as Record<string, { default: PatternDef[] }>;
export const patterns: PatternDef[] = Object.keys(patternFiles).sort().flatMap((f) => patternFiles[f]!.default);

export const themeOf = (level: LevelDef): ThemeDef => themes.find((t) => t.id === level.theme)!;

export function makeSim(seed: number, levelNo = 1, bpm?: number, meter = 4): Sim {
  const level = levels.find((l) => l.no === levelNo)!;
  return createSim({ rules, level, theme: themeOf(level), kinds, runSeed: seed, bpm: bpm ?? level.bpm, meter });
}

export const idle = (): DriveInput => ({ steer: 0, accel: false, accelPressed: false, brake: false, jumpPressed: false, usePressed: false });

/** Put the car at the start of segment `index` at cruise speed with the road generated around it. */
export function placeAt(sim: Sim, index: number): void {
  ensure(sim.track, index);
  sim.car.s = index * sim.segLen;
  sim.car.speed = sim.cruise;
}

/** Same checks the core loader applies: unknown keys, missing keys, types, ranges. Returns plain messages. */
export function validate(defs: readonly Record<string, unknown>[], schema: Schema): string[] {
  const out: string[] = [];
  for (const d of defs) {
    for (const k of Object.keys(d)) if (k !== 'id' && k !== 'tags' && k !== 'extends' && !(k in schema)) out.push(`${String(d.id)}: unknown field ${k}`);
    for (const [k, spec] of Object.entries(schema)) {
      const v = d[k];
      if (v === undefined) {
        if (!spec.optional) out.push(`${String(d.id)}: missing ${k}`);
        continue;
      }
      if (spec.type === 'number') {
        if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`${String(d.id)}: ${k} not a number`);
        else {
          if (spec.min !== undefined && v < spec.min) out.push(`${String(d.id)}: ${k}=${v} below ${spec.min}`);
          if (spec.max !== undefined && v > spec.max) out.push(`${String(d.id)}: ${k}=${v} above ${spec.max}`);
          if (spec.int && !Number.isInteger(v)) out.push(`${String(d.id)}: ${k} must be whole`);
        }
      } else if (spec.type === 'boolean' && typeof v !== 'boolean') out.push(`${String(d.id)}: ${k} not boolean`);
      else if (spec.type === 'id' && !(typeof v === 'string' && /^[a-z0-9_]+$/.test(v))) out.push(`${String(d.id)}: ${k} not an id`);
      else if (spec.type === 'string[]' && !(Array.isArray(v) && v.every((x) => typeof x === 'string'))) out.push(`${String(d.id)}: ${k} not text list`);
      else if (spec.type === 'id[]' && !(Array.isArray(v) && v.every((x) => typeof x === 'string' && /^[a-z0-9_]+$/.test(x)))) out.push(`${String(d.id)}: ${k} not id list`);
    }
  }
  return out;
}
