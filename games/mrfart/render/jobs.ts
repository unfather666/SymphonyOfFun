// Drawing for jobs: the board sign, step zones with an edge arrow, subjects and leashes. Reads state only.
import type { Gfx2d } from '../../../src/core/api';
import { SCREEN_H, SCREEN_W } from '../../../src/core/api';
import { SS_CARRIED, SS_TREE } from '../logic/jobTypes';
import { zoneFor } from '../logic/verbs';
import type { Sim } from '../logic/sim';

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const leashBuf = new Float64Array(16);

export function drawBoard(g: Gfx2d, sim: Sim, cx: number, cy: number): void {
  const z = sim.boardZone;
  g.rect(z.x - cx - 5, z.y - cy - 10, 10, 8, 12);
  g.rect(z.x - cx - 4, z.y - cy - 9, 8, 6, 19);
  g.rect(z.x - cx - 1, z.y - cy - 2, 2, 6, 12);
}

export function drawZone(g: Gfx2d, sim: Sim, cx: number, cy: number): void {
  const job = sim.job;
  if (!job) return;
  const step = sim.deps.catalog.types[job.offer.type]!.steps[job.step]!;
  const z = zoneFor(job, step);
  if (!z) return;
  const x = z.x - cx, y = z.y - cy;
  const pulse = 1 + Math.sin(sim.now / 180) * 0.08;
  for (let k = 0; k < 24; k++) g.rect(x + Math.cos((k / 24) * TAU) * z.r * pulse - 1, y + Math.sin((k / 24) * TAU) * z.r * pulse - 1, 2, 2, 18);
  if (x < 0 || y < 0 || x > SCREEN_W || y > SCREEN_H) {
    const dx = x - SCREEN_W / 2, dy = y - SCREEN_H / 2;
    const k = Math.min((SCREEN_W / 2 - 8) / Math.abs(dx || 1), (SCREEN_H / 2 - 8) / Math.abs(dy || 1));
    g.rect(SCREEN_W / 2 + dx * k - 3, SCREEN_H / 2 + dy * k - 3, 7, 7, 18);
    g.rect(SCREEN_W / 2 + dx * k - 1, SCREEN_H / 2 + dy * k - 1, 3, 3, 2);
  }
}

export function drawSubjects(g: Gfx2d, sim: Sim, cx: number, cy: number, alpha: number): void {
  const physics = sim.deps.physics;
  for (let i = 0; i < sim.subjects.length; i++) {
    const s = sim.subjects[i]!;
    if (!s.active) continue;
    const d = s.def!;
    const x = lerp(s.px, s.x, alpha) - cx, y = lerp(s.py, s.y, alpha) - cy + (s.state === SS_TREE ? -8 : 0);
    if (s.leash) {
      const n = physics.leashPoints(s.leash, leashBuf);
      for (let k = 0; k + 1 < n; k++) g.line(leashBuf[k * 2]! - cx, leashBuf[k * 2 + 1]! - cy, leashBuf[k * 2 + 2]! - cx, leashBuf[k * 2 + 3]! - cy, 12);
    }
    const w = d.r * 2 + (d.mass > 5 ? 4 : 0), h = d.r * 2;
    g.rect(x - w / 2, y - h / 2, w, h, d.colour);
    g.frame(x - w / 2, y - h / 2, w, h, 2);
    g.rect(x - w / 2 + 1, y - h / 2 + 1, 2, 2, 7);
    if (s.state === SS_CARRIED) g.rect(x - 1, y + h / 2, 2, 3, 2);
  }
}
