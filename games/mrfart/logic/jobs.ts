// Job generator and board: what is on offer, at which absurdity tier. Pure given content, map and a seeded stream.
import type { JobOffer, JobTypeDef, ModifierDef, PlaceDef, SubjectDef } from './jobTypes';
import type { MapData } from './map';
import type { Rng } from './rng';
import type { Rules } from './rules';
import { placeZone } from './zones';

export interface Catalog {
  types: readonly JobTypeDef[];
  subjects: readonly SubjectDef[];
  places: readonly PlaceDef[];
  mods: readonly ModifierDef[];
}

/** Absurdity tier: floor(tasksDone / tierEvery) up to maxTier; past mixAfter tasks a mix with a bias to the top. */
export function tierFor(tasksDone: number, rules: Rules['jobs'], rng: Rng): number {
  if (tasksDone < rules.mixAfter) return Math.min(rules.maxTier, Math.floor(tasksDone / rules.tierEvery));
  return Math.max(0, rules.maxTier - Math.floor(rng.float() * rng.float() * (rules.maxTier + 1)));
}

/** How many: always 1 at the lowest tiers; from tier 2 two at countChance2, from tier 3 three at countChance3. */
export function countFor(tier: number, maxCount: number, rules: Rules['jobs'], rng: Rng): number {
  let c = 1;
  if (tier >= 2 && rng.chance(rules.countChance2)) c = 2;
  if (tier >= 3 && rng.chance(rules.countChance3)) c = 3;
  return Math.min(c, maxCount);
}

const ORIGIN_KINDS = ['house', 'shop', 'grandma'];
const scratch = { x: 0, y: 0, r: 0 };

/** Cells a job can start from, nearest to (x,y) first. */
export function originCandidates(map: MapData, x: number, y: number, limit: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < map.cells.length; i++) if (ORIGIN_KINDS.includes(map.cells[i]!.kind)) idx.push(i);
  const d = (i: number) => Math.hypot(map.cells[i]!.doorX - x, map.cells[i]!.doorY - y);
  idx.sort((a, b) => d(a) - d(b) || a - b);
  return idx.slice(0, limit);
}

/** A modifier index for the tier, or -1. The chance is always rolled so the stream stays the same at every tier. */
export function modFor(cat: Catalog, tier: number, chance: number, rng: Rng): number {
  const hit = rng.chance(chance);
  const ok: number[] = [];
  for (let i = 0; i < cat.mods.length; i++) if (cat.mods[i]!.minTier <= tier) ok.push(i);
  return hit && ok.length > 0 ? ok[rng.int(0, ok.length - 1)]! : -1;
}

export function generateOffer(cat: Catalog, map: MapData, rules: Rules, rng: Rng, tasksDone: number, x: number, y: number): JobOffer | null {
  const jr = rules.jobs;
  const tier = tierFor(tasksDone, jr, rng);
  const origins = originCandidates(map, x, y, jr.originCells);
  if (origins.length === 0) return null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const ti = rng.int(0, cat.types.length - 1);
    const type = cat.types[ti]!;
    if ((type.minTier ?? 0) > tier) continue;
    // Subjects of this tier that fit; step down a tier when none do.
    let pool: number[] = [];
    for (let t = tier; t >= 0 && pool.length === 0; t--)
      for (let i = 0; i < cat.subjects.length; i++) {
        const s = cat.subjects[i]!;
        if (s.tier === t && type.subjectTags.some((g) => s.tags.includes(g))) pool.push(i);
      }
    if (pool.length === 0) continue;
    const subject = pool[rng.int(0, pool.length - 1)]!;
    const origin = origins[rng.int(0, origins.length - 1)]!;
    const options: number[] = [];
    for (const pid of type.places) {
      const pi = cat.places.findIndex((p) => p.id === pid);
      if (pi >= 0 && placeZone(map, cat.places[pi]!, origin, jr.zoneR, scratch)) options.push(pi);
    }
    if (options.length === 0) continue;
    const st = cat.subjects[subject]!.tier;
    const place = options[rng.int(0, options.length - 1)]!;
    const count = countFor(st, type.maxCount, jr, rng);
    return { type: ti, subject, place, count, mod: modFor(cat, st, jr.modChance, rng), tier: st, origin };
  }
  return null;
}

/** Plain-English text for an offer, all words from strings. `str` is ctx.strings. */
export function jobText(str: (key: string, params?: Record<string, string | number>) => string, cat: Catalog, o: JobOffer): string {
  const type = cat.types[o.type]!, subj = cat.subjects[o.subject]!, place = cat.places[o.place]!;
  const text = str(type.textKey, {
    count: o.count,
    subject: str(o.count === 1 ? `subject_${subj.id}` : `subject_${subj.id}_pl`),
    place: str(`place_${place.id}`),
    from: str(`from_${place.id}`),
    at: str(`at_${place.id}`),
  });
  return o.mod >= 0 ? `${text} ${str(`mod_${cat.mods[o.mod]!.id}`)}` : text;
}
