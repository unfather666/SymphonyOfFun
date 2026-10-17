// Shared test setup: real content files, a sim factory, and a mini schema check mirroring the core loader.
import type { Schema } from '../../../src/core/api';
import calamitiesJson from '../content/calamities/calamities.json';
import hazardsJson from '../content/hazards/hazards.json';
import powerupsJson from '../content/powerups/powerups.json';
import carJson from '../content/vehicles/car.json';
import levelsJson from '../content/levels/levels.json';
import propsJson from '../content/props/props.json';
import rulesJson from '../content/rules/rules.json';
import kindsJson from '../content/segments/segments.json';
import themesJson from '../content/themes/themes.json';
import { createSim, PHASE_RUN, stepSim, type Sim } from '../logic/sim';
import type { PatternDef } from '../logic/songgen';
import { ensure, segAt } from '../logic/track';
import { HZ_ALIVE, type CalamityDef, type DriveInput, type HazardDef, type KindDef, type LevelDef, type PowerDef, type Rules, type ThemeDef } from '../logic/types';

export const rules = rulesJson as unknown as Rules;
export const kinds = kindsJson as unknown as KindDef[];
export const themes = themesJson as unknown as ThemeDef[];
export const levels = levelsJson as unknown as LevelDef[];
export const hazards = hazardsJson as unknown as HazardDef[];
export const powers = powerupsJson as unknown as PowerDef[];
export const calamities = calamitiesJson as unknown as CalamityDef[];
export const props = propsJson as unknown as Array<{ id: string; parts: number[][] }>;
export const car = carJson as unknown as { id: string; states: number[][][] };

const patternFiles = import.meta.glob('../content/patterns/*.json', { eager: true }) as Record<string, { default: PatternDef[] }>;
export const patterns: PatternDef[] = Object.keys(patternFiles).sort().flatMap((f) => patternFiles[f]!.default);

export const themeOf = (level: LevelDef): ThemeDef => themes.find((t) => t.id === level.theme)!;

/** `bare` leaves hazards and pickups out, for tests of the road and the car alone. */
export function makeSim(seed: number, levelNo = 1, bpm?: number, meter = 4, bare = false): Sim {
  const level = levels.find((l) => l.no === levelNo)!;
  return createSim({ rules, level, theme: themeOf(level), kinds, hazards: bare ? [] : hazards, powers, calamities, runSeed: seed, bpm: bpm ?? level.bpm, meter });
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

/** Put hazard `id` on segment `index` (plain ground, mid-segment) in lane `lane`; returns the segment. */
export function plant(sim: Sim, id: string, index: number, lane = 0) {
  ensure(sim.track, index + 2);
  const seg = segAt(sim.track, index);
  seg.gap = false;
  seg.ramp = false;
  seg.drop = false;
  seg.hz = sim.hazards.findIndex((h) => h.id === id);
  if (seg.hz < 0) throw new Error(`no hazard ${id}`);
  seg.hzLane = lane;
  seg.hzT = 0.5;
  seg.hzPhase = 0;
  seg.hzState = HZ_ALIVE;
  seg.pk = -1;
  return seg;
}

/** Put pickup `id` on segment `index` in lane `lane`. */
export function plantPickup(sim: Sim, id: string, index: number, lane = 0) {
  ensure(sim.track, index + 2);
  const seg = segAt(sim.track, index);
  seg.hz = -1;
  seg.pk = sim.powers.findIndex((p) => p.id === id);
  if (seg.pk < 0) throw new Error(`no power ${id}`);
  seg.pkLane = lane;
  seg.pkT = 0.5;
  seg.pkState = HZ_ALIVE;
  return seg;
}

/** Step with accelerate held until the car passes segment `index`, the run stops being live, or `maxSteps` pass. */
export function driveTo(sim: Sim, index: number, steer = 0, maxSteps = 3000): void {
  const inp = idle();
  inp.accel = true;
  inp.steer = steer;
  for (let i = 0; i < maxSteps && sim.phase === PHASE_RUN && sim.car.s < index * sim.segLen; i++) stepSim(sim, inp, (sim.nowMs += 1000 / 60));
}
