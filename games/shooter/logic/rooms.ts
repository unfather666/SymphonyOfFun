// Rooms and waves: a room wakes when the player steps in, spawns its waves one after another, and the exit opens when every room is clear.
import { TILE, T_EXIT_OPEN } from './tiles';
import { spawnEnemy } from './world';
import { CUE } from './cues';
import { cue } from './world';
import type { World } from './types';

const SPAWNS_PER_STEP = 8;

export function updateRooms(w: World): void {
  const p = w.player;
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  w.room = tx >= 0 && ty >= 0 && tx < w.map.w && ty < w.map.h ? w.roomMap[ty * w.map.w + tx]! : -1;

  w.roomAlive.fill(0);
  const live = w.enemies.live;
  for (let i = 0; i < w.enemies.n; i++) {
    const rm = live[i]!.room;
    if (rm >= 0) w.roomAlive[rm]!++;
  }

  const plan = w.plan;
  for (let i = 0; i < plan.rooms.length; i++) {
    const st = w.rooms[i]!;
    if (st.state === 2) continue;
    if (st.state === 0) {
      if (w.room !== i) continue;
      st.state = 1;
      st.wave = 0;
      st.spawned = 0;
      st.nextWaveAt = w.now;
    }
    const waves = plan.rooms[i]!.waves;
    const wave = waves[st.wave]!;
    if (st.spawned < wave.length) {
      if (w.now < st.nextWaveAt) continue;
      for (let k = 0; k < SPAWNS_PER_STEP && st.spawned < wave.length; k++) {
        const s = wave[st.spawned]!;
        // Full policy: the wave waits for pool space.
        if (!spawnEnemy(w, s.def, s.x, s.y, s.elite === true, i)) break;
        st.spawned++;
      }
    } else if (w.roomAlive[i] === 0) {
      st.wave++;
      st.spawned = 0;
      st.nextWaveAt = w.now + w.rules.wave_gap_ms;
      if (st.wave >= waves.length) st.state = 2;
    }
  }

  if (!w.exitOpen) {
    let all = true;
    for (let i = 0; i < w.rooms.length; i++) if (w.rooms[i]!.state !== 2) all = false;
    if (all && plan.exit) {
      w.exitOpen = true;
      w.map.data[Math.floor(plan.exit.y / TILE) * w.map.w + Math.floor(plan.exit.x / TILE)] = T_EXIT_OPEN;
      cue(w, CUE.pickup);
    }
  } else if (plan.exit && w.status === 'play') {
    if ((p.x - plan.exit.x) ** 2 + (p.y - plan.exit.y) ** 2 < 100) {
      w.status = 'cleared';
      cue(w, CUE.cleared);
    }
  }
}
