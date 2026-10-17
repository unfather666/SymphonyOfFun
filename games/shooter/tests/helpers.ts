// Test helpers: load content JSON from disk, build worlds without the core.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compileBrains } from '../logic/brains';
import { parseRules } from '../logic/rules';
import { parseRoom, type RoomDef } from '../logic/room';
import { mulberry32 } from '../logic/rng';
import { DEFAULT_SHOT } from '../logic/shots';
import { makeCommand, stepWorld } from '../logic/sim';
import type { BrainDef, Command, EnemyDef, LevelPlan, World } from '../logic/types';
import { createWorld } from '../logic/world';

const root = join(__dirname, '..', 'content');
export const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(root, rel), 'utf8'));
export const readDefs = (dir: string): Array<Record<string, unknown>> =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const v = readJson(`${dir}/${f}`);
      return (Array.isArray(v) ? v : [v]) as Array<Record<string, unknown>>;
    });

export const RULES = parseRules(readJson('rules.json')).rules;
export const ENEMIES = readDefs('enemies') as unknown as EnemyDef[];
export const BRAIN_DEFS = readJson('brains.json') as BrainDef[];

export function roomPlan(id = 'test_room'): LevelPlan {
  const def = readDefs('rooms').find((r) => r.id === id) as unknown as RoomDef;
  const { plan, errors } = parseRoom(def);
  if (!plan) throw new Error(errors.join('; '));
  return plan;
}

export interface MakeOpts {
  seed?: number;
  /** Remove the room's waves so tests place enemies themselves. */
  noWaves?: boolean;
  extraBrains?: BrainDef[];
  plan?: LevelPlan;
}

export function makeWorld(o: MakeOpts = {}): World {
  const plan = o.plan ?? roomPlan();
  const p = o.noWaves ? { ...plan, rooms: plan.rooms.map((r) => ({ ...r, waves: [] })) } : plan;
  const brains = compileBrains([...BRAIN_DEFS, ...(o.extraBrains ?? [])]).brains;
  return createWorld({ rules: RULES, rng: mulberry32(o.seed ?? 1), fxRng: mulberry32((o.seed ?? 1) + 99), plan: p, defs: ENEMIES, brains, shot: DEFAULT_SHOT(RULES), now: 0 });
}

export const IDLE_BRAIN: BrainDef = { id: 'idle_test', tags: [], start: 'i', states: { i: { kind: 'idle', ms: 3_600_000, next: 'i' } } };

/** Step n times with the same command. now = stepNo * 1000/60. */
export function run(w: World, n: number, cmd: Command = makeCommand()): void {
  for (let i = 0; i < n; i++) stepWorld(w, cmd, (w.stepNo + 1) * (1000 / 60));
}
