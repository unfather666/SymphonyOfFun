// Pickups and particles: walk-over collection, expiry, drift.
import { CUE } from './cues';
import { DT } from './consts';
import { cue } from './world';
import type { World } from './types';

export function updatePickups(w: World): void {
  const p = w.player;
  const rr = w.rules.drop_pickup_r + w.rules.player_half;
  const live = w.pickups.live;
  for (let i = w.pickups.n - 1; i >= 0; i--) {
    const k = live[i]!;
    if (w.now >= k.dieAt) {
      w.pickups.release(k);
      continue;
    }
    if ((k.x - p.x) ** 2 + (k.y - p.y) ** 2 > rr * rr) continue;
    if (k.kind === 1) p.hp = Math.min(p.maxHp, p.hp + 25);
    else if (k.kind === 2) p.flares = Math.min(w.rules.flare_max, p.flares + 1);
    else if (w.gainedN < w.gained.length) w.gained[w.gainedN++] = k.arg;
    cue(w, CUE.pickup);
    w.pickups.release(k);
  }
}

export function updateParticles(w: World): void {
  const live = w.particles.live;
  for (let i = w.particles.n - 1; i >= 0; i--) {
    const q = live[i]!;
    if (w.now >= q.dieAt) {
      w.particles.release(q);
      continue;
    }
    q.x += q.vx * DT;
    q.y += q.vy * DT;
    q.vx *= 0.94;
    q.vy *= 0.94;
  }
}
