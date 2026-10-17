// Proves the assembler respects tempo, meter, harmony mode and intensity, is deterministic, and builds 5:00 songs (racer M2, 2026-10-17).
import { describe, expect, test } from 'vitest';
import { assemble, chooseMeter, eligible, isBreak, KEYS, rolesFor, songMs, ROLES, type PatternDef, type SongOut } from '../logic/songgen';
import { intensityAt, levelBars } from '../logic/level';
import { levels, patterns, rules } from './helpers';

const build = (levelNo: number, seed: number, meter = 4): SongOut => {
  const l = levels.find((x) => x.no === levelNo)!;
  return assemble({ levelNo, runSeed: seed, bpm: l.bpm, meter, lengthBars: levelBars(rules.levelSeconds, l.bpm, meter), sectionBars: rules.sectionBars, patterns });
};
const byId = new Map(patterns.map((p) => [p.id, p]));

describe('library', () => {
  test('every pattern is well formed', () => {
    for (const p of patterns) {
      const per = (p.meter ?? 4) * 4;
      expect(p.steps.length, p.id).toBe(per * 4);
      expect(p.bpmMin, p.id).toBeLessThan(p.bpmMax);
      for (const v of p.steps) expect(Number.isInteger(v) && v >= -1 && v <= 127, `${p.id} ${v}`).toBe(true);
      if (p.role === 'drums') for (const v of p.steps) expect(v <= 5, `${p.id} drum code ${v}`).toBe(true);
      expect(p.steps[0], `${p.id} must start on a note or hit, never a hold`).not.toBe(-1);
    }
  });
  test('every level bpm has at least one pattern for every role', () => {
    for (const l of levels) for (const role of ROLES) expect(patterns.some((p) => eligible(p, role, l.bpm, 4, 'any')), `L${l.no} ${role}`).toBe(true);
  });
});

describe('assemble', () => {
  test('never picks a pattern outside its bpm range, meter or section mode (1000 seeds, all levels)', () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= 1000; seed++) {
      const l = levels[seed % levels.length]!;
      const song = build(l.no, seed);
      song.picks.forEach((pk, i) => {
        for (const [role, id] of Object.entries(pk.ids)) {
          const p = byId.get(id!) as PatternDef;
          if (p.role !== role) bad.push(`${id} used as ${role}`);
          if (l.bpm < p.bpmMin || l.bpm > p.bpmMax) bad.push(`${id} at ${l.bpm} bpm outside ${p.bpmMin}-${p.bpmMax}`);
          if (p.mode !== 'any' && p.mode !== pk.mode) bad.push(`${id} mode ${p.mode} in ${pk.mode} section ${i}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
  test('each level song is 5:00 within one bar', () => {
    for (const l of levels) {
      const s = build(l.no, 5);
      const oneBar = (4 * 60000) / l.bpm;
      expect(Math.abs(songMs(s) - 300000)).toBeLessThanOrEqual(oneBar);
      expect(s.sections.reduce((n, x) => n + x.bars, 0)).toBe(levelBars(300, l.bpm, 4));
    }
  });
  test('is deterministic per (level, seed) and varies with the seed', () => {
    expect(build(3, 9)).toEqual(build(3, 9));
    expect(build(3, 9).picks).not.toEqual(build(3, 10).picks);
  });
  test('transposes melodic roles by the section key and leaves drums alone', () => {
    const s = build(2, 4);
    s.sections.forEach((sec, i) => {
      const pk = s.picks[i]!;
      for (const role of ROLES) {
        const id = pk.ids[role];
        if (!id) continue;
        const src = byId.get(id)!.steps;
        const out = sec.patterns[role]!;
        for (let k = 0; k < src.length; k++) {
          if (role === 'drums' || src[k]! <= 0) expect(out[k]).toBe(src[k]);
          else expect(out[k]).toBe(src[k]! + pk.key);
        }
      }
    });
    for (const pk of s.picks) expect(KEYS.map((k) => (k > 6 ? k - 12 : k))).toContain(pk.key);
  });
  test('intensity decides which roles play: thin start, no drums in the break, everything at the peak', () => {
    const s = build(1, 7);
    const n = s.sections.length;
    expect(Object.keys(s.sections[0]!.patterns).sort()).toEqual(['bass', 'drums']);
    const br = s.sections.findIndex((_, i) => isBreak(i, n));
    expect(br).toBeGreaterThan(0);
    expect(s.sections[br]!.patterns.drums).toBeUndefined();
    expect(Object.keys(s.sections[n - 2]!.patterns).sort()).toEqual(['bass', 'drums', 'lead', 'pad']);
    expect(rolesFor(intensityAt(0, n), false)).toEqual(['drums', 'bass']);
  });
  test('the last section holds the remainder bars', () => {
    const s = build(1, 7);
    const total = levelBars(300, 100, 4);
    expect(s.sections[s.sections.length - 1]!.bars).toBe(total - 8 * (s.sections.length - 1));
  });
  test('meter 3 is only chosen when waltz patterns exist for every role', () => {
    expect(chooseMeter(1, 1, 10, patterns)).toBe(patterns.some((p) => p.meter === 3) ? 3 : 4);
    const waltz: PatternDef[] = ROLES.map((role) => ({ id: `w_${role}`, role, genre: 'waltz', mode: 'any', bpmMin: 60, bpmMax: 200, meter: 3, steps: new Array(48).fill(0) }));
    expect(chooseMeter(1, 1, 10, [...patterns, ...waltz])).toBe(3);
    expect(chooseMeter(0, 1, 10, [...patterns, ...waltz])).toBe(4);
  });
});
