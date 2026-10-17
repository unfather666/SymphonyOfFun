import type { Clock, EventBus, Sequencer, Song, SongRole } from '../api';
import { checkSong, lengthAt, msPer16, noteAt, ROLES, songLengthSteps, stepsPerBar } from './song';

/** Where notes go. The WebAudio synth implements it; tests and Node use a recorder or nothing. */
export interface NoteSink {
  /** Audio-clock seconds now, or -1 when there is no audio. */
  now(): number;
  note(role: SongRole, value: number, atSec: number, durSec: number): void;
  /** Cancel notes scheduled after now (seek/stop). */
  cancel(): void;
}

export const LOOKAHEAD_MS = 120;
const RESYNC_SEC = 0.05;
/** Audio trails the game clock by this much so the first notes after play/seek are not already late. */
const LATENCY_SEC = 0.04;

export interface CoreSequencer extends Sequencer {
  /** Called by core once per step, before game.update: publishes chip:beat for steps reached. */
  tick(): void;
}

/**
 * The game clock is master. Beats are published from game time; audio is scheduled up to
 * LOOKAHEAD_MS ahead and re-anchored to the game clock if it drifts (pause, tab hidden, seek).
 */
export function createSequencer(clock: Clock, events: EventBus, sink: NoteSink, warn: (k: string, m: string) => void = () => {}): CoreSequencer {
  let song: Song | null = null;
  let playing = false;
  let startMs = 0; // game ms of absolute step 0
  let last = -1; // last published absolute step
  let scheduled = -1; // last scheduled absolute step
  let anchorSec = 0;
  let anchorMs = 0;
  let len = 0;
  let spb = 16;
  let m16 = 125;
  const pos = { bar: 0, beat: 0, step16: 0, step: 0 };

  function wrap(abs: number): number {
    if (!song) return -1;
    if (song.loop === false) return abs < len ? abs : -1;
    return abs % len;
  }

  function anchor() {
    anchorSec = sink.now() + LATENCY_SEC;
    anchorMs = clock.nowMs() - startMs;
    sink.cancel();
    scheduled = Math.max(last, Math.floor(anchorMs / m16) - 1);
  }

  function schedule(songMs: number) {
    if (!song) return;
    const now = sink.now();
    if (now < 0) return;
    const expected = anchorSec + (songMs - anchorMs) / 1000;
    if (Math.abs(expected - (now + LATENCY_SEC)) > RESYNC_SEC) anchor();
    const upTo = Math.floor((songMs + LOOKAHEAD_MS) / m16);
    for (let s = scheduled + 1; s <= upTo; s++) {
      const w = wrap(s);
      if (w < 0) break;
      const at = anchorSec + (s * m16 - anchorMs) / 1000;
      if (at < now - 0.005) continue;
      for (let r = 0; r < ROLES.length; r++) {
        const role = ROLES[r]!;
        const v = noteAt(song, role, w);
        if (v > 0) sink.note(role, v, at, (lengthAt(song, role, w) * m16 * 0.9) / 1000);
      }
      scheduled = s;
    }
  }

  const seq: CoreSequencer = {
    load(s) {
      const problems = checkSong(s);
      if (problems.length) {
        warn(`song:${s.id}`, problems.join('; '));
        return;
      }
      seq.stop();
      song = s;
      len = songLengthSteps(s);
      spb = stepsPerBar(s);
      m16 = msPer16(s.bpm);
    },
    play(fromBar = 0) {
      if (!song) return;
      playing = true;
      startMs = clock.nowMs() - fromBar * spb * m16;
      last = fromBar * spb - 1;
      anchor();
    },
    stop() {
      playing = false;
      sink.cancel();
    },
    seekBar(bar) {
      if (!song || !playing) return;
      seq.play(bar);
    },
    playing: () => playing,
    bpm: () => (song ? song.bpm : 0),
    position: () => pos,
    lengthBars: () => (song ? len / spb : 0),
    tick() {
      if (!playing || !song) return;
      const songMs = clock.nowMs() - startMs;
      const target = Math.floor(songMs / m16);
      for (let s = last + 1; s <= target; s++) {
        const w = wrap(s);
        if (w < 0) {
          playing = false;
          break;
        }
        pos.bar = Math.floor(w / spb);
        pos.step16 = w % spb;
        pos.beat = pos.step16 >> 2;
        pos.step = s;
        // Fresh object: the bus queues payloads by reference.
        events.emit('chip:beat', { bar: pos.bar, beat: pos.beat, step16: pos.step16, step: s });
        last = s;
      }
      if (playing) schedule(songMs);
    },
  };
  return seq;
}
