// Render-side hallucinations and whispers. Reads the sim, never changes it: own random stream, own pool, nothing here is hashed.
import { CUE } from './cues';
import { DT } from './consts';
import { tierOf } from './madness';
import { cue } from './world';
import type { World } from './types';

const SPAWN_REACH_MIN = 70;
const SPAWN_REACH_MAX = 140;

function spawnGhost(w: World, x: number, y: number, kind: number, arg: number): void {
  const g = w.ghosts.acquire();
  if (!g) return;
  const p = w.player;
  const dx = p.x - x;
  const dy = p.y - y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = kind === 1 ? 90 : w.rules.ghost_speed;
  g.x = x;
  g.y = y;
  g.vx = (dx / d) * sp;
  g.vy = (dy / d) * sp;
  g.kind = kind;
  g.arg = arg;
  g.dieAt = w.now + (kind === 1 ? 2000 : w.rules.ghost_life_ms);
}

export function updateFx(w: World): void {
  const r = w.rules;
  const tier = tierOf(w.madness, r);
  const p = w.player;
  const fr = w.fxRng;

  // Move ghosts; they vanish when shot at, when they reach the player, or when their time is up.
  const gs = w.ghosts.live;
  for (let i = w.ghosts.n - 1; i >= 0; i--) {
    const g = gs[i]!;
    g.x += g.vx * DT;
    g.y += g.vy * DT;
    let gone = w.now >= g.dieAt || tier < 3 || (g.x - p.x) ** 2 + (g.y - p.y) ** 2 < 144;
    if (!gone && g.kind === 0) {
      const bs = w.bullets.live;
      for (let b = 0; b < w.bullets.n && !gone; b++) if (bs[b]!.owner === 0 && (bs[b]!.x - g.x) ** 2 + (bs[b]!.y - g.y) ** 2 < 100) gone = true;
    }
    if (gone) w.ghosts.release(g);
  }

  if (tier >= 3 && w.now >= w.fxNextAt) {
    w.fxNextAt = w.now + r.ghost_gap_ms * (1.3 - 0.15 * tier) * (0.6 + fr.float() * 0.8);
    const a = fr.float() * Math.PI * 2;
    const d = SPAWN_REACH_MIN + fr.float() * (SPAWN_REACH_MAX - SPAWN_REACH_MIN);
    const defs = w.defList;
    spawnGhost(w, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, fr.chance(0.7) ? 0 : 1, defs.length ? fr.int(0, defs.length - 1) : 0);
  }

  // Dreamers send their own ghosts.
  const es = w.enemies.live;
  for (let i = 0; i < w.enemies.n; i++) {
    const e = es[i]!;
    const ms = e.def.ghostMs;
    if (ms && (w.stepNo + e.slot * 7) % Math.max(1, Math.round(ms / 16.667)) === 0) spawnGhost(w, e.x, e.y, 0, w.defIndex.get(e.def.id) ?? 0);
  }

  if (tier >= 2 && w.now >= w.whisperAt) {
    w.whisperAt = w.now + r.whisper_gap_ms * (0.6 + fr.float() * 0.8);
    cue(w, CUE.whisper);
  }
}
