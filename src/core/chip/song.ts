import type { Pattern, Song, SongRole } from '../api';

export const ROLES: readonly SongRole[] = ['drums', 'bass', 'lead', 'pad'];

export const stepsPerBar = (song: Song) => (song.meter ?? 4) * 4;
export const msPer16 = (bpm: number) => 60000 / bpm / 4;
export const songLengthSteps = (song: Song) => song.sections.reduce((n, s) => n + s.bars, 0) * stepsPerBar(song);

/** Section index and step inside it for a song step (already wrapped to one pass). */
export function locate(song: Song, songStep: number): { section: number; local: number } {
  const spb = stepsPerBar(song);
  let start = 0;
  for (let i = 0; i < song.sections.length; i++) {
    const len = song.sections[i]!.bars * spb;
    if (songStep < start + len) return { section: i, local: songStep - start };
    start += len;
  }
  return { section: -1, local: 0 };
}

/** Value of a role's pattern at a song step: 0 rest, -1 hold, else note (or drum code). */
export function noteAt(song: Song, role: SongRole, songStep: number): number {
  const { section, local } = locate(song, songStep);
  if (section < 0) return 0;
  const p = song.sections[section]!.patterns[role];
  if (!p || p.length === 0) return 0;
  return p[local % p.length]!;
}

/** How many 16th steps a note starting at `local` lasts (1 + following holds). */
export function noteLength(p: Pattern, local: number): number {
  let n = 1;
  while (n < p.length && p[(local + n) % p.length] === -1) n++;
  return n;
}

export function lengthAt(song: Song, role: SongRole, songStep: number): number {
  const { section, local } = locate(song, songStep);
  const p = section >= 0 ? song.sections[section]!.patterns[role] : undefined;
  return p && p.length ? noteLength(p, local % p.length) : 1;
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Validate a song; returns plain-English problems. */
export function checkSong(song: Song): string[] {
  const out: string[] = [];
  if (!(song.bpm >= 30 && song.bpm <= 300)) out.push(`song "${song.id}": bpm ${song.bpm} outside 30..300`);
  if (song.sections.length === 0) out.push(`song "${song.id}": no sections`);
  song.sections.forEach((s, i) => {
    if (!(Number.isInteger(s.bars) && s.bars > 0)) out.push(`song "${song.id}" section ${i}: bars must be a whole number above 0`);
    for (const r of Object.keys(s.patterns)) if (!ROLES.includes(r as SongRole)) out.push(`song "${song.id}" section ${i}: unknown role "${r}"`);
  });
  return out;
}
