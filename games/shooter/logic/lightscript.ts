// Light tricks as data: a level's script fires entries by wave count or time. Each running trick has a start and an end timestamp.
import { CUE } from './cues';
import { cue } from './world';
import type { LightFx, LightState, ScriptEntry, World } from './types';

export const FX_BLACKOUT = 0;
export const FX_SPOT = 1;
export const FX_STROBE = 2;
export const FX_PULSE = 3;
const KIND_OF: Record<ScriptEntry['kind'], number> = { blackout: FX_BLACKOUT, spotlight: FX_SPOT, strobe: FX_STROBE, pulse: FX_PULSE };
const MAX_FX = 4;

export function newLightState(base: number): LightState {
  const fx: LightFx[] = [];
  for (let i = 0; i < MAX_FX; i++) fx.push({ active: false, kind: 0, startAt: 0, until: 0, x: 0, y: 0, r: 0, hz: 0 });
  return { fx, idx: 0, ambient: base, strobeOn: false, pulse: 0, nextBeatAt: 0, spotOn: false, spotX: 0, spotY: 0, spotR: 0 };
}

/** Start a trick. Full policy (4 at once): the oldest slot is replaced. */
export function triggerLight(w: World, e: ScriptEntry): void {
  const ls = w.light;
  let slot = ls.fx[0]!;
  for (const f of ls.fx) {
    if (!f.active) {
      slot = f;
      break;
    }
    if (f.startAt < slot.startAt) slot = f;
  }
  slot.active = true;
  slot.kind = KIND_OF[e.kind];
  slot.startAt = w.now;
  slot.until = w.now + e.ms;
  // No position given: the room the player is in (or the player's own spot).
  const rm = w.room >= 0 ? w.plan.rooms[w.room] : undefined;
  slot.x = e.x ?? (rm ? (rm.x + rm.w / 2) * 16 : w.player.x);
  slot.y = e.y ?? (rm ? (rm.y + rm.h / 2) * 16 : w.player.y);
  slot.r = e.r ?? 48;
  slot.hz = e.hz ?? 4;
  if (slot.kind === FX_BLACKOUT) cue(w, CUE.blackout);
  if (slot.kind === FX_PULSE) ls.nextBeatAt = w.now;
}

/** Fire any script entries whose trigger has come (in order), then recompute the ambient. */
export function updateLight(w: World): void {
  const ls = w.light;
  const script = w.plan.script;
  while (ls.idx < script.length) {
    const e = script[ls.idx]!;
    const due = e.atWave !== undefined ? w.waveCount >= e.atWave : w.now - w.startedAt >= (e.atMs ?? 0);
    if (!due) break;
    triggerLight(w, e);
    ls.idx++;
  }
  const r = w.rules;
  let amb = w.plan.ambient;
  ls.spotOn = false;
  ls.strobeOn = false;
  ls.pulse = 0;
  for (const f of ls.fx) {
    if (!f.active) continue;
    if (w.now >= f.until) {
      f.active = false;
      continue;
    }
    if (f.kind === FX_BLACKOUT) amb = Math.max(amb, r.ambient_blackout);
    else if (f.kind === FX_SPOT) {
      amb = Math.max(amb, r.spot_ambient);
      ls.spotOn = true;
      ls.spotX = f.x;
      ls.spotY = f.y;
      ls.spotR = f.r;
    } else if (f.kind === FX_STROBE) ls.strobeOn = Math.floor(((w.now - f.startAt) * f.hz) / 1000) % 2 === 0;
    else if (f.kind === FX_PULSE) {
      const ph = ((w.now - f.startAt) % r.pulse_ms) / r.pulse_ms;
      ls.pulse = Math.max(0, Math.sin(ph * Math.PI * 2));
      amb = Math.min(1, amb + r.pulse_amount * ls.pulse);
      if (w.now >= ls.nextBeatAt) {
        cue(w, CUE.heartbeat);
        ls.nextBeatAt = w.now + r.pulse_ms;
      }
    }
  }
  if (w.now < w.player.flareUntil) amb = Math.min(amb, r.ambient_flare);
  ls.ambient = amb;
}
