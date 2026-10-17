import type { Chip, Clock, EventBus, SfxRecipe } from '../api';
import { DEMO_SONG } from './demoSong';
import { CORE_SFX } from './recipes';
import { createSequencer, type CoreSequencer } from './sequencer';
import type { Synth } from './synth';

export interface CoreChip extends Chip {
  readonly sequencer: CoreSequencer;
  setVolume(v: number): void;
  readonly synth: Synth;
}

export function createChip(clock: Clock, events: EventBus, synth: Synth, warn: (k: string, m: string) => void): CoreChip {
  const recipes = new Map<string, SfxRecipe>(Object.entries(CORE_SFX));
  let vol = 0.8;
  synth.setVolume(vol);
  return {
    synth,
    sequencer: createSequencer(clock, events, synth, warn),
    demoSong: DEMO_SONG,
    sfx(id, opts) {
      const r = recipes.get(id);
      if (!r) {
        warn(`sfx:${id}`, `Unknown sfx "${id}".`);
        return;
      }
      synth.playSfx(r, opts);
    },
    defineSfx(id, recipe) {
      if (!/^[a-z0-9_]+$/.test(id)) {
        warn(`sfx-id:${id}`, `Sfx id "${id}" must match ^[a-z0-9_]+$; not registered.`);
        return;
      }
      recipes.set(id, recipe);
    },
    hasSfx: (id) => recipes.has(id),
    volume: () => vol,
    setVolume(v) {
      vol = Math.max(0, Math.min(1, v));
      synth.setVolume(vol);
    },
  };
}
