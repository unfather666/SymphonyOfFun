// Builds one segment's road, edge, ground, tunnel/split dressing and roadside props into a pooled geometry.
import { box, clearGeo, flushGeo, parts, quad, type Geo } from './geo';
import { newPose, segPose } from '../../logic/track';
import type { Pose, Rules, Segment } from '../../logic/types';

export interface SegmentAssets {
  rules: Rules;
  segLen: number;
  palette: Float32Array;
  /** Parts table per theme prop slot. */
  props: readonly (readonly (readonly number[])[])[];
  /** Segment index that carries the finish arch, or -1. */
  archIndex: number;
}

const p0: Pose = newPose();
const p1: Pose = newPose();
const FAR = 40;
const DROP_Y = -6;
const GAP_Y = -14;

const c = (pal: Float32Array, i: number, k = 1): [number, number, number] => [pal[i * 3]! * k, pal[i * 3 + 1]! * k, pal[i * 3 + 2]! * k];

function strip(g: Geo, seg: Segment, a: Pose, b: Pose, xa: number, xb: number, ya: number, yb: number, col: readonly [number, number, number]): void {
  const ra = Math.cos(a.yaw), sa = Math.sin(a.yaw);
  const rb = Math.cos(b.yaw), sb = Math.sin(b.yaw);
  const ox = seg.x0, oy = seg.y0, oz = seg.z0;
  quad(g,
    a.x - ox + ra * xa, a.y - oy + ya, a.z - oz + sa * xa,
    a.x - ox + ra * xb, a.y - oy + yb, a.z - oz + sa * xb,
    b.x - ox + rb * xb, b.y - oy + yb, b.z - oz + sb * xb,
    b.x - ox + rb * xa, b.y - oy + ya, b.z - oz + sb * xa,
    col[0], col[1], col[2]);
}

export function buildSegment(g: Geo, seg: Segment, a: SegmentAssets): void {
  clearGeo(g);
  const pal = a.palette;
  const len = a.segLen;
  const R = a.rules.halfRoadM * seg.halfWidth;
  const S = a.rules.segmentSlices;
  const groundY = seg.drop ? DROP_Y : -0.06;
  const xs = [-FAR, -(R + 1.8), -R, -R / 3 - 0.12, -R / 3 + 0.12, R / 3 - 0.12, R / 3 + 0.12, R, R + 1.8, FAR];
  for (let j = 0; j < S; j++) {
    segPose(seg, len, j / S, p0);
    segPose(seg, len, (j + 1) / S, p1);
    const par = (seg.index * S + j) & 1;
    const ground = c(pal, par ? 6 : 5);
    if (seg.gap) {
      strip(g, seg, p0, p1, xs[0]!, xs[9]!, GAP_Y, GAP_Y, c(pal, 6, 0.6));
      continue;
    }
    strip(g, seg, p0, p1, xs[0]!, xs[1]!, groundY, groundY, ground);
    strip(g, seg, p0, p1, xs[8]!, xs[9]!, groundY, groundY, ground);
    const shoulder = c(pal, 4, par ? 1 : 0.92);
    strip(g, seg, p0, p1, xs[1]!, xs[2]!, -0.02, -0.02, shoulder);
    strip(g, seg, p0, p1, xs[7]!, xs[8]!, -0.02, -0.02, shoulder);
    const road = c(pal, par ? 2 : 1);
    const dash = (j & 1) === 0;
    const line = dash ? c(pal, 3) : road;
    strip(g, seg, p0, p1, xs[2]!, xs[3]!, 0, 0, road);
    strip(g, seg, p0, p1, xs[3]!, xs[4]!, 0, 0, line);
    strip(g, seg, p0, p1, xs[4]!, xs[5]!, 0, 0, road);
    strip(g, seg, p0, p1, xs[5]!, xs[6]!, 0, 0, line);
    strip(g, seg, p0, p1, xs[6]!, xs[7]!, 0, 0, road);
  }
  if (!seg.gap) {
    // Beat line across the road at the start of every segment; brighter and wider on the bar line.
    const bar = seg.index % 4 === 0;
    segPose(seg, len, 0, p0);
    segPose(seg, len, (bar ? 1.2 : 0.6) / len, p1);
    strip(g, seg, p0, p1, -R, R, 0.03, 0.03, bar ? c(pal, 15) : c(pal, 10));
    segPose(seg, len, 0.5, p0);
    const mx = p0.x - seg.x0, my = p0.y - seg.y0, mz = p0.z - seg.z0;
    if (seg.split) box(g, mx, my, mz, p0.yaw, 0, 0, 0, 2.4, 1.1, len * 0.8, ...c(pal, 12));
    if (seg.tunnel) {
      box(g, mx, my, mz, p0.yaw, -(R + 0.5), 0, 0, 1, 5, len, ...c(pal, 14, 1.4));
      box(g, mx, my, mz, p0.yaw, R + 0.5, 0, 0, 1, 5, len, ...c(pal, 14, 1.4));
      box(g, mx, my, mz, p0.yaw, 0, 5, 0, R * 2 + 2, 0.5, len, ...c(pal, 14, 1.8));
    }
    if (seg.index === a.archIndex) {
      box(g, mx, my, mz, p0.yaw, -(R + 0.8), 0, 0, 1.2, 7, 1.2, ...c(pal, 15));
      box(g, mx, my, mz, p0.yaw, R + 0.8, 0, 0, 1.2, 7, 1.2, ...c(pal, 15));
      box(g, mx, my, mz, p0.yaw, 0, 7, 0, R * 2 + 2.8, 1.4, 1.2, ...c(pal, 10));
      box(g, mx, my, mz, p0.yaw, 0, 7.2, 0.7, R * 2 + 2, 1, 0.1, ...c(pal, 15));
    }
    for (let i = 0; i < seg.propType.length; i++) {
      const t = seg.propType[i]!;
      if (t < 0) continue;
      const list = a.props[t];
      if (!list) continue;
      segPose(seg, len, seg.propT[i]!, p0);
      const lat = seg.propX[i]!;
      const ox = p0.x - seg.x0 + Math.cos(p0.yaw) * lat;
      const oz = p0.z - seg.z0 + Math.sin(p0.yaw) * lat;
      parts(g, ox, p0.y - seg.y0 + (seg.drop ? DROP_Y : -0.06), oz, p0.yaw + (seg.propT[i]! > 0.5 ? Math.PI / 2 : 0), list, pal);
    }
  }
  flushGeo(g);
}
