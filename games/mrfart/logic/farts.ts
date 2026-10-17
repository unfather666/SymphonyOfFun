// Fart kinds and the single door that fires one: doFart. Sim state changes only through here.
import { MASS_REF, NO_BODY } from '../physics/PhysicsApi';
import { PUFF, NOTE, RING, spawnPiece, spawnPuff } from './pools';
import { TAG_PROP, TAG_PERSON } from './types';
import type { FartDef, Prop } from './types';
import type { Sim } from './sim';

/** Index of the kind whose min is the highest not above the meter. `defs` is sorted by min. */
export function kindForMeter(defs: readonly FartDef[], meter: number): number {
  let k = 0;
  for (let i = 0; i < defs.length; i++) if (meter >= defs[i]!.min) k = i;
  return k;
}

const FACE_DX = [0, 0, -1, 1];
const FACE_DY = [1, -1, 0, 0];

export function breakProp(sim: Sim, p: Prop): void {
  const { rules, physics, rng } = sim.deps;
  physics.remove(p.h);
  p.h = NO_BODY;
  p.broken = true;
  const until = sim.now + rules.caps.pieceLifeMs;
  for (let k = 0; k < rules.caps.piecesPerBreak; k++) {
    const a = rng.fx.range(0, Math.PI * 2), s = rng.fx.range(40, 120);
    spawnPiece(sim.pieces, p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, rng.fx.range(-8, 8), p.def.colour, until);
  }
  sim.deps.emit('mrfart:prop_broken', { prop: p.idx });
}

/** Fire a fart of `kind` at the player's back. forceMul/radiusMul are for items (cursed ones raise them). */
export function doFart(sim: Sim, kind: number, forceMul = 1, radiusMul = 1): void {
  const { physics, rules, farts, rng } = sim.deps;
  const def = farts[kind]!;
  const pl = sim.player;
  const ox = pl.x - FACE_DX[pl.facing]! * rules.fart.originBack, oy = pl.y - FACE_DY[pl.facing]! * rules.fart.originBack;
  const force = Math.min(rules.fart.maxForce, def.force * rules.fart.forceScale * forceMul);
  const radius = def.radius * radiusMul;
  const buf = sim.qbuf;
  const n = physics.queryRadius(ox, oy, radius, buf);
  for (let i = 0; i < n; i++) {
    const tag = physics.tagOf(buf[i]!);
    const type = tag >>> 16, idx = tag & 0xffff;
    if (type === TAG_PERSON) sim.people[idx]!.pushedAt = sim.now;
    else if (type === TAG_PROP) {
      const p = sim.props[idx]!;
      const dx = p.x - ox, dy = p.y - oy;
      const d = Math.hypot(dx, dy);
      const dv = force * Math.pow(Math.max(0, 1 - d / radius), rules.fart.falloff) * (MASS_REF / (MASS_REF + p.def.mass));
      if (!p.knocked && dv >= p.def.knockDv) {
        p.knocked = true;
        sim.deps.emit('mrfart:prop_knocked', { prop: p.idx });
      }
      if (def.breaks && p.def.breakDv > 0 && dv >= p.def.breakDv) sim.toBreak[sim.toBreakN++] = idx;
    }
  }
  physics.impulseRadial(ox, oy, radius, force, rules.fart.falloff, pl.h);
  for (let i = 0; i < sim.toBreakN; i++) breakProp(sim, sim.props[sim.toBreak[i]!]!);
  sim.toBreakN = 0;
  for (let i = 0; i < def.puffs; i++) {
    const a = rng.fx.range(0, Math.PI * 2), s = rng.fx.range(8, 28);
    spawnPuff(sim.puffs, PUFF, ox, oy, Math.cos(a) * s, Math.sin(a) * s - 6, sim.now, rng.fx.range(500, 900), rng.fx.range(3, 6));
  }
  if (def.ring) spawnPuff(sim.puffs, RING, ox, oy, 0, 0, sim.now, 420, radius);
  for (let i = 0; i < def.notes; i++) spawnPuff(sim.puffs, NOTE, ox, oy, rng.fx.range(-14, 14), rng.fx.range(-34, -18), sim.now, 900, 1);
  const m = sim.meters;
  m.fart = Math.max(0, m.fart - def.drain);
  m.lastFartAt = sim.now;
  const f = sim.lastFart;
  f.count++; f.kind = kind; f.x = ox; f.y = oy; f.force = force; f.radius = radius; f.at = sim.now;
  sim.deps.emit('mrfart:fart', { kind, x: Math.round(ox), y: Math.round(oy), force: Math.round(force), shake: def.shake });
}
