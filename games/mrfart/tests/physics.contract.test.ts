// Proves: PhysicsApi behaves the same on the null stand-in and on Rapier. Area: physics. 2026-10-17
import { beforeAll, describe, expect, test } from 'vitest';
import { NO_BODY } from '../physics/PhysicsApi';
import type { Handle, PhysicsApi, Pose } from '../physics/PhysicsApi';
import { createNullPhysics } from '../physics/NullPhysics';
import { createRapierPhysics } from '../physics/rapier/RapierPhysics';

type Make = (o?: { maxBodies?: number; warn?: (k: string, m: string) => void }) => Promise<PhysicsApi> | PhysicsApi;
const makers: Array<[string, Make]> = [
  ['null', (o) => createNullPhysics(o)],
  ['rapier', (o) => createRapierPhysics(o)],
];
const out = (): Pose => ({ x: 0, y: 0, angle: 0, vx: 0, vy: 0 });
const run = (p: PhysicsApi, n: number) => {
  for (let i = 0; i < n; i++) p.step();
};

describe.each(makers)('PhysicsApi contract: %s', (_name, make) => {
  let warned: string[];
  let p: PhysicsApi;
  beforeAll(() => {
    warned = [];
  });
  const fresh = async (max?: number) => {
    warned = [];
    p = await make({ maxBodies: max, warn: (k) => warned.push(k) });
    return p;
  };
  const person = (x: number, y: number, tag = 7) =>
    p.addBody({ kind: 'person', shape: 'circle', x, y, r: 5, mass: 1, damping: 5, lockRotation: true, tag });

  test('add, pose and tag round-trip', async () => {
    await fresh();
    const h = person(100, 50, 42);
    expect(h).not.toBe(NO_BODY);
    const o = out();
    expect(p.pose(h, o)).toBe(true);
    expect([o.x, o.y]).toEqual([100, 50]);
    expect(p.tagOf(h)).toBe(42);
  });

  test('stale handle warns once per call and does nothing', async () => {
    await fresh();
    const h = person(10, 10);
    p.remove(h);
    expect(p.pose(h, out())).toBe(false);
    p.remove(h);
    p.setTargetVelocity(h, 1, 1);
    expect(warned.length).toBe(2);
    const h2 = person(10, 10); // slot reused with a new generation
    expect(h2).not.toBe(h);
    expect(p.pose(h, out())).toBe(false);
    expect(p.pose(h2, out())).toBe(true);
  });

  test('full policy: past the body cap addBody returns NO_BODY', async () => {
    await fresh(3);
    expect([person(0, 0), person(20, 0), person(40, 0)].every((h) => h !== NO_BODY)).toBe(true);
    expect(person(60, 0)).toBe(NO_BODY);
    expect(p.stats().bodies).toBe(3);
  });

  test('steering reaches the target velocity and moves the body', async () => {
    await fresh();
    const h = person(0, 0);
    p.setTargetVelocity(h, 60, 0, 0.5);
    run(p, 60);
    const o = out();
    p.pose(h, o);
    expect(o.vx).toBeGreaterThan(50);
    expect(o.x).toBeGreaterThan(45);
    expect(Math.abs(o.y)).toBeLessThan(0.5);
  });

  test('radial impulse pushes away, weakens with distance, spares excluded and out-of-range bodies', async () => {
    await fresh();
    const near = person(110, 100), far = person(140, 100), outside = person(300, 100), self = person(100, 100);
    expect(p.impulseRadial(100, 100, 64, 200, 1, self)).toBe(2);
    run(p, 6);
    const a = out(), b = out(), c = out(), s = out();
    p.pose(near, a); p.pose(far, b); p.pose(outside, c); p.pose(self, s);
    expect(a.x).toBeGreaterThan(110.5);
    expect(a.x - 110).toBeGreaterThan(b.x - 140);
    expect(b.x).toBeGreaterThan(140);
    expect(c.x).toBe(300);
    expect(s.x).toBe(100);
  });

  test('queryRadius returns handles inside the circle only', async () => {
    await fresh();
    const a = person(10, 10), b = person(20, 10);
    person(200, 200);
    const buf = new Int32Array(8);
    const n = p.queryRadius(15, 10, 8, buf);
    expect(n).toBe(2);
    expect([...buf.slice(0, n)].sort()).toEqual([a, b].sort());
  });

  test('a steered body is knocked off its steering by an impulse and flies', async () => {
    await fresh();
    const h = person(100, 100);
    p.setTargetVelocity(h, 0, 0, 0.5);
    run(p, 5);
    p.impulseRadial(90, 100, 64, 300, 1);
    run(p, 10);
    const o = out();
    p.pose(h, o);
    expect(o.x).toBeGreaterThan(105);
  });

  test('leash: 4 points, refused past the joint cap, survives max impulse', async () => {
    await fresh();
    const hand = person(100, 100), subj = p.addBody({ kind: 'subject', shape: 'circle', x: 140, y: 100, r: 6, mass: 6, damping: 4, lockRotation: true });
    const id = p.addLeash(hand, subj, 50);
    expect(id).toBeGreaterThan(0);
    const pts = new Float64Array(16);
    expect(p.leashPoints(id, pts)).toBe(4);
    p.impulseRadial(120, 100, 200, 960, 1, NO_BODY); // 960 = loud 80 x scale 4 x rocket beans 3, the legal maximum
    run(p, 240);
    const a = out(), b = out();
    p.pose(hand, a); p.pose(subj, b);
    for (const v of [a.x, a.y, b.x, b.y]) expect(Number.isFinite(v)).toBe(true);
    p.leashPoints(id, pts);
    for (const v of pts.slice(0, 8)) expect(Number.isFinite(v)).toBe(true);
    // the rope pulls back to its length once the shove has played out
    if (_name === 'rapier') expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(50 * 1.15);
    p.removeLeash(id);
    expect(p.stats().joints).toBe(0);
    const tight = await fresh();
    const h0 = person(0, 0);
    const caps: number[] = [];
    for (let i = 0; i < 22; i++) {
      const s = tight.addBody({ kind: 'subject', shape: 'circle', x: 10 + i, y: 0, r: 3 });
      caps.push(tight.addLeash(h0, s, 30));
    }
    expect(caps.filter((c) => c > 0).length).toBe(21);
    expect(caps[21]).toBe(0);
  });
});
export type { Handle };
