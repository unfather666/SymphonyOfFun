// Stand-in PhysicsApi for tests and for the contract suite: bodies integrate velocity with damping, no collisions.
import { MASS_REF, NO_BODY, STUN_STEPS, handleGen, handleSlot, makeHandle } from './PhysicsApi';
import type { BodyDef, Handle, PhysicsApi, PhysicsStats, Pose } from './PhysicsApi';

interface Slot {
  live: boolean;
  gen: number;
  def: BodyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  av: number;
  mass: number;
  tx: number;
  ty: number;
  gain: number;
  steered: boolean;
  stun: number;
}

export interface NullOptions {
  maxBodies?: number;
  maxJoints?: number;
  warn?: (key: string, msg: string) => void;
}

export function createNullPhysics(opts: NullOptions = {}): PhysicsApi {
  const maxBodies = opts.maxBodies ?? 128;
  const maxJoints = opts.maxJoints ?? 64;
  const warn = opts.warn ?? (() => {});
  const slots: Slot[] = [];
  const free: number[] = [];
  const leashes: Array<{ a: Handle; b: Handle; len: number } | null> = [null];
  let live = 0;
  let joints = 0;

  const find = (h: Handle): Slot | null => {
    const s = slots[handleSlot(h)];
    if (!s || !s.live || s.gen !== handleGen(h)) {
      warn('stale-handle', `Physics handle ${h} is stale or empty; ignored.`);
      return null;
    }
    return s;
  };

  return {
    addBody(def) {
      if (def.kind === 'wall') return NO_BODY; // walls are not simulated here
      if (live >= maxBodies) return NO_BODY;
      let i = free.pop();
      if (i === undefined) {
        i = slots.length;
        slots.push({ live: false, gen: 0, def, x: 0, y: 0, vx: 0, vy: 0, angle: 0, av: 0, mass: 1, tx: 0, ty: 0, gain: 0.25, steered: false, stun: 0 });
      }
      const s = slots[i]!;
      s.gen = (s.gen % 0x7ffe) + 1;
      Object.assign(s, { live: true, def, x: def.x, y: def.y, vx: 0, vy: 0, angle: def.angle ?? 0, av: 0, mass: def.mass ?? 1, steered: false, stun: 0 });
      live++;
      return makeHandle(s.gen, i);
    },
    remove(h) {
      const s = find(h);
      if (!s) return;
      s.live = false;
      free.push(handleSlot(h));
      live--;
    },
    setTargetVelocity(h, vx, vy, gain = 0.25) {
      const s = find(h);
      if (!s) return;
      s.tx = vx;
      s.ty = vy;
      s.gain = gain;
      s.steered = true;
    },
    impulseRadial(x, y, radius, force, falloff, exclude = NO_BODY) {
      let n = 0;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]!;
        if (!s.live || (exclude !== NO_BODY && handleSlot(exclude) === i)) continue;
        const dx = s.x - x, dy = s.y - y;
        const d = Math.hypot(dx, dy);
        if (d >= radius) continue;
        const f = force * Math.pow(1 - d / radius, falloff) * (MASS_REF / (MASS_REF + s.mass));
        const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0;
        s.vx += nx * f;
        s.vy += ny * f;
        if (s.steered) s.stun = STUN_STEPS;
        n++;
      }
      return n;
    },
    queryRadius(x, y, r, out) {
      let n = 0;
      for (let i = 0; i < slots.length && n < out.length; i++) {
        const s = slots[i]!;
        if (s.live && Math.hypot(s.x - x, s.y - y) <= r) out[n++] = makeHandle(s.gen, i);
      }
      return n;
    },
    step() {
      const dt = 1 / 60;
      for (const s of slots) {
        if (!s.live) continue;
        if (s.steered && s.stun === 0) {
          s.vx += (s.tx - s.vx) * s.gain;
          s.vy += (s.ty - s.vy) * s.gain;
        } else if (s.stun > 0) s.stun--;
        const k = 1 / (1 + (s.def.damping ?? 0) * dt);
        s.vx *= k;
        s.vy *= k;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.angle += s.av * dt;
      }
    },
    pose(h, out) {
      const s = slots[handleSlot(h)];
      if (!s || !s.live || s.gen !== handleGen(h)) return false;
      out.x = s.x;
      out.y = s.y;
      out.angle = s.angle;
      out.vx = s.vx;
      out.vy = s.vy;
      return true;
    },
    tagOf: (h) => find(h)?.def.tag ?? 0,
    addLeash(a, b, len) {
      if (joints + 3 > maxJoints) return 0;
      joints += 3;
      leashes.push({ a, b, len });
      return leashes.length - 1;
    },
    removeLeash(id) {
      if (leashes[id]) {
        leashes[id] = null;
        joints -= 3;
      }
    },
    leashPoints(id, out) {
      const l = leashes[id];
      const sa = l && slots[handleSlot(l.a)], sb = l && slots[handleSlot(l.b)];
      if (!l || !sa || !sb) return 0;
      for (let i = 0; i < 4; i++) {
        out[i * 2] = sa.x + ((sb.x - sa.x) * i) / 3;
        out[i * 2 + 1] = sa.y + ((sb.y - sa.y) * i) / 3;
      }
      return 4;
    },
    stats(): PhysicsStats {
      return { bodies: live, joints, awake: live };
    },
    dispose() {
      slots.length = 0;
      free.length = 0;
    },
  };
}
