// Where the camera sits and looks. Chase while driving; the death cinematic picks one of three modes. Pure maths on the sim.
import type { Sim } from '../../logic/sim';
import { PHASE_DYING } from '../../logic/simtypes';

export interface CamPose {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
}

/** Fill `out` for the car at (x, y, z) heading `yaw` (the camera's smoothed heading `camYaw` is used for chasing). */
export function cameraPose(sim: Sim, x: number, y: number, z: number, camYaw: number, nowMs: number, out: CamPose): CamPose {
  const r = sim.rules;
  const def = sim.phase === PHASE_DYING ? sim.calamities[sim.calamity] : undefined;
  const fx = Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  if (!def || def.camera === 'chase') {
    out.px = x - fx * r.cameraBack;
    out.py = y + r.cameraUp;
    out.pz = z - fz * r.cameraBack;
    out.tx = x + fx * 10;
    out.ty = y + 1.2;
    out.tz = z + fz * 10;
    return out;
  }
  const since = (nowMs - sim.deathAtMs) / 1000;
  if (def.camera === 'orbit') {
    const a = camYaw + 0.8 + since * 0.9;
    out.px = x + Math.cos(a) * 11;
    out.py = y + 4.5;
    out.pz = z + Math.sin(a) * 11;
  } else {
    // Fall: stay up on the road edge and watch the car go down.
    out.px = x - fx * (r.cameraBack + 2);
    out.py = y - sim.car.h + 6;
    out.pz = z - fz * (r.cameraBack + 2);
  }
  out.tx = x;
  out.ty = y + 1;
  out.tz = z;
  return out;
}
