// Per-step enemy update: brain state machine, movement with slow / knockback / blind, burn, contact damage.
import { DT, TAU } from './consts';
import { hurtPlayer, damageEnemy } from './combat';
import { lineClear, moveBox, tileAt, T_WATER, BLOCKED_X, BLOCKED_Y } from './tiles';
import { STATES } from './states';
import { drain } from './madness';
import { CUE } from './cues';
import { cue } from './world';
import type { Enemy, World } from './types';

function switchState(w: World, e: Enemy, to: number): void {
  const old = e.brain.states[e.state]!;
  STATES[old.kind]!.exit(w, e);
  e.state = to;
  e.stateAt = w.now;
  const s = e.brain.states[to]!;
  STATES[s.kind]!.enter(w, e, s);
}

function think(w: World, e: Enemy): void {
  const s = e.brain.states[e.state]!;
  const p = w.player;
  const ph = e.brain.phases[e.bossPhase];
  if (ph && e.hp <= e.maxHp * ph.hp) {
    e.bossPhase++;
    cue(w, CUE.bossRoar);
    switchState(w, e, ph.state);
  } else if (s.nearTo >= 0 && (p.x - e.x) ** 2 + (p.y - e.y) ** 2 < s.nearR * s.nearR) switchState(w, e, s.nearTo);
  else if (w.now - e.stateAt >= s.ms) switchState(w, e, s.next);
  if (!e.alive) return;
  const cur = e.brain.states[e.state]!;
  STATES[cur.kind]!.update(w, e, cur);
}

function move(w: World, e: Enemy): void {
  const r = w.rules;
  let f = 1;
  if (w.now < e.slowUntil) f *= r.freeze_slow;
  if (!e.def.flies && tileAt(w.map, Math.floor(e.x / 16), Math.floor(e.y / 16)) === T_WATER) f *= r.water_slow;
  let vx = e.vx;
  let vy = e.vy;
  if (w.now < e.blindUntil) {
    // Blinded: stumble on the current heading at half speed.
    if (w.now >= e.nextActAt) {
      e.heading = w.rng.float() * TAU;
      e.nextActAt = w.now + 300;
    }
    vx = Math.cos(e.heading) * e.def.speed * 0.5;
    vy = Math.sin(e.heading) * e.def.speed * 0.5;
  }
  const flags = moveBox(w.map, e, e.def.size, (vx * f + e.kx) * DT, (vy * f + e.ky) * DT);
  if (flags & (BLOCKED_X | BLOCKED_Y)) e.nextActAt = 0;
  e.kx *= 0.85;
  e.ky *= 0.85;
  if (Math.abs(e.kx) < 1) e.kx = 0;
  if (Math.abs(e.ky) < 1) e.ky = 0;
}

/** Auras raise madness when the player is close; a sweeping eye needs the player in its cone with a clear line. */
function aura(w: World, e: Enemy): void {
  const p = w.player;
  const d = e.def;
  const range = d.auraR ?? w.rules.eye_range;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  if (dx * dx + dy * dy > range * range) return;
  if (d.gaze) {
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - e.heading), Math.cos(Math.atan2(dy, dx) - e.heading));
    if (Math.abs(diff) > (w.rules.eye_cone_deg * Math.PI) / 360 || !e.los) return;
  }
  drain(w, d.madnessAura!);
}

export function updateEnemies(w: World): void {
  const live = w.enemies.live;
  const p = w.player;
  const r = w.rules;
  const touch = r.player_half;
  for (let i = w.enemies.n - 1; i >= 0; i--) {
    const e = live[i]!;
    e.px = e.x;
    e.py = e.y;
    if (((w.stepNo + e.slot) & 3) === 0) e.los = lineClear(w.map, e.x, e.y, p.x, p.y);
    if (w.now < e.burnUntil && w.now >= e.burnTickAt) {
      e.burnTickAt = w.now + 250;
      damageEnemy(w, e, r.burn_dps * 0.25, 0);
      if (!e.alive) continue;
    }
    if (e.def.turnDegS) e.heading += (e.phase > Math.PI ? -1 : 1) * e.def.turnDegS * DT * (Math.PI / 180);
    think(w, e);
    if (!e.alive) continue;
    if (e.hp <= 0) {
      w.enemies.release(e);
      continue;
    }
    move(w, e);
    if (e.def.madnessAura) aura(w, e);
    const rr = e.def.size + touch;
    if (e.def.touchDamage > 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) hurtPlayer(w, e.def.touchDamage);
  }
}
