// Test helper: a scripted player that finishes jobs by walking the street graph at the player's real speed. Used by job tests and the pacing run.
import { nearestSubject } from '../logic/subjects';
import { lineClear } from '../logic/map';
import { streetPath } from '../logic/routes';
import { zoneFor } from '../logic/verbs';
import type { Zone } from '../logic/jobTypes';
import type { SimInput } from '../logic/types';
import { catalog, IDLE, rules } from './harness';
import type { Made } from './harness';

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const SIDE = 7;

export interface Bot {
  /** Walk along the streets toward (x,y); true when there. */
  walk(x: number, y: number, speed: number, input?: SimInput): boolean;
  /** Straight line, for chasing. */
  chase(x: number, y: number, speed: number, input?: SimInput): boolean;
  /** Play the active job to the end; returns steps used, or -1 when it did not finish. */
  play(maxSteps: number): number;
}

export function makeBot(m: Made): Bot {
  const sim = m.sim;
  let route: number[] = [];
  let ri = 0;
  let tx = -1e9, ty = -1e9;

  const place = (nx: number, ny: number, input: SimInput) => {
    sim.deps.physics.setPosition(sim.player.h, nx, ny);
    m.step(input);
  };
  const towards = (x: number, y: number, step: number, input: SimInput): boolean => {
    const pl = sim.player;
    const d = dist(pl.x, pl.y, x, y);
    if (d <= step) {
      place(x, y, input);
      return true;
    }
    place(pl.x + ((x - pl.x) / d) * step, pl.y + ((y - pl.y) / d) * step, input);
    return false;
  };

  const bot: Bot = {
    walk(x, y, speed, input = IDLE) {
      const pl = sim.player;
      if (dist(tx, ty, x, y) > 6) {
        tx = x; ty = y;
        route = [];
        // A straight line is fine when three parallel lines (the body is ~10 px wide) clear the buildings.
        const d = dist(pl.x, pl.y, x, y) || 1;
        const nx = (-(y - pl.y) / d) * SIDE, ny = ((x - pl.x) / d) * SIDE;
        const map = sim.deps.map;
        const straight = lineClear(map, pl.x, pl.y, x, y) && lineClear(map, pl.x + nx, pl.y + ny, x + nx, y + ny) && lineClear(map, pl.x - nx, pl.y - ny, x - nx, y - ny);
        if (!straight) streetPath(map, pl.x, pl.y, x, y, route);
        route.push(x, y);
        ri = 0;
      }
      const step = speed / 60;
      while (ri < route.length - 2 && dist(pl.x, pl.y, route[ri]!, route[ri + 1]!) < 1) ri += 2;
      const done = towards(route[ri]!, route[ri + 1]!, step, input);
      return done && ri >= route.length - 2;
    },
    chase(x, y, speed, input = IDLE) {
      tx = -1e9;
      return towards(x, y, speed / 60, input);
    },
    play(maxSteps) {
      let n = 0;
      const walk = rules.player.speed;
      while (sim.job && n < maxSteps) {
        const job = sim.job;
        const type = catalog.types[job.offer.type]!;
        const step = type.steps[job.step]!;
        const z: Zone | null = zoneFor(job, step);
        const near = nearestSubject(sim, job.subjects, sim.player.x, sim.player.y);
        const carry = sim.carrying >= 0 ? sim.subjects[sim.carrying]!.def!.carryMult : 1;
        const speed = walk * (carry || 1);
        const before = sim.steps;
        const press = { ...IDLE, interact: true };
        switch (step.verb) {
          case 'press':
          case 'grab':
          case 'strike':
          case 'hold': {
            const target = step.zone === 'subject' ? near : null;
            const goal = target ? { x: target.x, y: target.y } : z!;
            const held = step.verb === 'hold' && step.mode === 'press';
            const there = target ? dist(sim.player.x, sim.player.y, goal.x, goal.y) < 14 : dist(sim.player.x, sim.player.y, goal.x, goal.y) < z!.r * 0.5;
            if (!there) {
              if (type.runaway && target) bot.chase(goal.x, goal.y, walk * rules.player.runMult, IDLE);
              else bot.walk(goal.x, goal.y, speed);
            } else if (step.verb === 'hold') m.step({ ...IDLE, hold: held });
            else m.step(press);
            break;
          }
          case 'carry':
          case 'place': {
            const zz = z!;
            const there = dist(sim.player.x, sim.player.y, zz.x, zz.y) < zz.r * 0.5;
            if (!there && sim.carrying >= 0) bot.walk(zz.x, zz.y, speed);
            else if (sim.carrying < 0 && near) {
              if (dist(sim.player.x, sim.player.y, near.x, near.y) < 9) m.step(press);
              else bot.walk(near.x, near.y, walk);
            } else m.step(step.verb === 'place' ? press : IDLE);
            break;
          }
          case 'escort': {
            const zz = z!;
            let lag = false;
            for (const i of job.subjects) {
              const s = sim.subjects[i]!;
              if (s.active && dist(s.x, s.y, sim.player.x, sim.player.y) > s.def!.followDist + 10) lag = true;
            }
            // A real player turns back for a straggler; so does the bot, along the streets.
            const back = near && (dist(near.x, near.y, sim.player.x, sim.player.y) > 120);
            if (back) bot.walk(near.x, near.y, walk);
            else if (lag || dist(sim.player.x, sim.player.y, zz.x, zz.y) < 1) m.step(IDLE);
            else bot.walk(zz.x, zz.y, speed);
            break;
          }
          case 'push': {
            const zz = z!;
            const s = near;
            if (!s) { m.step(IDLE); break; }
            const d = dist(s.x, s.y, zz.x, zz.y);
            const dx = (zz.x - s.x) / (d || 1), dy = (zz.y - s.y) / (d || 1);
            const touch = s.def!.r + rules.player.radius + 2;
            const pl = sim.player;
            // Get behind it once, then really walk into it: the push depends on real movement.
            if (dist(pl.x, pl.y, s.x, s.y) > touch + 6) place(s.x - dx * touch, s.y - dy * touch, IDLE);
            else m.step({ ...IDLE, mx: dx, my: dy });
            break;
          }
          case 'wait': {
            const zz = z!;
            if (dist(sim.player.x, sim.player.y, zz.x, zz.y) < zz.r * 0.5) m.step(IDLE);
            else bot.walk(zz.x, zz.y, walk);
            break;
          }
          default:
            throw new Error(`bot: no plan for verb ${step.verb}`);
        }
        n += sim.steps - before;
      }
      return sim.job ? -1 : n;
    },
  };
  return bot;
}
