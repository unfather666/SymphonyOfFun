// Track generator: one Segment per beat, data only. Deterministic from (seed, index) plus the running state.
import { DEG, MAX_PROPS, type KindDef, type Rules, type Segment, type ThemeDef } from './types';
import { randFloat, seedRand, type Rand } from './rng';

export interface GenState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  lastKind: number;
  run: number;
  pendingGap: boolean;
}

export interface GenCtx {
  seed: number;
  kinds: readonly KindDef[];
  /** Kind weight × theme multiplier, one per kind. */
  weights: Float64Array;
  theme: ThemeDef;
  rules: Rules;
  segLen: number;
  rand: Rand;
  straight: number;
  gap: number;
}

export function newGenState(): GenState {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lastKind: 0, run: 0, pendingGap: false };
}

export function copyGen(dst: GenState, src: GenState): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.yaw = src.yaw;
  dst.pitch = src.pitch;
  dst.lastKind = src.lastKind;
  dst.run = src.run;
  dst.pendingGap = src.pendingGap;
}

export function newSegment(): Segment {
  return {
    index: -1, kind: 0, x0: 0, y0: 0, z0: 0, yaw0: 0, pitch0: 0, x1: 0, y1: 0, z1: 0, yaw1: 0, pitch1: 0,
    halfWidth: 1, gap: false, ramp: false, tunnel: false, split: false, drop: false,
    propType: [-1, -1, -1, -1], propX: [0, 0, 0, 0], propT: [0, 0, 0, 0],
  };
}

export function makeWeights(kinds: readonly KindDef[], theme: ThemeDef): Float64Array {
  const w = new Float64Array(kinds.length);
  for (let i = 0; i < kinds.length; i++) {
    const k = kinds[i]!;
    w[i] = k.weight * (theme.kindWeights[k.id] ?? 1);
  }
  return w;
}

/** Is kind k allowed after the current state? Keeps the road inside the heading and pitch caps and runs short. */
function allowed(ctx: GenCtx, st: GenState, k: number): boolean {
  const kd = ctx.kinds[k]!;
  const yawCap = ctx.rules.yawCapDeg * DEG;
  const pitchCap = ctx.rules.pitchCapDeg * DEG;
  if (k === st.lastKind && st.run >= kd.maxRun) return false;
  if (kd.turnDeg !== 0 && Math.abs(st.yaw + kd.turnDeg * DEG) > yawCap) return false;
  if (kd.dPitchDeg > 0 && st.pitch >= pitchCap - 1e-6) return false;
  if (kd.dPitchDeg < 0 && st.pitch <= -pitchCap + 1e-6) return false;
  return true;
}

function pickKind(ctx: GenCtx, st: GenState, index: number, r: Rand): number {
  if (st.pendingGap) return ctx.gap;
  if (index < ctx.rules.startSafeBeats || st.lastKind === ctx.gap) return ctx.straight;
  const last = ctx.kinds[st.lastKind]!;
  if (last.turnDeg !== 0 && allowed(ctx, st, st.lastKind) && randFloat(r) < ctx.rules.curveStayChance) return st.lastKind;
  // Pull the road back toward straight ahead when the heading is far off.
  const lean = Math.abs(st.yaw) > ctx.rules.yawCapDeg * DEG * 0.6;
  let total = 0;
  for (let k = 0; k < ctx.kinds.length; k++) {
    let w = ctx.weights[k]!;
    if (w <= 0 || !allowed(ctx, st, k)) continue;
    const t = ctx.kinds[k]!.turnDeg;
    if (lean && t !== 0) w *= t * st.yaw < 0 ? 4 : 0.25;
    total += w;
  }
  if (total <= 0) return ctx.straight;
  let roll = randFloat(r) * total;
  for (let k = 0; k < ctx.kinds.length; k++) {
    let w = ctx.weights[k]!;
    if (w <= 0 || !allowed(ctx, st, k)) continue;
    const t = ctx.kinds[k]!.turnDeg;
    if (lean && t !== 0) w *= t * st.yaw < 0 ? 4 : 0.25;
    roll -= w;
    if (roll < 0) return k;
  }
  return ctx.straight;
}

/** Fill `seg` with segment `index` and advance `st` to its end. */
export function genSegment(seg: Segment, st: GenState, index: number, ctx: GenCtx): void {
  const r = seedRand(ctx.rand, ctx.seed, index, 1);
  const k = pickKind(ctx, st, index, r);
  const kd = ctx.kinds[k]!;
  const pitchCap = ctx.rules.pitchCapDeg * DEG;
  seg.index = index;
  seg.kind = k;
  seg.x0 = st.x;
  seg.y0 = st.y;
  seg.z0 = st.z;
  seg.yaw0 = st.yaw;
  seg.yaw1 = st.yaw + kd.turnDeg * DEG;
  if (kd.gap) {
    seg.pitch0 = 0;
    seg.pitch1 = 0;
  } else {
    seg.pitch0 = st.pitch;
    if (kd.pitchToDeg !== undefined) seg.pitch1 = kd.pitchToDeg * DEG;
    else if (kd.dPitchDeg !== 0) seg.pitch1 = Math.max(-pitchCap, Math.min(pitchCap, st.pitch + kd.dPitchDeg * DEG));
    else seg.pitch1 = Math.abs(st.pitch) < 0.004 ? 0 : st.pitch * 0.5;
  }
  const ang = (seg.yaw0 + seg.yaw1) / 2;
  seg.x1 = seg.x0 + Math.sin(ang) * ctx.segLen;
  seg.z1 = seg.z0 - Math.cos(ang) * ctx.segLen;
  seg.y1 = seg.y0 + (ctx.segLen * (seg.pitch0 + seg.pitch1)) / 2;
  seg.halfWidth = kd.halfWidth;
  seg.gap = kd.gap === true;
  seg.ramp = kd.ramp === true;
  seg.tunnel = kd.tunnel === true;
  seg.split = kd.split === true;
  seg.drop = kd.drop === true;

  const nProps = seg.tunnel || seg.gap || ctx.theme.props.length === 0 ? 0 : Math.min(MAX_PROPS, ctx.rules.propsPerSegment);
  for (let i = 0; i < MAX_PROPS; i++) {
    if (i < nProps) {
      seg.propType[i] = Math.floor(randFloat(r) * ctx.theme.props.length);
      seg.propX[i] = (i & 1 ? 1 : -1) * (ctx.rules.halfRoadM * seg.halfWidth + 3 + randFloat(r) * 16);
      seg.propT[i] = randFloat(r);
    } else {
      seg.propType[i] = -1;
    }
  }

  st.x = seg.x1;
  st.y = seg.y1;
  st.z = seg.z1;
  st.yaw = seg.yaw1;
  st.pitch = seg.pitch1;
  st.run = k === st.lastKind ? st.run + 1 : 1;
  st.lastKind = k;
  if (seg.ramp) st.pendingGap = randFloat(r) < ctx.theme.gapChance;
}
