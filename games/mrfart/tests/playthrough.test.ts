// Proves: ten game minutes of scripted play with all 60 residents about, no job gets stuck and the run is still on. Area: mrfart M4. 2026-10-17
import { expect, test } from 'vitest';
import { refreshBoard } from '../logic/sim';
import { startJob } from '../logic/pipeline';
import { STATUS_PLAYING } from '../logic/types';
import { makeBot } from './bot';
import { IDLE, makeSim, rules } from './harness';

test('ten minutes of play: every job finishes within four minutes, none is stuck', async () => {
  const m = await makeSim({ seed: 11 });
  const bot = makeBot(m);
  const z = m.sim.boardZone;
  const longest = { steps: 0 };
  while (m.sim.steps < 60 * 60 * 10) {
    let guard = 0;
    while (!bot.walk(z.x, z.y, rules.player.speed) && guard++ < 60 * 600);
    m.step(IDLE);
    refreshBoard(m.sim, true);
    const offer = m.sim.board.offers[0]!;
    expect(startJob(m.sim, offer)).toBe(true);
    const t0 = m.sim.steps;
    const n = bot.play(60 * 60 * 4);
    expect(n, `stuck in ${m.sim.deps.catalog.types[offer.type]!.id} x${offer.count} ${m.sim.deps.catalog.subjects[offer.subject]!.id} at ${m.sim.deps.catalog.places[offer.place]!.id} origin ${offer.origin}, step ${m.sim.job?.step}, task ${m.sim.progress.tasksDone}`).toBeGreaterThan(0);
    longest.steps = Math.max(longest.steps, m.sim.steps - t0);
    expect(m.sim.status).toBe(STATUS_PLAYING);
  }
  expect(m.sim.progress.tasksDone).toBeGreaterThanOrEqual(15);
  expect(longest.steps / 60).toBeLessThan(240);
}, 600000);
