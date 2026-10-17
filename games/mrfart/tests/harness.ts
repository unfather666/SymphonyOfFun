// Test helper: build a Sim from the real content JSON, on Rapier or the null stand-in.
import farts from '../content/farts/farts.json';
import props from '../content/props/props.json';
import people from '../content/people/people.json';
import mapJson from '../content/map.json';
import rulesJson from '../content/rules.json';
import { createNullPhysics } from '../physics/NullPhysics';
import { createRapierPhysics } from '../physics/rapier/RapierPhysics';
import { buildMap } from '../logic/map';
import type { MapDef } from '../logic/map';
import { createRng } from '../logic/rng';
import { parseRules } from '../logic/rules';
import { createSim, stepSim } from '../logic/sim';
import type { Sim } from '../logic/sim';
import type { FartDef, PersonDef, PropDef, SimInput } from '../logic/types';
import { STEP_MS } from '../../../src/core/api';

export const rules = parseRules(rulesJson);
export const fartDefs = [...(farts as FartDef[])].sort((a, b) => a.min - b.min);
export const propDefs = props as PropDef[];
export const personDefs = people as unknown as PersonDef[];
export const mapDef = mapJson as unknown as MapDef;
export const IDLE: SimInput = { mx: 0, my: 0, run: false, clench: false };

export interface MakeOpts {
  seed?: number;
  physics?: 'rapier' | 'null';
  map?: MapDef;
  people?: PersonDef[];
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
    physics, rules, map: buildMap(o.map ?? mapDef), farts: fartDefs, props: propDefs, people: o.people ?? personDefs,
    rng: { fart: createRng(seed), fx: createRng(seed + 1), people: createRng(seed + 2) },
    emit: (name, payload) => events.push({ name, payload }),
  });
  return {
    sim, events,
    step(input = IDLE, n = 1) {
      for (let i = 0; i < n; i++) stepSim(sim, (sim.steps + 1) * STEP_MS, input);
    },
  };
}
