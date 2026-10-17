import type { SfxRecipe } from '../api';

/** The 8 core recipes. Games add their own with chip.defineSfx. */
export const CORE_SFX: Readonly<Record<string, SfxRecipe>> = {
  beep: { layers: [{ voice: 'pulseA', freq: 880, durMs: 60, volume: 0.3, duty: 0.5 }] },
  select: {
    layers: [
      { voice: 'pulseA', freq: 660, durMs: 50, volume: 0.3, duty: 0.25 },
      { voice: 'pulseA', freq: 990, delayMs: 50, durMs: 70, volume: 0.3, duty: 0.25 },
    ],
  },
  hit: {
    layers: [
      { voice: 'noise', freq: 3000, durMs: 70, volume: 0.45 },
      { voice: 'pulseB', freq: 220, freqEnd: 110, durMs: 70, volume: 0.25, duty: 0.125 },
    ],
  },
  explode: {
    layers: [
      { voice: 'noise', freq: 1200, freqEnd: 200, durMs: 420, volume: 0.6 },
      { voice: 'triangle', freq: 120, freqEnd: 35, durMs: 380, volume: 0.5 },
    ],
  },
  pickup: {
    layers: [
      { voice: 'pulseA', freq: 523, durMs: 50, volume: 0.3, duty: 0.5 },
      { voice: 'pulseA', freq: 784, delayMs: 50, durMs: 50, volume: 0.3, duty: 0.5 },
      { voice: 'pulseA', freq: 1047, delayMs: 100, durMs: 80, volume: 0.3, duty: 0.5 },
    ],
  },
  fail: {
    layers: [
      { voice: 'pulseB', freq: 330, freqEnd: 300, durMs: 160, volume: 0.35, duty: 0.5 },
      { voice: 'pulseB', freq: 260, freqEnd: 180, delayMs: 170, durMs: 320, volume: 0.35, duty: 0.5 },
    ],
  },
  jump: { layers: [{ voice: 'pulseA', freq: 300, freqEnd: 760, durMs: 140, volume: 0.3, duty: 0.25 }] },
  squeak: {
    layers: [
      { voice: 'triangle', freq: 900, freqEnd: 1600, durMs: 110, volume: 0.35 },
      { voice: 'fm', freq: 1200, freqEnd: 1700, durMs: 90, volume: 0.15, fmRatio: 2, fmDepth: 300 },
    ],
  },
};
