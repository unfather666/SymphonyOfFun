// One fixed step of the world, and a state hash for determinism tests.
import { gridClear, gridInsert } from './grid';
import { computeFlow } from './flow';
import { updateBullets } from './bullets';
import { updateEnemies } from './enemies';
import { updatePlayer } from './player';
import { updateParticles, updatePickups } from './pickups';
import { updateRooms } from './rooms';
import { TILE } from './tiles';
import type { Command, World } from './types';

export function makeCommand(): Command {
  return { mx: 0, my: 0, ax: 0, ay: 0, fire: false, dash: false, flare: false };
}

/** Advance the world one step. `now` is the game clock in ms. */
export function stepWorld(w: World, cmd: Command, now: number): void {
  w.now = now;
  w.stepNo++;
  if (w.status !== 'play') {
    updateParticles(w);
    return;
  }
  // Index enemies first so the player's instant shots (arcs) see them.
  gridClear(w.grid);
  const live = w.enemies.live;
  for (let i = 0; i < w.enemies.n; i++) gridInsert(w.grid, live[i]!.slot, live[i]!.x, live[i]!.y);
  updatePlayer(w, cmd);

  if (w.enemies.n > 0 && now >= w.flowAt) {
    computeFlow(w.map, Math.floor(w.player.x / TILE), Math.floor(w.player.y / TILE), w.flow, w.flowQ, 60);
    w.flowAt = now + 100;
  }

  updateEnemies(w);
  updateBullets(w);
  updateRooms(w);
  updatePickups(w);
  updateParticles(w);
}

/** FNV-1a over the gameplay state (player, enemies, bullets, score). Excludes render-only things. */
export function hashWorld(w: World): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= Math.round(v * 100) | 0;
    h = Math.imul(h, 0x01000193);
  };
  const p = w.player;
  mix(p.x); mix(p.y); mix(p.hp); mix(w.kills); mix(w.enemies.n); mix(w.bullets.n);
  for (let i = 0; i < w.enemies.n; i++) {
    const e = w.enemies.live[i]!;
    mix(e.slot); mix(e.x); mix(e.y); mix(e.hp); mix(e.state);
  }
  for (let i = 0; i < w.bullets.n; i++) {
    const b = w.bullets.live[i]!;
    mix(b.x); mix(b.y);
  }
  return h >>> 0;
}
