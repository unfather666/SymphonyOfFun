// Proves each light trick (blackout, spotlight, strobe, pulse) on a scripted room, wave triggers, spotlight spawns, and the song content. Area: logic/lightscript, rooms, songs. 2026-10-17
import { describe, expect, test } from 'vitest';
import { SONG_SCHEMA } from '../content/schemas';
import type { ScriptEntry } from '../logic/types';
import { spawnEnemy } from '../logic/world';
import { CUE, RULES, makeWorld, readDefs, roomPlan, run, runCollect } from './helpers';
import { problemsOf } from './schemaCheck';

function scripted(script: ScriptEntry[], noWaves = true) {
  const plan = { ...roomPlan(), script };
  return makeWorld({ plan, noWaves });
}
const BASE = roomPlan().ambient;

describe('light tricks', () => {
  test('blackout: ambient 0.98 for its duration, then back to the room base', () => {
    const w = scripted([{ atMs: 100, kind: 'blackout', ms: 500 }]);
    const cues = runCollect(w, 3);
    expect(w.light.ambient).toBe(BASE);
    expect(cues).not.toContain(CUE.blackout);
    const cues2 = runCollect(w, 12);
    expect(cues2).toContain(CUE.blackout);
    expect(w.light.ambient).toBe(RULES.ambient_blackout);
    run(w, 40);
    expect(w.light.ambient).toBe(BASE);
  });
  test('spotlight: ambient 0.97, the circle is reported, lantern cone is dropped', () => {
    const w = scripted([{ atMs: 0, kind: 'spotlight', x: 240, y: 150, r: 52, ms: 1000 }]);
    run(w, 5);
    expect(w.light.spotOn).toBe(true);
    expect([w.light.spotX, w.light.spotY, w.light.spotR]).toEqual([240, 150, 52]);
    expect(w.light.ambient).toBe(RULES.spot_ambient);
    run(w, 70);
    expect(w.light.spotOn).toBe(false);
  });
  test('strobe: flips on and off at its rate (6 Hz toggles 6 times in a second)', () => {
    const w = scripted([{ atMs: 0, kind: 'strobe', ms: 1000, hz: 6 }]);
    let flips = 0;
    let prev = false;
    for (let i = 0; i < 58; i++) {
      run(w, 1);
      if (w.light.strobeOn !== prev) flips++;
      prev = w.light.strobeOn;
    }
    expect(flips).toBe(6);
  });
  test('pulse: ambient breathes above base, a heartbeat cue fires each cycle', () => {
    const w = scripted([{ atMs: 0, kind: 'pulse', ms: 2000 }]);
    let peak = BASE;
    const cues = runCollect(w, 100, undefined, (x) => void (peak = Math.max(peak, x.light.ambient)));
    expect(cues.filter((c) => c === CUE.heartbeat).length).toBe(2);
    expect(peak).toBeGreaterThan(BASE + 0.1);
    expect(peak).toBeLessThanOrEqual(BASE + RULES.pulse_amount + 1e-9);
  });
  test('a flare beats a blackout', () => {
    const w = scripted([{ atMs: 0, kind: 'blackout', ms: 5000 }]);
    run(w, 5);
    expect(w.light.ambient).toBe(RULES.ambient_blackout);
    w.player.flareUntil = w.now + 3000;
    run(w, 1);
    expect(w.light.ambient).toBe(RULES.ambient_flare);
  });
  test('entries fire in order once, by wave count: the second wave arrives inside the spotlight', () => {
    const plan = roomPlan();
    plan.script = [{ atWave: 2, kind: 'spotlight', x: 240, y: 150, r: 52, ms: 60000 }];
    const w = makeWorld({ plan });
    run(w, 3);
    expect(w.light.spotOn).toBe(false);
    w.enemies.clear();
    for (let i = 0; i < 200 && w.waveCount < 2; i++) run(w, 1);
    expect(w.waveCount).toBe(2);
    expect(w.light.spotOn).toBe(true);
    for (let i = 0; i < w.enemies.n; i++) {
      const e = w.enemies.live[i]!;
      expect(Math.hypot(e.x - 240, e.y - 150)).toBeLessThanOrEqual(52 * 0.7 + 1);
    }
    expect(w.enemies.n).toBe(7);
  });
});

describe('songs', () => {
  const songs = readDefs('songs');
  test('11 songs: one per tier plus the boss, valid per the schema', () => {
    expect(songs.map((s) => s.id).sort()).toEqual(['boss', ...Array.from({ length: 10 }, (_, i) => `tier${i}`)].sort());
    for (const s of songs) expect(problemsOf(s, SONG_SCHEMA), String(s.id)).toEqual([]);
  });
  test('every song is two 4-bar sections; patterns are 16 steps of whole numbers', () => {
    for (const s of songs) {
      const secs = s.sections as Array<{ bars: number; patterns: Record<string, number[]> }>;
      expect(secs.map((x) => x.bars), String(s.id)).toEqual([4, 4]);
      for (const sec of secs)
        for (const role of ['drums', 'bass', 'lead', 'pad']) {
          const p = sec.patterns[role]!;
          expect(p.length).toBe(16);
          for (const v of p) expect(Number.isInteger(v) && v >= -1 && v <= 127).toBe(true);
          if (role === 'drums') for (const v of p) expect(v >= -1 && v <= 5).toBe(true);
        }
      expect(secs[1]!.patterns.drums).not.toEqual(secs[0]!.patterns.drums);
    }
  });
});
