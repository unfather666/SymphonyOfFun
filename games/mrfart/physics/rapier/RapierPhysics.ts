// The only file that imports Rapier. Implements PhysicsApi; caches poses once per step so reads are free.
import RAPIER from '@dimforge/rapier2d-compat';
import type { RigidBody, ImpulseJoint, World } from '@dimforge/rapier2d-compat';
import { MASS_REF, NO_BODY, PX_PER_M, STUN_STEPS, handleGen, handleSlot, makeHandle } from '../PhysicsApi';
import type { BodyDef, Handle, PhysicsApi, PhysicsStats, Pose } from '../PhysicsApi';

export interface RapierOptions {
  maxBodies?: number;
  maxJoints?: number;
  warn?: (key: string, msg: string) => void;
}

const GROUP_WALL = 0x0001_ffff;
const GROUP_LINK = 0x0004_0001; // rope links touch walls only
const LINKS_PER_LEASH = 2;
const JOINTS_PER_LEASH = 3;

let started: Promise<void> | null = null;
/** Load the WASM once per page / test process. */
export function initRapier(): Promise<void> {
  started ??= RAPIER.init();
  return started;
}

interface Leash {
  a: Handle;
  b: Handle;
  links: Handle[];
  joints: ImpulseJoint[];
}

export async function createRapierPhysics(opts: RapierOptions = {}): Promise<PhysicsApi> {
  await initRapier();
  const maxBodies = opts.maxBodies ?? 128;
  const maxJoints = opts.maxJoints ?? 64;
  const warn = opts.warn ?? (() => {});
  const world: World = new RAPIER.World({ x: 0, y: 0 });
  world.timestep = 1 / 60;

  // Slot arrays: index = handle slot. Typed arrays hold the per-step pose cache.
  const bodies: Array<RigidBody | null> = [];
  const defs: BodyDef[] = [];
  const gens: number[] = [];
  const liveFlag: boolean[] = [];
  const free: number[] = [];
  const px: number[] = [], py: number[] = [], pa: number[] = [], pvx: number[] = [], pvy: number[] = [];
  const mass: number[] = [];
  const steer: Array<{ on: boolean; tx: number; ty: number; cx: number; cy: number; gain: number; stun: number }> = [];
  const leashes: Array<Leash | null> = [null];
  let live = 0;
  let joints = 0;
  const v2 = { x: 0, y: 0 };
  const p2 = { x: 0, y: 0 };

  const find = (h: Handle): number => {
    const i = handleSlot(h);
    if (!liveFlag[i] || gens[i] !== handleGen(h)) {
      warn('stale-handle', `Physics handle ${h} is stale or empty; ignored.`);
      return -1;
    }
    return i;
  };

  function create(def: BodyDef, group: number | null): Handle {
    const kind = def.kind;
    const isWall = kind === 'wall';
    if (!isWall && live >= maxBodies) return NO_BODY;
    const desc = isWall ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(def.x / PX_PER_M, def.y / PX_PER_M);
    if (def.angle) desc.setRotation(def.angle);
    if (!isWall) {
      desc.setLinearDamping(def.damping ?? 3).setAngularDamping(def.angularDamping ?? 3);
      if (def.lockRotation) desc.lockRotations();
    }
    const body = world.createRigidBody(desc);
    let cd: RAPIER.ColliderDesc;
    if (def.shape === 'circle') cd = RAPIER.ColliderDesc.ball((def.r ?? 5) / PX_PER_M);
    else if (def.shape === 'capsule') cd = RAPIER.ColliderDesc.capsule((def.hh ?? 2) / PX_PER_M, (def.r ?? 5) / PX_PER_M);
    else cd = RAPIER.ColliderDesc.cuboid((def.hw ?? 4) / PX_PER_M, (def.hh ?? 4) / PX_PER_M);
    cd.setFriction(0.4).setRestitution(0.2);
    if (!isWall) cd.setMass(def.mass ?? 1);
    if (isWall) cd.setCollisionGroups(GROUP_WALL);
    else if (group !== null) cd.setCollisionGroups(group);
    world.createCollider(cd, body);
    if (isWall) return NO_BODY; // static: nothing to track
    let i = free.pop();
    if (i === undefined) {
      i = bodies.length;
      bodies.push(null);
      defs.push(def);
      gens.push(0);
      liveFlag.push(false);
      px.push(0); py.push(0); pa.push(0); pvx.push(0); pvy.push(0); mass.push(1);
      steer.push({ on: false, tx: 0, ty: 0, cx: 0, cy: 0, gain: 0.25, stun: 0 });
    }
    gens[i] = (gens[i]! % 0x7ffe) + 1;
    bodies[i] = body;
    defs[i] = def;
    liveFlag[i] = true;
    px[i] = def.x; py[i] = def.y; pa[i] = def.angle ?? 0; pvx[i] = 0; pvy[i] = 0;
    mass[i] = body.mass();
    const st = steer[i]!;
    st.on = false; st.stun = 0; st.cx = 0; st.cy = 0;
    live++;
    return makeHandle(gens[i]!, i);
  }

  function destroy(i: number) {
    const b = bodies[i];
    if (b) world.removeRigidBody(b);
    bodies[i] = null;
    liveFlag[i] = false;
    free.push(i);
    live--;
  }

  const api: PhysicsApi = {
    addBody(def) {
      if (def.kind === 'wall') {
        create(def, null);
        return NO_BODY;
      }
      return create(def, null);
    },
    remove(h) {
      const i = find(h);
      if (i >= 0) destroy(i);
    },
    setTargetVelocity(h, vx, vy, gain = 0.25) {
      const i = find(h);
      if (i < 0) return;
      const s = steer[i]!;
      if (!s.on) {
        s.cx = pvx[i]!;
        s.cy = pvy[i]!;
      }
      s.on = true;
      s.tx = vx;
      s.ty = vy;
      s.gain = gain;
    },
    impulseRadial(x, y, radius, force, falloff, exclude = NO_BODY) {
      let n = 0;
      const ex = exclude === NO_BODY ? -1 : handleSlot(exclude);
      for (let i = 0; i < bodies.length; i++) {
        if (!liveFlag[i] || i === ex) continue;
        const dx = px[i]! - x, dy = py[i]! - y;
        const d = Math.hypot(dx, dy);
        if (d >= radius) continue;
        const f = force * Math.pow(1 - d / radius, falloff) * (MASS_REF / (MASS_REF + mass[i]!));
        const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0;
        const k = (f / PX_PER_M) * mass[i]!;
        v2.x = nx * k;
        v2.y = ny * k;
        // Off-centre push so boxes tumble; side alternates by slot so it stays deterministic.
        const lever = ((defs[i]!.hw ?? defs[i]!.r ?? 4) / PX_PER_M) * 0.6 * (i % 2 === 0 ? 1 : -1);
        p2.x = px[i]! / PX_PER_M - ny * lever;
        p2.y = py[i]! / PX_PER_M + nx * lever;
        const b = bodies[i]!;
        if (defs[i]!.lockRotation) b.applyImpulse(v2, true);
        else b.applyImpulseAtPoint(v2, p2, true);
        const s = steer[i]!;
        if (s.on) s.stun = STUN_STEPS;
        n++;
      }
      return n;
    },
    queryRadius(x, y, r, out) {
      let n = 0;
      for (let i = 0; i < bodies.length && n < out.length; i++) {
        if (liveFlag[i] && Math.hypot(px[i]! - x, py[i]! - y) <= r) out[n++] = makeHandle(gens[i]!, i);
      }
      return n;
    },
    step() {
      for (let i = 0; i < bodies.length; i++) {
        const s = steer[i]!;
        if (!liveFlag[i] || !s.on) continue;
        if (s.stun > 0) {
          s.stun--;
          if (s.stun === 0) {
            const v = bodies[i]!.linvel(); // one read when steering resumes
            s.cx = v.x * PX_PER_M;
            s.cy = v.y * PX_PER_M;
          }
          continue;
        }
        s.cx += (s.tx - s.cx) * s.gain;
        s.cy += (s.ty - s.cy) * s.gain;
        v2.x = s.cx / PX_PER_M;
        v2.y = s.cy / PX_PER_M;
        bodies[i]!.setLinvel(v2, true);
      }
      world.step();
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b || b.isSleeping()) {
          if (b) {
            pvx[i] = 0;
            pvy[i] = 0;
          }
          continue;
        }
        const t = b.translation();
        const v = b.linvel();
        px[i] = t.x * PX_PER_M;
        py[i] = t.y * PX_PER_M;
        pa[i] = b.rotation();
        pvx[i] = v.x * PX_PER_M;
        pvy[i] = v.y * PX_PER_M;
      }
    },
    pose(h, out: Pose) {
      const i = handleSlot(h);
      if (!liveFlag[i] || gens[i] !== handleGen(h)) return false;
      out.x = px[i]!;
      out.y = py[i]!;
      out.angle = pa[i]!;
      out.vx = pvx[i]!;
      out.vy = pvy[i]!;
      return true;
    },
    tagOf(h) {
      const i = find(h);
      return i < 0 ? 0 : (defs[i]!.tag ?? 0);
    },
    addLeash(a, b, length) {
      const ia = find(a), ib = find(b);
      if (ia < 0 || ib < 0 || joints + JOINTS_PER_LEASH > maxJoints) return 0;
      const links: Handle[] = [];
      const parts: Handle[] = [a];
      for (let k = 1; k <= LINKS_PER_LEASH; k++) {
        const t = k / (LINKS_PER_LEASH + 1);
        const lx = px[ia]! + (px[ib]! - px[ia]!) * t, ly = py[ia]! + (py[ib]! - py[ia]!) * t;
        const l = create({ kind: 'link', shape: 'circle', x: lx, y: ly, r: 1.5, mass: 0.05, damping: 2 }, GROUP_LINK);
        if (l === NO_BODY) {
          for (const h of links) api.remove(h);
          return 0;
        }
        links.push(l);
        parts.push(l);
      }
      parts.push(b);
      const seg = length / PX_PER_M / JOINTS_PER_LEASH;
      const js: ImpulseJoint[] = [];
      const o = { x: 0, y: 0 };
      for (let k = 0; k < JOINTS_PER_LEASH; k++) {
        const bodyA = bodies[handleSlot(parts[k]!)]!, bodyB = bodies[handleSlot(parts[k + 1]!)]!;
        js.push(world.createImpulseJoint(RAPIER.JointData.rope(seg, o, o), bodyA, bodyB, true));
      }
      joints += JOINTS_PER_LEASH;
      leashes.push({ a, b, links, joints: js });
      return leashes.length - 1;
    },
    removeLeash(id) {
      const l = leashes[id];
      if (!l) return;
      for (const j of l.joints) world.removeImpulseJoint(j, true);
      for (const h of l.links) api.remove(h);
      joints -= JOINTS_PER_LEASH;
      leashes[id] = null;
    },
    leashPoints(id, out) {
      const l = leashes[id];
      if (!l) return 0;
      const ids = [l.a, ...l.links, l.b];
      for (let k = 0; k < ids.length; k++) {
        const i = handleSlot(ids[k]!);
        out[k * 2] = px[i]!;
        out[k * 2 + 1] = py[i]!;
      }
      return ids.length;
    },
    stats(): PhysicsStats {
      let awake = 0;
      for (let i = 0; i < bodies.length; i++) if (bodies[i] && !bodies[i]!.isSleeping()) awake++;
      return { bodies: live, joints, awake };
    },
    dispose() {
      world.free();
    },
  };
  return api;
}
