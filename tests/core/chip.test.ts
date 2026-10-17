import { describe, expect, test } from 'vitest';
import type { EventPayload, Song } from '../../src/core/api';
import { DEMO_SONG } from '../../src/core/chip/demoSong';
import { CORE_SFX } from '../../src/core/chip/recipes';
import { createSequencer, type NoteSink } from '../../src/core/chip/sequencer';
import { SFX_CAP, admitSfx, type ActiveSfx } from '../../src/core/chip/sfxPool';
import { checkSong, lengthAt, locate, msPer16, noteAt, songLengthSteps } from '../../src/core/chip/song';
import { createChip } from '../../src/core/chip/chip';
import { nullSynth } from '../../src/core/chip/synth';
import { createEventBus } from '../../src/core/events/bus';
import { createClock } from '../../src/core/loop/clock';

const song: Song = {
  id: 't',
  bpm: 150, // 100 ms per 16th, 6 steps per 16th at 60 Hz
  sections: [
    { bars: 1, patterns: { lead: [60, -1, 0, 62] } },
    { bars: 2, patterns: { bass: [40] } },
  ],
};

describe('song timing', () => {
  test('lengths and lookup', () => {
    expect(msPer16(150)).toBe(100);
    expect(songLengthSteps(song)).toBe(48);
    expect(locate(song, 17)).toEqual({ section: 1, local: 1 });
    expect(noteAt(song, 'lead', 4)).toBe(60); // pattern loops inside the section
    expect(noteAt(song, 'lead', 3)).toBe(62);
    expect(noteAt(song, 'lead', 16)).toBe(0);
    expect(noteAt(song, 'bass', 30)).toBe(40);
    expect(lengthAt(song, 'lead', 0)).toBe(2);
  });
  test('demo song is valid and 8 bars', () => {
    expect(checkSong(DEMO_SONG)).toEqual([]);
    expect(songLengthSteps(DEMO_SONG)).toBe(128);
  });
  test('bad songs are reported', () => {
    expect(checkSong({ id: 'b', bpm: 10, sections: [] })).toEqual(['song "b": bpm 10 outside 30..300', 'song "b": no sections']);
  });
});

function rig(sinkNow = -1) {
  const clock = createClock();
  const bus = createEventBus();
  const beats: EventPayload[] = [];
  bus.on('chip:beat', (p) => beats.push(p));
  const notes: Array<[string, number, number, number, number]> = [];
  let t = sinkNow;
  const sink: NoteSink = { now: () => t, note: (r, v, at, dur, pitch = 1) => notes.push([r, v, at, dur, pitch]), cancel: () => {} };
  const seq = createSequencer(clock, bus, sink);
  const run = (steps: number) => {
    for (let i = 0; i < steps; i++) {
      clock.advance();
      if (t >= 0) t += 1 / 60;
      seq.tick();
      bus.flush();
    }
  };
  return { clock, seq, beats, notes, run };
}

describe('sequencer (game clock is master)', () => {
  test('publishes one chip:beat per 16th on the game clock', () => {
    const { seq, beats, run } = rig();
    seq.load(song);
    seq.play();
    run(1);
    expect(beats).toEqual([{ bar: 0, beat: 0, step16: 0, step: 0 }]);
    run(60); // 1 s more = 10 steps of 100 ms
    expect(beats.length).toBe(11);
    expect(beats[10]).toEqual({ bar: 0, beat: 2, step16: 10, step: 10 });
  });
  test('loops and wraps bars', () => {
    const { seq, beats, run } = rig();
    seq.load(song);
    seq.play();
    run(6 * 49);
    expect(beats[48]).toEqual({ bar: 0, beat: 0, step16: 0, step: 48 });
  });
  test('non-looping song stops at its end', () => {
    const { seq, beats, run } = rig();
    seq.load({ ...song, loop: false });
    seq.play();
    run(6 * 60);
    expect(beats.length).toBe(48);
    expect(seq.playing()).toBe(false);
  });
  test('seekBar jumps the beat position', () => {
    const { seq, beats, run } = rig();
    seq.load(song);
    seq.play();
    run(30);
    seq.seekBar(2);
    run(1);
    expect(beats[beats.length - 1]).toMatchObject({ bar: 2, step16: 0 });
  });
  test('schedules audio ahead with the audio clock', () => {
    const { seq, notes, run } = rig(10);
    seq.load(song);
    seq.play();
    run(1);
    expect(notes[0]?.[0]).toBe('lead');
    expect(notes[0]?.[1]).toBe(60);
    expect(notes.every(([, , at]) => at >= 10)).toBe(true);
  });
});

describe('sequencer rate', () => {
  test('half rate halves the beat speed on the game clock', () => {
    const { seq, beats, run } = rig();
    seq.load(song);
    seq.play();
    run(60); // 1 s at rate 1: steps 0..10 (100 ms each)
    expect(beats.length).toBe(11);
    seq.setRate(0.5);
    run(60); // 1 s at half rate = 500 song ms = 5 more steps
    expect(beats.length).toBe(16);
    expect(beats[15]).toMatchObject({ step: 15 });
    expect(seq.rate()).toBe(0.5);
  });
  test('position is continuous across a rate change', () => {
    const { seq, beats, run } = rig();
    seq.load(song);
    seq.play();
    run(30);
    seq.setRate(2);
    run(1);
    const steps = beats.map((b) => b.step);
    expect(steps).toEqual(steps.map((_, i) => i));
  });
  test('clamps, ignores NaN, resets on load', () => {
    const warns: string[] = [];
    const clock = createClock();
    const seq = createSequencer(clock, createEventBus(), { now: () => -1, note: () => {}, cancel: () => {} }, (k) => warns.push(k));
    seq.load(song);
    seq.setRate(10);
    expect(seq.rate()).toBe(4);
    seq.setRate(0.01);
    expect(seq.rate()).toBe(0.25);
    seq.setRate(Number.NaN);
    expect(seq.rate()).toBe(0.25);
    expect(warns).toEqual(['seq-rate']);
    seq.load(song);
    expect(seq.rate()).toBe(1);
  });
  test('audio follows the rate: later times, longer notes, pitch like a tape', () => {
    const { seq, notes, run } = rig(10);
    seq.load(song);
    seq.setRate(0.5);
    seq.play();
    run(1);
    const [, , at0, dur0, pitch0] = notes[0]!;
    expect(dur0).toBeCloseTo((2 * 100 * 0.9) / 0.5 / 1000, 9);
    expect(pitch0).toBe(0.5);
    run(30);
    const lead62 = notes.find(([r, v]) => r === 'lead' && v === 62)!;
    expect(lead62[2] - at0).toBeCloseTo(0.6, 6); // step 3 at 100 ms per step, half rate
  });
  test('pitch: false keeps pitch', () => {
    const { seq, notes, run } = rig(10);
    seq.load(song);
    seq.play();
    seq.setRate(0.5, { pitch: false });
    run(1);
    expect(notes.every(([, , , , p]) => p === 1)).toBe(true);
  });
});

describe('sfx', () => {
  test('8 core recipes', () => {
    expect(Object.keys(CORE_SFX).sort()).toEqual(['beep', 'explode', 'fail', 'hit', 'jump', 'pickup', 'select', 'squeak']);
  });
  test('full policy drops the quietest', () => {
    const stopped: number[] = [];
    const active: ActiveSfx[] = [];
    for (let i = 0; i < SFX_CAP; i++) active.push({ endSec: 10, volume: 0.5 + i * 0.01, stop: () => stopped.push(i) });
    expect(admitSfx(active, 0.1, 0)).toBe(false);
    expect(admitSfx(active, 0.9, 0)).toBe(true);
    expect(stopped).toEqual([0]);
    expect(active.length).toBe(SFX_CAP - 1);
  });
  test('finished sfx free their slot', () => {
    const active: ActiveSfx[] = Array.from({ length: SFX_CAP }, () => ({ endSec: 1, volume: 1, stop: () => {} }));
    expect(admitSfx(active, 0.1, 2)).toBe(true);
    expect(active.length).toBe(0);
  });
  test('games can define recipes; unknown ids warn', () => {
    const warns: string[] = [];
    const chip = createChip(createClock(), createEventBus(), nullSynth(), (k) => warns.push(k));
    chip.defineSfx('fart_squeaky', { layers: [{ voice: 'triangle', freq: 300, durMs: 100, volume: 0.5 }] });
    expect(chip.hasSfx('fart_squeaky')).toBe(true);
    chip.defineSfx('Bad Id', { layers: [] });
    chip.sfx('nope');
    expect(warns).toEqual(['sfx-id:Bad Id', 'sfx:nope']);
  });
});
