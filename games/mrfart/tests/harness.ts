// Test helper: build a Sim from the real content JSON, on Rapier or the null stand-in.
import farts from '../content/farts/farts.json';
import props from '../content/props/props.json';
import people from '../content/people/people.json';
import mapJson from '../content/map.json';
import jobTypes from '../content/job_types/types.json';
import subjects from '../content/subjects/subjects.json';
import places from '../content/places/places.json';
import modifiers from '../content/modifiers/modifiers.json';
import items from '../content/items/items.json';
import endings from '../content/endings/endings.json';
import rulesJson from '../content/rules.json';
import { createNullPhysics } from '../physics/NullPhysics';
import { createRapierPhysics } from '../physics/rapier/RapierPhysics';
import { buildMap } from '../logic/map';
import type { Catalog } from '../logic/jobs';
import type { JobTypeDef, ModifierDef, PlaceDef, SubjectDef } from '../logic/jobTypes';
import type { ItemDef } from '../logic/items';
import type { EndingDef } from '../logic/endings';
import type { MapDef } from '../logic/map';
import { createRng } from '../logic/rng';
import { parseRules } from '../logic/rules';
import { createSim, stepSim } from '../logic/sim';
import type { Sim } from '../logic/sim';
import type { FartDef, PersonDef, PropDef, SimDeps, SimInput } from '../logic/types';
import { STEP_MS } from '../../../src/core/api';

export const rules = parseRules(rulesJson);
export const fartDefs = [...(farts as FartDef[])].sort((a, b) => a.min - b.min);
export const propDefs = props as PropDef[];
export const personDefs = people as unknown as PersonDef[];
export const mapDef = mapJson as unknown as MapDef;
export const IDLE: SimInput = { mx: 0, my: 0, run: false, clench: false, interact: false };
export const PRESS: SimInput = { ...IDLE, interact: true };
export const catalog: Catalog = { types: jobTypes as unknown as JobTypeDef[], subjects: subjects as unknown as SubjectDef[], places: places as unknown as PlaceDef[], mods: modifiers as unknown as ModifierDef[] };
export const itemDefs = items as unknown as ItemDef[];
export const endingDefs = endings as unknown as EndingDef[];

export interface MakeOpts {
  seed?: number;
  physics?: 'rapier' | 'null';
  map?: MapDef;
  people?: PersonDef[];
  rng?: Partial<SimDeps['rng']>;
}
export interface Made {
  sim: Sim;
  events: Array<{ name: string; payload: Record<string, number | string | boolean> }>;
  step(input?: SimInput, n?: number): void;
}

export async function makeSim(o: MakeOpts = {}): Promise<Made> {
  const seed = o.seed ?? 1;
  const physics = o.physics === 'null' ? createNullPhysics({ maxBodies: rules.caps.bodies }) : await createRapierPhysics({ maxBodies: rules.caps.bodies });
  const events: Made['events'] = [];
  const sim = createSim({
    physics, rules, map: buildMap(o.map ?? mapDef), farts: fartDefs, props: propDefs, people: o.people ?? personDefs, items: itemDefs, endings: endingDefs,
    rng: { fart: createRng(seed), fx: createRng(seed + 1), people: createRng(seed + 2), notice: createRng(seed + 3), jobs: createRng(seed + 4), items: createRng(seed + 5), ...o.rng },
    catalog,
    emit: (name, payload) => events.push({ name, payload }),
  });
  return {
    sim, events,
    step(input = IDLE, n = 1) {
      for (let i = 0; i < n; i++) stepSim(sim, (sim.steps + 1) * STEP_MS, input);
    },
  };
}
