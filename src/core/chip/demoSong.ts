import type { Pattern, Song } from '../api';

// Launcher theme, 120 bpm, 8 bars. Notes are MIDI (60 = middle C); -1 holds, 0 rests.
const drums: Pattern = [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 1, 3, 2, 0, 3, 3];
const drumsFill: Pattern = [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 1, 3, 2, 0, 3, 3, 1, 0, 3, 0, 2, 0, 3, 0, 1, 1, 2, 0, 2, 5, 2, 4];

const bassBar = (r: number): number[] => [r, 0, r, 0, r + 12, 0, r, 0, r, 0, r, 0, r + 12, 0, r + 7, 0];
const bass: Pattern = [...bassBar(36), ...bassBar(33), ...bassBar(29), ...bassBar(31)];

const lead: Pattern = [
  72, -1, 76, -1, 79, -1, 76, -1, 72, -1, 0, 0, 74, 76, 77, 79,
  81, -1, 79, -1, 76, -1, 72, -1, 76, -1, -1, -1, 0, 0, 0, 0,
  77, -1, 76, -1, 74, -1, 72, -1, 69, -1, 72, -1, 74, -1, 76, -1,
  79, -1, -1, -1, 77, -1, 76, -1, 74, -1, -1, -1, 0, 0, 0, 0,
];
const lead2: Pattern = [
  84, 0, 79, 0, 76, 0, 79, 0, 84, 0, 79, 0, 76, 79, 84, 86,
  88, -1, 86, -1, 84, -1, 81, -1, 84, -1, -1, -1, 0, 0, 79, 81,
  84, 0, 81, 0, 77, 0, 81, 0, 84, 0, 81, 0, 77, 81, 84, 86,
  83, -1, -1, -1, 86, -1, -1, -1, 91, -1, -1, -1, 0, 0, 0, 0,
];
const hold = (n: number): number[] => [n, ...Array<number>(15).fill(-1)];
const pad: Pattern = [...hold(64), ...hold(64), ...hold(65), ...hold(67)];

export const DEMO_SONG: Song = {
  id: 'launcher_theme',
  bpm: 120,
  meter: 4,
  loop: true,
  sections: [
    { bars: 4, patterns: { drums, bass, lead } },
    { bars: 4, patterns: { drums: drumsFill, bass, lead: lead2, pad } },
  ],
};
