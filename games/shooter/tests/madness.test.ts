// Proves madness numbers (auras, eyes, decay, tiers, inversion), the score multipliers, hallucination rules and that render-only tiers never change the sim. Area: logic/madness, fx, score. 2026-10-17
import { describe, expect, test } from 'vitest';
import { updateFx } from '../logic/fx';
import { tierOf } from '../logic/madness';
import { awardKill, killMultiplier } from '../logic/score';
import { hashWorld, makeCommand } from '../logic/sim';
import type { EnemyDef } from '../logic/types';
import { spawnEnemy } from '../logic/world';
import { CUE, IDLE_BRAIN, RULES, makeWorld, run, runCollect } from './helpers';

function still(seed = 1) {
  const w = makeWorld({ seed, noWaves: true, extraBrains: [IDLE_BRAIN] });
  return w;
}
const place = (w: ReturnType<typeof still>, id: string, dx: number, dy = 0) => {
  const e = spawnEnemy(w, id, w.player.x + dx, w.player.y + dy, false, -1)!;
  e.brain = w.brains.get('idle_test')!;
  e.state = 0;
  return e;
};

describe('tiers', () => {
  test('thresholds are 20 40 60 80 95', () => {
    expect([0, 19.99, 20, 39.99, 40, 59.99, 60, 79.99, 80, 94.99, 95, 100].map((m) => tierOf(m, RULES))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});

describe('sources and decay', () => {
  test('a whisperer within 48 px adds 8 per second; outside adds nothing', () => {
    const w = still();
    const e = place(w, 'whisperer', 30);
    e.def = { ...e.def, speed: 0 } as EnemyDef;
    run(w, 60);
    expect(w.madness).toBeCloseTo(8, 1);
    const far = still();
    place(far, 'whisperer', 100);
    run(far, 60);
    expect(far.madness).toBe(0);
  });
  test('madness decays 4 per second in a lit room (ambient 0.6) and not at all in a darker one', () => {
    const w = still();
    w.madness = 50;
    run(w, 60);
    expect(w.madness).toBeCloseTo(46, 1);
    const dark = still();
    dark.plan.ambient;
    (dark.plan as { ambient: number }).ambient = 0.9;
    dark.madness = 50;
    run(dark, 60);
    expect(dark.madness).toBe(50);
  });
  test('no decay while a source feeds it', () => {
    const w = still();
    place(w, 'whisperer', 20);
    w.madness = 50;
    run(w, 60);
    expect(w.madness).toBeGreaterThan(50);
  });
  test('an eye drains 15 per second only inside its cone with a clear line', () => {
    const w = still();
    const e = place(w, 'eye', 60);
    e.heading = Math.PI; // facing the player (player is to its left)
    e.def = { ...e.def, turnDegS: undefined } as EnemyDef;
    run(w, 60);
    expect(w.madness).toBeGreaterThan(14);
    const away = still();
    const b = place(away, 'eye', 60);
    b.heading = 0; // facing away
    b.def = { ...b.def, turnDegS: undefined } as EnemyDef;
    run(away, 60);
    expect(away.madness).toBe(0);
  });
  test('the eye dies to one hit from behind but not from the front', () => {
    const behind = still();
    const e = place(behind, 'eye', 40);
    e.def = { ...e.def, turnDegS: undefined, madnessAura: undefined } as EnemyDef;
    e.heading = 0; // facing away from the player: the bullet travels the way it faces
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    run(behind, 30, c);
    expect(e.alive).toBe(false);
    const front = still();
    const f = place(front, 'eye', 40);
    f.def = { ...f.def, turnDegS: undefined, madnessAura: undefined } as EnemyDef;
    f.heading = Math.PI;
    run(front, 14, c);
    expect(f.alive).toBe(true);
    expect(f.hp).toBe(32);
  });
});

describe('inversion (tier 4)', () => {
  test('warns for 300 ms, then inverts for 1500 ms, between 6 and 10 seconds after tier 4 starts, announced by a cue', () => {
    const w = still();
    let warnAt = -1;
    let activeAt = -1;
    let endAt = -1;
    const cues = runCollect(w, 60 * 14, makeCommand(), (x) => {
      x.madness = 85;
      if (x.inv.phase === 1 && warnAt < 0) warnAt = x.now;
      if (x.inv.phase === 2 && activeAt < 0) activeAt = x.now;
      if (x.inv.phase === 0 && activeAt > 0 && endAt < 0) endAt = x.now;
    });
    expect(cues).toContain(CUE.invertWarn);
    expect(warnAt).toBeGreaterThanOrEqual(6000);
    expect(warnAt).toBeLessThanOrEqual(10100);
    expect(activeAt - warnAt).toBeGreaterThanOrEqual(300);
    expect(activeAt - warnAt).toBeLessThan(330);
    expect(endAt - activeAt).toBeGreaterThanOrEqual(1500);
    expect(endAt - activeAt).toBeLessThan(1530);
  });
  test('while inverted, moving right moves left; otherwise right', () => {
    const w = still();
    const c = makeCommand();
    c.mx = 1;
    const x0 = w.player.x;
    run(w, 10, c);
    expect(w.player.x).toBeGreaterThan(x0);
    w.inv.phase = 2;
    w.inv.at = 1e9;
    w.madness = 85;
    const x1 = w.player.x;
    run(w, 10, c);
    expect(w.player.x).toBeLessThan(x1);
  });
  test('below tier 4 it never starts', () => {
    const w = still();
    runCollect(w, 60 * 12, makeCommand(), (x) => void (x.madness = 70));
    expect(w.inv.phase).toBe(0);
  });
});

describe('render-only tiers never touch the sim', () => {
  const trace = (madness: number) => {
    const w = makeWorld({ seed: 5 });
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    c.ay = 0.3;
    const hashes: number[] = [];
    for (let i = 1; i <= 600; i++) {
      run(w, 1, c);
      w.madness = madness;
      if (i % 20 === 0) hashes.push(hashWorld(w));
      w.outN = 0;
    }
    return hashes;
  };
  test('sim hash is identical with madness forced to 0 and to 100 (idle player)', () => {
    expect(trace(100)).toEqual(trace(0));
  });
  test('and the test can fail: a different seed changes it', () => {
    expect(trace(0)).not.toEqual((() => { const w = makeWorld({ seed: 6 }); const c = makeCommand(); c.fire = true; c.ax = 1; c.ay = 0.3; const h: number[] = []; for (let i = 1; i <= 600; i++) { run(w, 1, c); w.outN = 0; if (i % 20 === 0) h.push(hashWorld(w)); } return h; })());
  });
});

describe('hallucinations (tier 3)', () => {
  test('none below tier 3; some at tier 3, capped at 16, never colliding with anything', () => {
    const w = still();
    for (let i = 0; i < 600; i++) {
      w.madness = 50;
      run(w, 1);
      w.outN = 0;
    }
    expect(w.ghosts.n).toBe(0);
    for (let i = 0; i < 3000; i++) {
      w.madness = 70;
      run(w, 1);
      w.outN = 0;
      expect(w.ghosts.n).toBeLessThanOrEqual(16);
    }
    expect(w.ghosts.stats.peak).toBeGreaterThan(0);
    expect(w.player.hp).toBe(100);
  });
  test('a ghost vanishes when a player bullet touches it', () => {
    const w = still();
    w.madness = 70;
    const g = w.ghosts.acquire()!;
    g.x = w.player.x + 30;
    g.y = w.player.y;
    g.vx = g.vy = 0;
    g.kind = 0;
    g.arg = 0;
    g.dieAt = 1e9;
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    for (let i = 0; i < 20; i++) {
      w.madness = 70;
      run(w, 1, c);
    }
    expect(g.alive).toBe(false);
  });
  test('updateFx alone never changes the player or enemies', () => {
    const w = still();
    const e = place(w, 'cultist', 50);
    w.madness = 90;
    const before = hashWorld(w);
    for (let i = 0; i < 100; i++) {
      w.now += 16.7;
      updateFx(w);
    }
    expect(hashWorld(w)).toBe(before);
    expect(e.alive).toBe(true);
  });
});

describe('score multipliers', () => {
  test('combo adds 0.25 per extra kill inside 2 s, resets after the window', () => {
    const w = still();
    w.now = 1000;
    awardKill(w, 10);
    expect(w.score).toBe(10);
    w.now = 2500;
    awardKill(w, 10);
    expect(w.score).toBe(10 + 13);
    w.now = 3500;
    awardKill(w, 10);
    expect(w.score).toBe(10 + 13 + 15);
    w.now = 9000;
    awardKill(w, 10);
    expect(w.score).toBe(10 + 13 + 15 + 10);
  });
  test('each madness tier adds 0.25 and tier 5 triples', () => {
    const w = still();
    w.combo = 1;
    w.madness = 45;
    expect(killMultiplier(w)).toBe(1.5);
    w.madness = 96;
    expect(killMultiplier(w)).toBe((1 + 5 * 0.25) * 3);
  });
  test('combo is capped', () => {
    const w = still();
    for (let i = 0; i < 30; i++) {
      w.now = 100 + i * 10;
      awardKill(w, 1);
    }
    expect(killMultiplier(w)).toBe(1 + 4 * 0.25);
  });
});
