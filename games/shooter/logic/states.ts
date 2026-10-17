// Built-in brain states: idle wander chase strafe shoot flee burst split. Each has enter/update/exit and only sets the desired velocity.
import { DT, TAU } from './consts';
import { spawnEnemyBullet } from './bullets';
import { splitEnemy } from './combat';
import { flowTarget } from './flow';
import { triggerLight } from './lightscript';
import { boxOpen, TILE } from './tiles';
import { cue, spark, spawnEnemy } from './world';
import { CUE } from './cues';
import type { CState, Enemy, World } from './types';

const tgt = { x: 0, y: 0 };

export interface StateFns {
  enter(w: World, e: Enemy, s: CState): void;
  update(w: World, e: Enemy, s: CState): void;
  exit(w: World, e: Enemy): void;
}

const noop = () => {};
const still = (_w: World, e: Enemy) => void (e.vx = e.vy = 0);

/** Point the enemy at the player (or the next flow-field tile when walls are in the way) at `speed`. */
function seek(w: World, e: Enemy, speed: number, lateral: number): void {
  const p = w.player;
  let tx = p.x;
  let ty = p.y;
  if (!e.def.flies && !e.los && flowTarget(w.map, w.flow, e.x, e.y, tgt)) {
    tx = tgt.x;
    ty = tgt.y;
  }
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const side = lateral === 0 ? 0 : Math.sin(w.now * 0.008 + e.phase) * lateral;
  e.vx = (ux - uy * side) * speed;
  e.vy = (uy + ux * side) * speed;
}

export const STATES: readonly StateFns[] = [
  // idle
  { enter: (_w, e) => void (e.vx = e.vy = 0), update: (_w, e) => void (e.vx = e.vy = 0), exit: noop },
  // wander: slow drift on a random heading, turn when a wall is hit (the mover sets nextActAt = 0 on a block)
  {
    enter: (w, e) => {
      e.heading = w.rng.float() * TAU;
      e.nextActAt = w.now + 600 + w.rng.float() * 600;
    },
    update: (w, e, s) => {
      if (w.now >= e.nextActAt) {
        e.heading = w.rng.float() * TAU;
        e.nextActAt = w.now + 600 + w.rng.float() * 600;
      }
      const sp = e.def.speed * s.speedMul * 0.5;
      e.vx = Math.cos(e.heading) * sp;
      e.vy = Math.sin(e.heading) * sp;
    },
    exit: noop,
  },
  // chase
  { enter: noop, update: (w, e, s) => seek(w, e, e.def.speed * s.speedMul, s.zig), exit: noop },
  // strafe: circle the player at s.dist, drifting in or out to keep the gap
  {
    enter: (w, e) => void (e.heading = w.rng.chance(0.5) ? 1 : -1),
    update: (w, e, s) => {
      const p = w.player;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const radial = Math.max(-1, Math.min(1, (d - s.dist) / Math.max(1, s.dist)));
      const sp = e.def.speed * s.speedMul;
      e.vx = ((dx / d) * radial - (dy / d) * e.heading * 0.8) * sp;
      e.vy = ((dy / d) * radial + (dx / d) * e.heading * 0.8) * sp;
    },
    exit: noop,
  },
  // shoot: stand still and fire a volley on entry
  {
    enter: (w, e) => {
      e.vx = e.vy = 0;
      const d = e.def;
      const p = w.player;
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      const n = d.shotCount ?? 1;
      const spread = d.shotSpread ?? 0;
      for (let i = 0; i < n; i++) spawnEnemyBullet(w, e.x, e.y, base + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), d.shotSpeed ?? 90, d.shotDamage ?? 10);
    },
    update: (_w, e) => void (e.vx = e.vy = 0),
    exit: noop,
  },
  // flee
  {
    enter: noop,
    update: (w, e, s) => {
      const p = w.player;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = e.def.speed * s.speedMul;
      e.vx = (dx / d) * sp;
      e.vy = (dy / d) * sp;
    },
    exit: noop,
  },
  // burst: a straight lunge at the player's position when the state began
  {
    enter: (w, e) => void (e.heading = Math.atan2(w.player.y - e.y, w.player.x - e.x)),
    update: (_w, e, s) => {
      const sp = e.def.speed * s.speedMul;
      e.vx = Math.cos(e.heading) * sp;
      e.vy = Math.sin(e.heading) * sp;
    },
    exit: noop,
  },
  // split: spawn the def's children and go away
  {
    enter: (w, e) => {
      splitEnemy(w, e);
      e.hp = 0;
    },
    update: noop,
    exit: noop,
  },
  // ring: a full circle of bullets, then stand still
  {
    enter: (w, e, s) => {
      e.vx = e.vy = 0;
      const n = s.count > 0 ? s.count : 8;
      const off = w.rng.float() * TAU;
      for (let i = 0; i < n; i++) spawnEnemyBullet(w, e.x, e.y, off + (i / n) * TAU, e.def.shotSpeed ?? 90, e.def.shotDamage ?? 10);
      cue(w, CUE.bossRoar);
    },
    update: still,
    exit: noop,
  },
  // summon: spawn s.count of s.spawn around the caster
  {
    enter: (w, e, s) => {
      e.vx = e.vy = 0;
      for (let i = 0; i < s.count; i++) {
        const a = (i / Math.max(1, s.count)) * TAU + e.phase;
        const x = e.x + Math.cos(a) * 20;
        const y = e.y + Math.sin(a) * 20;
        if (boxOpen(w.map, x, y, w.defs.get(s.spawn)?.size ?? 8)) spawnEnemy(w, s.spawn, x, y, false, e.room);
      }
      spark(w, e.x, e.y, 10, 30, 1);
    },
    update: still,
    exit: noop,
  },
  // teleport: jump to a random open spot in the caster's room, away from the player
  {
    enter: (w, e) => {
      e.vx = e.vy = 0;
      const r = w.plan.rooms[e.room];
      if (!r) return;
      for (let t = 0; t < 8; t++) {
        const x = (r.x + 1 + w.rng.float() * (r.w - 2)) * TILE;
        const y = (r.y + 1 + w.rng.float() * (r.h - 2)) * TILE;
        if (!boxOpen(w.map, x, y, e.def.size) || (x - w.player.x) ** 2 + (y - w.player.y) ** 2 < 48 * 48) continue;
        spark(w, e.x, e.y, 6, 30, 1);
        e.x = e.px = x;
        e.y = e.py = y;
        spark(w, x, y, 6, 30, 1);
        return;
      }
    },
    update: still,
    exit: noop,
  },
  // dark: put the lights out for the state's duration
  {
    enter: (w, e, s) => {
      e.vx = e.vy = 0;
      triggerLight(w, { kind: 'blackout', ms: s.ms });
    },
    update: still,
    exit: noop,
  },
  // windup: stand and gather; the wiring layer draws the tell
  { enter: (_w, e) => void (e.vx = e.vy = 0), update: still, exit: noop },
];

export { DT };
