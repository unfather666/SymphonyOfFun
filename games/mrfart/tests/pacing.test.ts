// Proves: the scripted player finishes board jobs at every absurdity tier in a sane time; PACING=1 prints the pacing table (more jobs per tier). Area: mrfart M3. 2026-10-17
import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { refreshBoard } from '../logic/sim';
import { startJob } from '../logic/pipeline';
import { makeBot } from './bot';
import { IDLE, makeSim, rules } from './harness';

const PER_TIER = process.env.PACING ? 12 : 2;
const BANDS = [
  { label: 'tier 0 (tasks 0-49)', tasks: 25 },
  { label: 'tier 1 (50-99)', tasks: 75 },
  { label: 'tier 2 (100-149)', tasks: 125 },
  { label: 'tier 3 (150-199)', tasks: 175 },
  { label: 'mixed (200+)', tasks: 600 },
];

test('every band of the climb finishes board jobs, from the board and back', async () => {
  const rows: string[] = [];
  for (const band of BANDS) {
    const m = await makeSim({ people: [], seed: 7 });
    m.sim.meters.nextRollAt = 1e12;
    const bot = makeBot(m);
    m.sim.progress.tasksDone = band.tasks;
    const secs: number[] = [];
    for (let i = 0; i < PER_TIER; i++) {
      m.sim.meters.reputation = rules.reputation.max; // pacing is about travel and work, not about being disliked
      const z = m.sim.boardZone;
      let guard = 0;
      const t0 = m.sim.steps;
      while (!bot.walk(z.x, z.y, rules.player.speed) && guard++ < 60 * 600);
      m.step(IDLE);
      refreshBoard(m.sim, true);
      const offer = m.sim.board.offers[0]!;
      expect(startJob(m.sim, offer)).toBe(true);
      const n = bot.play(60 * 60 * 10);
      const cat = m.sim.deps.catalog;
      expect(n, `${band.label} job ${i}: ${cat.types[offer.type]!.id} x${offer.count} ${cat.subjects[offer.subject]!.id} at ${cat.places[offer.place]!.id} from cell ${offer.origin}, step ${m.sim.job?.step}`).toBeGreaterThan(0);
      secs.push((m.sim.steps - t0) / 60);
      m.sim.progress.tasksDone = band.tasks + i + 1;
    }
    const mean = secs.reduce((a, b) => a + b, 0) / secs.length;
    expect(mean).toBeGreaterThan(5);
    expect(mean).toBeLessThan(600);
    rows.push(`| ${band.label} | ${secs.length} | ${mean.toFixed(0)} | ${(3600 / mean).toFixed(0)} |`);
  }
  if (process.env.PACING) appendFileSync('/tmp/pacing.md', `${rows.join('\n')}\n`);
}, 600000);
