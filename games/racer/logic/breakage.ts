// Turning a hazard into flying pieces. Used by hits, shields, boost smash-throughs, the horn and slow-mo.
import { FX_BREAK, pushFx } from './fx';
import { burst } from './pieces';
import { seedRand } from './rng';
import type { Sim } from './simtypes';
import { newPose, segPose } from './track';
import { HZ_BROKEN, type Pose, type Segment } from './types';

const pose: Pose = newPose();

/** World position of a hazard's centre (y is the road). */
export function hazardWorld(sim: Sim, seg: Segment, lane: number, out: Pose): Pose {
  segPose(seg, sim.segLen, seg.hzT, out);
  const lat = lane * sim.rules.halfRoadM;
  out.x += Math.cos(out.yaw) * lat;
  out.z += Math.sin(out.yaw) * lat;
  return out;
}

export function breakHazard(sim: Sim, seg: Segment, lane: number): void {
  const d = sim.hazards[seg.hz]!;
  seg.hzState = HZ_BROKEN;
  if (d.breakInto > 0) {
    const p = hazardWorld(sim, seg, lane, pose);
    const r = seedRand(sim.rand, sim.seed, seg.index, 7);
    sim.broken += burst(sim.pieces, r, d.breakInto, p.x, p.y + 0.8, p.z, 7, 6, 0.4, d.pieceColour, sim.nowMs, sim.rules.pieceLifeMs, p.y);
  }
  pushFx(sim.fx, FX_BREAK);
}
