// Player step: aim, dash, move, fire, flare.
import { CUE } from './cues';
import { DT } from './consts';
import { fireShot } from './bullets';
import { moveBox, tileAt, T_WATER } from './tiles';
import { cue } from './world';
import type { Command, World } from './types';

export function updatePlayer(w: World, cmd: Command): void {
  const p = w.player;
  const r = w.rules;
  p.px = p.x;
  p.py = p.y;
  const mlen = Math.hypot(cmd.mx, cmd.my);
  const alen = Math.hypot(cmd.ax, cmd.ay);
  if (alen > 0.2) {
    p.aimX = cmd.ax / alen;
    p.aimY = cmd.ay / alen;
  } else if (mlen > 0.1) {
    p.aimX = cmd.mx / mlen;
    p.aimY = cmd.my / mlen;
  }

  if (cmd.dash && w.now >= p.dashReadyAt && w.now >= p.dashUntil) {
    const dx = mlen > 0.1 ? cmd.mx / mlen : p.aimX;
    const dy = mlen > 0.1 ? cmd.my / mlen : p.aimY;
    p.dashX = dx;
    p.dashY = dy;
    p.dashUntil = w.now + r.dash_ms;
    p.dashReadyAt = w.now + r.dash_cd_ms;
    if (p.iUntil < p.dashUntil) p.iUntil = p.dashUntil;
    cue(w, CUE.dash);
  }

  let vx: number;
  let vy: number;
  if (w.now < p.dashUntil) {
    const sp = r.dash_dist / (r.dash_ms / 1000);
    vx = p.dashX * sp;
    vy = p.dashY * sp;
  } else {
    let sp = r.player_speed;
    if (tileAt(w.map, Math.floor(p.x / 16), Math.floor(p.y / 16)) === T_WATER) sp *= r.water_slow;
    vx = cmd.mx * sp;
    vy = cmd.my * sp;
  }
  if (vx !== 0 || vy !== 0) p.walk++;
  moveBox(w.map, p, r.player_half, vx * DT, vy * DT);

  if (cmd.flare && p.flares > 0 && w.now >= p.flareUntil) {
    p.flares--;
    p.flareUntil = w.now + r.flare_ms;
    cue(w, CUE.flare);
  }

  if (cmd.fire && w.now >= p.nextShotAt) {
    const spec = w.shot;
    const shot = spec.shots[p.shotIdx % spec.shots.length]!;
    p.shotIdx++;
    p.nextShotAt = w.now + shot.rateMs * (w.now < p.overdriveUntil ? r.overdrive_rate_mul : 1);
    fireShot(w, shot, spec.onHit, spec.onKill);
  }
}
