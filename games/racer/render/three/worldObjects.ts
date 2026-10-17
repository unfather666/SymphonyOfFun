// Hazards and pickups near the car, rebuilt into one preallocated geometry every frame (one draw call). Reads the sim only.
import { DoubleSide, Mesh, MeshBasicMaterial, type Scene } from 'three';
import { box, clearGeo, makeGeo, parts, partsMoved, type Geo } from './geo';
import { hazardActive, hazardCycle, hazardLane } from '../../logic/hazards';
import type { Sim } from '../../logic/sim';
import { hasSeg, newPose, segAt, segPose } from '../../logic/track';
import { HZ_BROKEN, type HazardDef, type Pose, type Segment } from '../../logic/types';

/** Vertex budget. Full policy: boxes that do not fit are skipped (the far ones drawn last). */
const WORLD_VERTS = 16384;
/** How far ahead of the cycle's active window the warning shows, as a fraction of the cycle. */
const WARN = 0.25;

const pose: Pose = newPose();

export interface WorldObjects {
  update(sim: Sim, nowMs: number): void;
  dispose(): void;
}

export function createWorldObjects(scene: Scene, palette: Float32Array): WorldObjects {
  const g: Geo = makeGeo(WORLD_VERTS);
  const mesh = new Mesh(g.geometry, new MeshBasicMaterial({ vertexColors: true, fog: true, side: DoubleSide }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const pal = palette;

  function drawHazard(sim: Sim, seg: Segment, d: HazardDef, nowMs: number): void {
    const beatMs = sim.beat.periodMs;
    const lane = hazardLane(d, seg, nowMs, beatMs);
    segPose(seg, sim.segLen, seg.hzT, pose);
    const R = sim.rules.halfRoadM;
    const wx = pose.x + Math.cos(pose.yaw) * lane * R;
    const wz = pose.z + Math.sin(pose.yaw) * lane * R;
    const wy = pose.y;
    if (d.motion !== 'periodic') {
      parts(g, wx, wy, wz, pose.yaw, d.parts, pal);
      return;
    }
    const c = hazardCycle(d, seg, nowMs, beatMs);
    const active = hazardActive(d, seg, nowMs, beatMs);
    const toActive = (d.activeFrom - c + 1) % 1;
    const warn = !active && toActive < WARN;
    if (warn && (nowMs >> 6) % 2 === 0) box(g, wx, wy, wz, pose.yaw, 0, 0.02, 0, d.halfW * R * 2, 0.05, d.halfLen * 2, pal[33]!, pal[34]!, pal[35]!);
    if (d.visual === 'slide') {
      // Crosses the road along its own length while active; parked off the road otherwise.
      const span = R * d.span + d.parts[0]![5]! * 0.5 + 2;
      const t = active ? (c - d.activeFrom) / (d.activeTo - d.activeFrom) : c < d.activeFrom ? 0 : 1;
      partsMoved(g, wx, wy, wz, pose.yaw + Math.PI / 2, d.parts, pal, 0, 0, -span + t * span * 2, 1);
    } else if (d.visual === 'squish') {
      // All but the last part hover; the last is the beam, shown while active and flickering in the warning.
      const n = d.parts.length;
      partsMoved(g, wx, wy, wz, pose.yaw, d.parts, pal, 0, 0, 0, 1, 0, n - 1);
      if (active || (warn && (nowMs >> 5) % 3 === 0)) partsMoved(g, wx, wy, wz, pose.yaw, d.parts, pal, 0, 0, 0, 1, n - 1, n);
    } else if (d.visual === 'drop') {
      const lift = active ? 0 : warn ? (toActive / WARN) * 10 : 10;
      partsMoved(g, wx, wy, wz, pose.yaw, d.parts, pal, 0, lift, 0, 1);
    } else parts(g, wx, wy, wz, pose.yaw, d.parts, pal);
  }

  function drawPickup(sim: Sim, seg: Segment, nowMs: number): void {
    const def = sim.powers[seg.pk]!;
    segPose(seg, sim.segLen, seg.pkT, pose);
    const R = sim.rules.halfRoadM;
    const bob = Math.sin(nowMs / 220 + seg.index) * 0.15;
    const x = pose.x + Math.cos(pose.yaw) * seg.pkLane * R;
    const z = pose.z + Math.sin(pose.yaw) * seg.pkLane * R;
    parts(g, x, pose.y + bob, z, nowMs / 500 + seg.index, def.parts, pal);
  }

  return {
    update(sim, nowMs) {
      clearGeo(g);
      const carSeg = Math.floor(sim.car.s / sim.segLen);
      const hi = carSeg + sim.rules.lookaheadBeats;
      for (let j = Math.max(0, carSeg - 2); j <= hi; j++) {
        if (!hasSeg(sim.track, j)) continue;
        const seg = segAt(sim.track, j);
        if (seg.hz >= 0 && seg.hzState !== HZ_BROKEN) drawHazard(sim, seg, sim.hazards[seg.hz]!, nowMs);
        if (seg.pk >= 0 && seg.pkState !== HZ_BROKEN) drawPickup(sim, seg, nowMs);
      }
      g.posAttr.needsUpdate = true;
      g.colAttr.needsUpdate = true;
      g.geometry.setDrawRange(0, g.n);
    },
    dispose() {
      g.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    },
  };
}
