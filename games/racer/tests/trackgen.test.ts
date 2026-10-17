// Proves the road generator is stable (hash fixture), safe (no self-crossing, caps respected) and rule-abiding (racer M1, 2026-10-17).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { foldHash, HASH_START } from '../logic/rng';
import { createTrack, generateNext, restartAt, type Track } from '../logic/track';
import { DEG, type Segment } from '../logic/types';
import { kinds, rules, themes } from './helpers';

const FIXTURE = join(__dirname, 'fixtures', 'trackgen-hashes.json');
const BEATS = 400;

function makeTrack(seed: number, theme = themes[0]!): Track {
  return createTrack({ seed, kinds, theme, rules, segLen: 12, sectionBeats: 32, rampCooldown: 8 });
}

/** Copy of every segment for beats 0..n-1. */
function collect(t: Track, n: number): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const s = generateNext(t);
    out.push({ ...s, propType: s.propType.slice(), propX: s.propX.slice(), propT: s.propT.slice() });
  }
  return out;
}

function hashSegments(segs: readonly Segment[]): string {
  let h = HASH_START;
  for (const s of segs) {
    for (const v of [s.index, s.kind, s.x0, s.y0, s.z0, s.yaw0, s.pitch0, s.x1, s.y1, s.z1, s.halfWidth, +s.gap, +s.ramp, +s.tunnel, +s.split, +s.drop, ...s.propType, ...s.propX, ...s.propT]) h = foldHash(h, v);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('generator fixture', () => {
  const current: Record<string, string> = {};
  for (let seed = 1; seed <= 10; seed++) current[String(seed)] = hashSegments(collect(makeTrack(seed), BEATS));

  test('hashes for seeds 1..10 x 400 beats match the stored fixture', () => {
    if (process.env.UPDATE_FIXTURES === '1' || !existsSync(FIXTURE)) {
      mkdirSync(join(__dirname, 'fixtures'), { recursive: true });
      writeFileSync(FIXTURE, JSON.stringify(current, null, 1) + '\n');
    }
    expect(current).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });
  test('seeds differ from each other', () => {
    expect(new Set(Object.values(current)).size).toBe(10);
  });
  test('regenerating from a section snapshot gives the same road', () => {
    const t = makeTrack(3);
    const first = collect(t, 120);
    const start = restartAt(t, 70);
    expect(start).toBe(64);
    const again = collect(t, 56);
    expect(hashSegments(again)).toBe(hashSegments(first.slice(64, 120)));
  });
  test('the theme changes the road', () => {
    expect(hashSegments(collect(makeTrack(1, themes[6]!), 200))).not.toBe(hashSegments(collect(makeTrack(1, themes[0]!), 200)));
  });
});

describe('road shape rules', () => {
  const all = [] as Array<{ theme: string; seed: number; segs: Segment[] }>;
  for (const theme of themes) for (let seed = 1; seed <= 4; seed++) all.push({ theme: theme.id, seed, segs: collect(makeTrack(seed, theme), BEATS) });

  test('the first startSafeBeats segments are plain straights', () => {
    for (const { segs } of all) for (let i = 0; i < rules.startSafeBeats; i++) expect(kinds[segs[i]!.kind]!.id).toBe('straight');
  });
  test('heading and pitch stay inside their caps', () => {
    for (const { theme, seed, segs } of all) for (const s of segs) {
      expect(Math.abs(s.yaw1), `${theme}/${seed}@${s.index} yaw`).toBeLessThanOrEqual(rules.yawCapDeg * DEG + 1e-9);
      expect(Math.abs(s.pitch1), `${theme}/${seed}@${s.index} pitch`).toBeLessThanOrEqual(10 * DEG + 1e-9);
    }
  });
  test('every gap follows a ramp and is followed by a plain straight', () => {
    let gaps = 0;
    for (const { segs } of all) segs.forEach((s, i) => {
      if (!s.gap) return;
      gaps++;
      expect(segs[i - 1]!.ramp).toBe(true);
      expect(kinds[segs[i + 1]!.kind]!.id).toBe('straight');
    });
    expect(gaps).toBeGreaterThan(20);
  });
  test('no ramp starts inside the landing room after a gap', () => {
    for (const { segs } of all) segs.forEach((s, i) => {
      if (!s.gap) return;
      for (let k = 1; k <= 8; k++) if (segs[i + k]) expect(segs[i + k]!.ramp, `ramp ${k} beats after a gap`).toBe(false);
    });
  });
  test('no kind runs longer than its maxRun', () => {
    for (const { segs } of all) {
      let run = 1;
      for (let i = 1; i < segs.length; i++) {
        run = segs[i]!.kind === segs[i - 1]!.kind ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(kinds[segs[i]!.kind]!.maxRun);
      }
    }
  });
  test('all 11 kinds appear across the ten themes', () => {
    const seen = new Set<string>();
    for (const { segs } of all) for (const s of segs) seen.add(kinds[s.kind]!.id);
    expect([...seen].sort()).toEqual(kinds.map((k) => k.id).sort());
  });
  test('segments join end to start without seams', () => {
    for (const { segs } of all) for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1]!, b = segs[i]!;
      expect(b.x0).toBeCloseTo(a.x1, 9);
      expect(b.y0).toBeCloseTo(a.y1, 9);
      expect(b.z0).toBeCloseTo(a.z1, 9);
      expect(b.yaw0).toBeCloseTo(a.yaw1, 9);
    }
  });
});

describe('no self-intersection', () => {
  const cross = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) => {
    const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
    const d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  test('centre line never crosses itself within any 64-beat window, any theme, 10 seeds', () => {
    const crossings: string[] = [];
    for (const theme of themes) for (let seed = 1; seed <= 10; seed++) {
      const segs = collect(makeTrack(seed, theme), BEATS);
      for (let i = 0; i < segs.length; i++) for (let j = i + 2; j < Math.min(segs.length, i + 64); j++) {
        const a = segs[i]!, b = segs[j]!;
        if (cross(a.x0, a.z0, a.x1, a.z1, b.x0, b.z0, b.x1, b.z1)) crossings.push(`${theme.id}/${seed} ${i}x${j}`);
      }
    }
    expect(crossings).toEqual([]);
  });
  test('segments 6+ beats apart are further apart than a road is wide', () => {
    const segs = collect(makeTrack(5, themes[6]!), BEATS);
    const road = 2 * rules.halfRoadM * 1.5;
    let closest = Infinity;
    for (let i = 0; i < segs.length - 6; i++) for (let j = i + 6; j < Math.min(segs.length, i + 64); j++) closest = Math.min(closest, Math.hypot(segs[i]!.x0 - segs[j]!.x0, segs[i]!.z0 - segs[j]!.z0));
    expect(closest).toBeGreaterThan(road);
  });
});
