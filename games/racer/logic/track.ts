// The track as a ring of pooled segments plus section snapshots, so a respawn can regenerate the same road.
import { DEG, type KindDef, type Pose, type Rules, type Segment, type ThemeDef } from './types';
import { copyGen, genSegment, makeWeights, newGenState, newSegment, type GenCtx, type GenState } from './trackgen';
import { newRand } from './rng';

export interface Track {
  ctx: GenCtx;
  ring: Segment[];
  mask: number;
  /** Next index to generate. The ring holds [next - ring.length, next). */
  next: number;
  state: GenState;
  sectionBeats: number;
  /** Generator state at the start of every section (index k * sectionBeats). */
  snaps: GenState[];
  lookahead: number;
}

export const MAX_SECTIONS = 96;

export interface TrackOpts {
  seed: number;
  kinds: readonly KindDef[];
  theme: ThemeDef;
  rules: Rules;
  segLen: number;
  sectionBeats: number;
}

export function createTrack(o: TrackOpts): Track {
  const size = o.rules.segmentPool;
  if ((size & (size - 1)) !== 0 || size < o.rules.lookaheadBeats + o.rules.behindBeats + 2) throw new Error('segmentPool must be a power of two above lookahead + behind');
  const straight = o.kinds.findIndex((k) => k.id === 'straight');
  const gap = o.kinds.findIndex((k) => k.id === 'gap');
  if (straight < 0 || gap < 0) throw new Error('road kinds "straight" and "gap" are required');
  const ctx: GenCtx = { seed: o.seed, kinds: o.kinds, weights: makeWeights(o.kinds, o.theme), theme: o.theme, rules: o.rules, segLen: o.segLen, rand: newRand(), straight, gap };
  const ring: Segment[] = [];
  for (let i = 0; i < size; i++) ring.push(newSegment());
  const snaps: GenState[] = [];
  for (let i = 0; i < MAX_SECTIONS; i++) snaps.push(newGenState());
  return { ctx, ring, mask: size - 1, next: 0, state: newGenState(), sectionBeats: o.sectionBeats, snaps, lookahead: o.rules.lookaheadBeats };
}

/** Generate the next segment (snapshotting section starts). Returns it. */
export function generateNext(t: Track): Segment {
  const i = t.next;
  if (i % t.sectionBeats === 0) {
    const k = i / t.sectionBeats;
    if (k < MAX_SECTIONS) copyGen(t.snaps[k]!, t.state);
  }
  const seg = t.ring[i & t.mask]!;
  genSegment(seg, t.state, i, t.ctx);
  t.next = i + 1;
  return seg;
}

/** Make sure segments exist up to carSeg + lookahead. */
export function ensure(t: Track, carSeg: number): void {
  while (t.next <= carSeg + t.lookahead) generateNext(t);
}

export function hasSeg(t: Track, index: number): boolean {
  return index < t.next && index >= t.next - t.ring.length && index >= 0;
}

export function segAt(t: Track, index: number): Segment {
  return t.ring[index & t.mask]!;
}

/** Go back to the start of the section containing `beat`; returns that section's first beat. */
export function restartAt(t: Track, beat: number): number {
  const k = Math.min(MAX_SECTIONS - 1, Math.floor(beat / t.sectionBeats));
  copyGen(t.state, t.snaps[k]!);
  t.next = k * t.sectionBeats;
  return t.next;
}

/** Pose at fraction t (0..1) of a segment. Shared by the car and the mesh builder. */
export function segPose(seg: Segment, len: number, t: number, out: Pose): Pose {
  const ang = seg.yaw0 + ((seg.yaw1 - seg.yaw0) * t) / 2;
  out.x = seg.x0 + Math.sin(ang) * t * len;
  out.z = seg.z0 - Math.cos(ang) * t * len;
  out.y = seg.y0 + len * (seg.pitch0 * t + ((seg.pitch1 - seg.pitch0) * t * t) / 2);
  out.yaw = seg.yaw0 + (seg.yaw1 - seg.yaw0) * t;
  out.pitch = seg.pitch0 + (seg.pitch1 - seg.pitch0) * t;
  out.seg = seg.index;
  out.t = t;
  return out;
}

/** Pose at arc distance s along the track. The segment must be inside the ring window. */
export function poseAt(t: Track, s: number, out: Pose): Pose {
  const len = t.ctx.segLen;
  const idx = Math.max(0, Math.floor(s / len));
  const seg = t.ring[idx & t.mask]!;
  return segPose(seg, len, Math.min(1, Math.max(0, s / len - idx)), out);
}

export const rad = (deg: number): number => deg * DEG;

export function newPose(): Pose {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, seg: 0, t: 0 };
}
