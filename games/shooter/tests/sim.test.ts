// Proves the sim: determinism, shooting kills, contact and bullets hurt, waves, exit, restart, pools under load. Area: logic/sim and friends. 2026-10-17
import { describe, expect, test } from 'vitest';
import { hurtPlayer } from '../logic/combat';
import { hashWorld, makeCommand } from '../logic/sim';
import { resolveRig } from '../logic/rig';
import { DEFAULT_SHOT } from '../logic/shots';
import { resetWorld, setShot, spawnEnemy } from '../logic/world';
import { IDLE_BRAIN, ENEMIES, RULES, makeWorld, pick, run } from './helpers';
import type { EnemyDef } from '../logic/types';

const idleCultist = { ...ENEMIES.find((e) => e.id === 'cultist')!, id: 'idle_cultist', brain: 'idle_test', touchDamage: 0 } as EnemyDef;

function withIdle(seed = 1) {
  const w = makeWorld({ seed, noWaves: true, extraBrains: [IDLE_BRAIN] });
  (w.defs as Map<string, EnemyDef>).set(idleCultist.id, idleCultist);
  return w;
}

describe('determinism', () => {
  const scripted = (seed: number) => {
    const w = makeWorld({ seed });
    const c = makeCommand();
    for (let i = 0; i < 200; i++) {
      c.mx = Math.sin(i / 30);
      c.my = Math.cos(i / 40);
      c.fire = i % 3 === 0;
      c.ax = 1;
      c.ay = 0.2;
      run(w, 1, c);
    }
    return hashWorld(w);
  };
  test('same seed, 200 steps, same hash', () => {
    expect(scripted(7)).toBe(scripted(7));
  });
  test('a different seed gives a different hash', () => {
    expect(scripted(7)).not.toBe(scripted(8));
  });
});

describe('shooting', () => {
  test('three bolts kill an idle cultist in front of the player at an exact step', () => {
    const w = withIdle();
    const e = spawnEnemy(w, 'idle_cultist', w.player.x + 40, w.player.y, false, -1)!;
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    let steps = 0;
    while (e.alive && steps < 200) {
      run(w, 1, c);
      steps++;
    }
    expect(e.alive).toBe(false);
    expect(w.kills).toBe(1);
    expect(w.score).toBe(10);
    expect(steps).toBe(34);
  });
  test('bullets stop at walls', () => {
    const w = withIdle();
    w.player.x = 24;
    w.player.y = 24;
    const c = makeCommand();
    c.fire = true;
    c.ax = -1;
    run(w, 30, c);
    expect(w.bullets.n).toBeLessThanOrEqual(1);
  });
});

describe('harm', () => {
  test('hurtPlayer respects invulnerability frames', () => {
    const w = withIdle();
    hurtPlayer(w, 10);
    hurtPlayer(w, 10);
    expect(w.player.hp).toBe(90);
    run(w, 60);
    hurtPlayer(w, 10);
    expect(w.player.hp).toBe(80);
  });
  test('the player dies at zero, the room restarts clean', () => {
    const w = withIdle();
    for (let i = 0; i < 12; i++) {
      run(w, 60);
      hurtPlayer(w, 10);
    }
    expect(w.status).toBe('dead');
    expect(w.player.hp).toBe(0);
    spawnEnemy(w, 'idle_cultist', 100, 100, false, -1);
    resetWorld(w, 0);
    expect(w.status).toBe('play');
    expect(w.player.hp).toBe(100);
    expect(w.enemies.n).toBe(0);
    expect(w.score).toBe(0);
  });
  test('an enemy bolt aimed at the player lands', () => {
    const w = makeWorld({ noWaves: true });
    const c = spawnEnemy(w, 'cultist', w.player.x + 60, w.player.y, false, -1)!;
    run(w, 400);
    expect(c.alive).toBe(true);
    expect(w.player.hp).toBeLessThan(100);
  });
});

describe('rooms and exit', () => {
  test('walking in wakes the room and spawns wave one, killing everything opens the exit', () => {
    const w = makeWorld();
    run(w, 2);
    expect(w.rooms[0]!.state).toBe(1);
    expect(w.enemies.n).toBe(4);
    for (let g = 0; g < 4 && !w.exitOpen; g++) {
      w.enemies.clear();
      run(w, 60);
    }
    expect(w.rooms[0]!.state).toBe(2);
    expect(w.exitOpen).toBe(true);
    w.player.x = w.plan.exit!.x;
    w.player.y = w.plan.exit!.y;
    run(w, 1);
    expect(w.status).toBe('cleared');
  });
  test('a full enemy pool makes the wave wait instead of dropping spawns', () => {
    const w = makeWorld({ extraBrains: [IDLE_BRAIN] });
    (w.defs as Map<string, EnemyDef>).set(idleCultist.id, idleCultist);
    for (let i = 0; i < w.enemies.cap - 2; i++) expect(spawnEnemy(w, 'idle_cultist', 200, 100, false, -1)).not.toBeNull();
    run(w, 2);
    expect(w.enemies.n).toBe(w.enemies.cap);
    expect(w.rooms[0]!.spawned).toBe(2);
  });
});

describe('load', () => {
  test('200 enemies and 512 bullets keep the pools at their caps', () => {
    const w = withIdle();
    for (let i = 0; i < 250; i++) spawnEnemy(w, 'idle_cultist', 40 + (i % 20) * 12, 40 + Math.floor(i / 20) * 12, false, -1);
    expect(w.enemies.n).toBe(200);
    expect(w.enemies.stats.skipped).toBe(50);
    const c = makeCommand();
    c.fire = true;
    c.ax = 0;
    c.ay = 1;
    run(w, 600, c);
    expect(w.bullets.n).toBeLessThanOrEqual(512);
  });
});

describe('projectile kinds', () => {
  // Three idle cultists in a line in front of the player; one shot, then let it fly.
  function volley(ids: string[], gaps: number[], hp = 20) {
    const w = withIdle();
    setShot(w, resolveRig(pick(ids), DEFAULT_SHOT(RULES).shots[0]!));
    const es = gaps.map((g) => spawnEnemy(w, 'idle_cultist', w.player.x + g, w.player.y, false, -1)!);
    for (const e of es) e.hp = hp;
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    run(w, 1, c);
    c.fire = false;
    run(w, 45, c);
    return { w, es, hurt: es.map((e) => !e.alive || e.hp < hp) };
  }
  test('bolt without pierce hurts only the first', () => {
    expect(volley(['rivet_bolt'], [30, 50, 70]).hurt).toEqual([true, false, false]);
  });
  test('beam pierces all in range', () => {
    expect(volley(['flame_beam'], [30, 50, 70]).hurt).toEqual([true, true, true]);
  });
  test('shell splash reaches neighbours', () => {
    expect(volley(['flak_shell'], [40, 48, 54]).hurt).toEqual([true, true, true]);
  });
  test('arc chains between targets', () => {
    expect(volley(['tesla_arc'], [30, 50, 70]).hurt).toEqual([true, true, true]);
  });
  test('wave passes through everything it meets', () => {
    expect(volley(['sonar_wave'], [30, 50, 70]).hurt).toEqual([true, true, true]);
  });
  test('hardened rivet (pierce 1) hurts two', () => {
    expect(volley(['rivet_bolt', 'rivet_hardened'], [30, 50, 70]).hurt).toEqual([true, true, false]);
  });
  test('winch pulls the target towards the player, coolant slows it', () => {
    const a = volley(['harpoon_head', 'harpoon_winch'], [60], 500);
    expect(a.es[0]!.x).toBeLessThan(a.w.player.x + 60);
    const b = volley(['rivet_bolt', 'cryo_coolant'], [30]);
    expect(b.es[0]!.slowUntil).toBeGreaterThan(0);
  });
  test('eight-direction core fires one bullet per direction', () => {
    const w = withIdle();
    setShot(w, resolveRig(pick(['signal_core']), DEFAULT_SHOT(RULES).shots[0]!));
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    run(w, 1, c);
    expect(w.bullets.n).toBe(8);
  });
  test('kill effects: leech heals, ammo starts overdrive', () => {
    const w = withIdle();
    setShot(w, resolveRig(pick(['rivet_bolt', 'siphon_leech', 'siphon_ammo']), DEFAULT_SHOT(RULES).shots[0]!));
    w.player.hp = 50;
    const e = spawnEnemy(w, 'idle_cultist', w.player.x + 30, w.player.y, false, -1)!;
    e.hp = 1;
    const c = makeCommand();
    c.fire = true;
    c.ax = 1;
    run(w, 20, c);
    expect(e.alive).toBe(false);
    expect(w.player.hp).toBe(55);
    expect(w.player.overdriveUntil).toBeGreaterThan(w.now);
  });
});
