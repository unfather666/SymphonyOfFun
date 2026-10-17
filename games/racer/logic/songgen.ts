// Music assembler: stitches a level's song from small patterns by tempo, meter, mode and intensity. Pure and deterministic
// from (levelNo, runSeed). Output has the shape of the core Song so index.ts can hand it straight to the sequencer.
import { intensityAt } from './level';
import { newRand, randFloat, randInt, seedRand } from './rng';

export type Role = 'drums' | 'bass' | 'lead' | 'pad';
export const ROLES: readonly Role[] = ['drums', 'bass', 'lead', 'pad'];
export type Mode = 'major' | 'minor' | 'any';

export interface PatternDef {
  id: string;
  role: Role;
  genre: string;
  /** Harmony family: major and minor patterns share one chord progression each, so any two of a mode agree. 'any' is drums. */
  mode: Mode;
  bpmMin: number;
  bpmMax: number;
  /** Beats per bar this pattern is written in (default 4). */
  meter?: number;
  /** One entry per 16th step: 0 rest, -1 hold, else a MIDI note (drum code for drums). Written in C. */
  steps: number[];
}

export interface SectionOut {
  bars: number;
  patterns: Partial<Record<Role, readonly number[]>>;
}

export interface SongOut {
  id: string;
  bpm: number;
  meter: number;
  loop: false;
  sections: SectionOut[];
  /** Which pattern ids each section used, per role, and the transposition: for tests and the debug readout. */
  picks: Array<{ mode: Mode; key: number; ids: Partial<Record<Role, string>> }>;
}

/** Section keys, as semitones from C. Folded to -5..6 so the bass stays low and the lead stays bright. */
export const KEYS: readonly number[] = [0, 5, 7, 3, 10, 8, 2];
const fold = (k: number): number => (k > 6 ? k - 12 : k);

export function eligible(p: PatternDef, role: Role, bpm: number, meter: number, mode: Mode): boolean {
  return p.role === role && bpm >= p.bpmMin && bpm <= p.bpmMax && (p.meter ?? 4) === meter && (p.mode === 'any' || mode === 'any' || p.mode === mode);
}

/** Which roles play in a section. Early sections are drums and bass; the middle break drops the drums. */
export function rolesFor(intensity: number, brk: boolean): readonly Role[] {
  if (brk) return ['bass', 'pad', 'lead'];
  if (intensity < 0.5) return ['drums', 'bass'];
  if (intensity < 0.8) return ['drums', 'bass', 'pad'];
  return ROLES;
}

/** The break section of the intensity curve (see intensityAt): 55%..65% through the song. */
export function isBreak(section: number, sections: number): boolean {
  if (sections <= 1) return false;
  const f = section / (sections - 1);
  return f >= 0.55 && f < 0.65;
}

/** 3/4 only when asked for by chance and when the library has waltz patterns for every role. */
export function chooseMeter(chance: number, runSeed: number, levelNo: number, patterns: readonly PatternDef[]): number {
  if (chance <= 0) return 4;
  const has3 = ROLES.every((r) => patterns.some((p) => p.role === r && p.meter === 3));
  return has3 && randFloat(seedRand(newRand(), runSeed, levelNo, 0x33)) < chance ? 3 : 4;
}

export interface AssembleOpts {
  levelNo: number;
  runSeed: number;
  bpm: number;
  meter: number;
  lengthBars: number;
  sectionBars: number;
  patterns: readonly PatternDef[];
}

function transpose(role: Role, steps: readonly number[], delta: number): readonly number[] {
  if (role === 'drums' || delta === 0) return steps;
  const out = new Array<number>(steps.length);
  for (let i = 0; i < steps.length; i++) out[i] = steps[i]! > 0 ? steps[i]! + delta : steps[i]!;
  return out;
}

export function assemble(o: AssembleOpts): SongOut {
  const r = seedRand(newRand(), o.runSeed, o.levelNo, 0x50);
  const nSections = Math.max(1, Math.ceil(o.lengthBars / o.sectionBars));
  const sections: SectionOut[] = [];
  const picks: SongOut['picks'] = [];
  let key = KEYS[randInt(r, 0, KEYS.length - 1)]!;
  const lastId: Partial<Record<Role, string>> = {};
  for (let s = 0; s < nSections; s++) {
    if (s > 0 && s % 2 === 0) key = KEYS[randInt(r, 0, KEYS.length - 1)]!;
    const brk = isBreak(s, nSections);
    const roles = rolesFor(intensityAt(s, nSections), brk);
    // Prefer a mode in which every melodic role has a pattern; fall back to whichever has more.
    const first: Mode = randFloat(r) < 0.5 ? 'major' : 'minor';
    const second: Mode = first === 'major' ? 'minor' : 'major';
    const coverage = (m: Mode) => roles.filter((role) => o.patterns.some((p) => eligible(p, role, o.bpm, o.meter, m))).length;
    const mode = coverage(first) >= coverage(second) ? first : second;
    const out: SectionOut = { bars: s === nSections - 1 ? o.lengthBars - o.sectionBars * (nSections - 1) : o.sectionBars, patterns: {} };
    const ids: Partial<Record<Role, string>> = {};
    for (const role of roles) {
      const cands = o.patterns.filter((p) => eligible(p, role, o.bpm, o.meter, mode));
      if (cands.length === 0) continue;
      let pick = cands[randInt(r, 0, cands.length - 1)]!;
      if (cands.length > 1 && pick.id === lastId[role]) pick = cands[(cands.indexOf(pick) + 1) % cands.length]!;
      out.patterns[role] = transpose(role, pick.steps, fold(key));
      ids[role] = pick.id;
      lastId[role] = pick.id;
    }
    sections.push(out);
    picks.push({ mode, key: fold(key), ids });
  }
  return { id: `tempo_l${o.levelNo}_${o.runSeed >>> 0}`, bpm: o.bpm, meter: o.meter, loop: false, sections, picks };
}

/** Song length in ms (one pass). */
export function songMs(song: SongOut): number {
  let bars = 0;
  for (const s of song.sections) bars += s.bars;
  return (bars * song.meter * 60000) / song.bpm;
}
