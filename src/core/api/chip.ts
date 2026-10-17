// Chip audio: sfx recipes, songs, sequencer.

// ---- chip audio -----------------------------------------------------------

export type VoiceKind = 'pulseA' | 'pulseB' | 'triangle' | 'noise' | 'fm';
export type SongRole = 'drums' | 'bass' | 'lead' | 'pad';

/**
 * One 16th step per entry. 0 = rest, -1 = hold previous note, else a MIDI note.
 * Drums: 1 kick, 2 snare, 3 closed hat, 4 open hat, 5 tom.
 */
export type Pattern = readonly number[];

export interface SongSection {
  /** Bars in this section; patterns loop to fill it. */
  bars: number;
  patterns: Partial<Record<SongRole, Pattern>>;
}

export interface Song {
  id: string;
  bpm: number;
  /** Beats per bar, default 4 (16th steps per bar = meter * 4). */
  meter?: number;
  sections: readonly SongSection[];
  /** Loop back to section 0 at the end (default true). */
  loop?: boolean;
}

export interface SfxLayer {
  voice: VoiceKind;
  /** Hz at start and end (linear glide). Ignored for noise except as filter cutoff. */
  freq: number;
  freqEnd?: number;
  /** Delay before this layer starts. */
  delayMs?: number;
  durMs: number;
  /** 0..1 */
  volume: number;
  /** Pulse duty 0.125 | 0.25 | 0.5 (pulse voices). */
  duty?: number;
  /** FM modulator ratio and depth (fm voice). */
  fmRatio?: number;
  fmDepth?: number;
}

export interface SfxRecipe {
  layers: readonly SfxLayer[];
}

export interface SfxOptions {
  /** Semitone offset. */
  pitch?: number;
  /** Transpose to this key root (semitones from C) - added to pitch. */
  key?: number;
  /** 0..1 multiplier. */
  volume?: number;
}

export interface Sequencer {
  load(song: Song): void;
  /** Start from a bar (default 0). Beats publish on the game clock from now. */
  play(fromBar?: number): void;
  stop(): void;
  /** Jump to a bar while playing (racer respawn). */
  seekBar(bar: number): void;
  playing(): boolean;
  bpm(): number;
  /** Song position of the last published step. */
  position(): Readonly<{ bar: number; beat: number; step16: number; step: number }>;
  /** Total bars in the loaded song (one pass). */
  lengthBars(): number;
}

export interface Chip {
  /** Play a recipe. Full policy (8 one-shots in flight): drop the quietest. */
  sfx(recipeId: string, opts?: SfxOptions): void;
  /** Register or replace a recipe (games add their own, e.g. 'fart_squeaky'). */
  defineSfx(id: string, recipe: SfxRecipe): void;
  hasSfx(id: string): boolean;
  readonly sequencer: Sequencer;
  /** The launcher's demo song, usable as a placeholder. */
  readonly demoSong: Song;
  /** Master volume 0..1 (options menu). */
  volume(): number;
}
