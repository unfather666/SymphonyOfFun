// Per-tier level tables (content/levels.json): enemy mix, darkness, wave counts, light tricks, bosses. Validated here, never trusted.
import type { ScriptEntry } from './types';

export interface TierEnemy {
  def: string;
  weight: number;
  /** Spawned together in a tight group (spawnlings come eight at a time). */
  pack?: number;
}
export interface TierTable {
  id: string;
  tier: number;
  ambient: number;
  tint: string;
  waves: number;
  waveSize: number;
  enemies: TierEnemy[];
  tricks: Array<ScriptEntry['kind']>;
  scriptEntries: number;
  pillars: number;
  water: number;
  boss?: string;
  finalBoss?: string;
  bossMinions?: Array<{ def: string; count: number }>;
}

const TRICKS = ['blackout', 'spotlight', 'strobe', 'pulse'];

/** Check raw tables against the known enemy ids. Returns all 10 tiers (a broken tier borrows the nearest valid one below) and plain-English problems. */
export function compileTiers(raw: readonly TierTable[], enemyIds: ReadonlySet<string>): { tiers: TierTable[]; errors: string[] } {
  const errors: string[] = [];
  const byTier = new Map<number, TierTable>();
  for (const t of raw) {
    const bad: string[] = [];
    if (!/^#[0-9a-f]{6}$/i.test(t.tint)) bad.push(`tint "${t.tint}" is not #rrggbb`);
    if (!Array.isArray(t.enemies) || t.enemies.length === 0) bad.push('no enemies');
    else
      for (const e of t.enemies) {
        if (!enemyIds.has(e.def)) bad.push(`unknown enemy "${e.def}"`);
        if (!(e.weight > 0)) bad.push(`enemy "${e.def}" needs a weight above 0`);
        if (e.pack !== undefined && !(Number.isInteger(e.pack) && e.pack >= 1 && e.pack <= 16)) bad.push(`enemy "${e.def}" pack must be 1..16`);
      }
    if (!Array.isArray(t.tricks) || t.tricks.some((k) => !TRICKS.includes(k))) bad.push('tricks must be blackout, spotlight, strobe or pulse');
    else if (t.scriptEntries > 0 && t.tricks.length === 0) bad.push('scriptEntries above 0 needs at least one trick');
    for (const id of [t.boss, t.finalBoss]) if (id !== undefined && !enemyIds.has(id)) bad.push(`unknown boss "${id}"`);
    for (const m of t.bossMinions ?? []) if (!enemyIds.has(m.def) || !(Number.isInteger(m.count) && m.count >= 1 && m.count <= 12)) bad.push(`boss minion "${m.def}" is invalid`);
    if (byTier.has(t.tier)) bad.push(`tier ${t.tier} is defined twice`);
    if (bad.length) errors.push(`level table "${t.id}" dropped: ${bad.join('; ')}.`);
    else byTier.set(t.tier, t);
  }
  const tiers: TierTable[] = [];
  for (let i = 0; i < 10; i++) {
    let t = byTier.get(i);
    if (!t) {
      for (let j = i - 1; j >= 0 && !t; j--) t = byTier.get(j);
      if (t) errors.push(`level table for tier ${i} is missing; using tier ${t.tier}.`);
    }
    if (t) tiers.push(t);
  }
  return { tiers: tiers.length === 10 ? tiers : [], errors };
}
