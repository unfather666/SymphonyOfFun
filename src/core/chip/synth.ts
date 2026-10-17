import type { SfxLayer, SfxOptions, SfxRecipe, SongRole, VoiceKind } from '../api';
import { createStream } from '../random/mulberry32';
import { admitSfx, type ActiveSfx } from './sfxPool';
import { midiToHz } from './song';
import type { NoteSink } from './sequencer';

/**
 * WebAudio chip voices. Song roles: drums → noise/triangle, bass → triangle, lead → pulse A,
 * pad → pulse B. Sfx use any voice incl. the FM voice. Notes are short-lived nodes on the audio thread.
 */
export interface Synth extends NoteSink {
  playSfx(recipe: SfxRecipe, opts: SfxOptions | undefined): void;
  setVolume(v: number): void;
  /** Call from a user gesture; resumes the AudioContext. */
  unlock(): void;
  suspend(on: boolean): void;
  readonly available: boolean;
}

const ROLE_GAIN: Record<SongRole, number> = { drums: 0.5, bass: 0.45, lead: 0.22, pad: 0.1 };

export function createSynth(): Synth {
  const AC: typeof AudioContext | undefined =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return nullSynth();
  const ac = new AC();
  const master = ac.createGain();
  master.gain.value = 0.6;
  master.connect(ac.destination);
  const music = ac.createGain();
  music.connect(master);
  const sfxBus = ac.createGain();
  sfxBus.connect(master);

  const waves = new Map<number, PeriodicWave>();
  function pulse(duty: number): PeriodicWave {
    let w = waves.get(duty);
    if (w) return w;
    const n = 32;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    w = ac.createPeriodicWave(re, im);
    waves.set(duty, w);
    return w;
  }
  const rng = createStream('chip-noise', 0x5eed);
  const noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rng.float() * 2 - 1;

  let pending: AudioScheduledSourceNode[] = [];
  const active: ActiveSfx[] = [];

  function envGain(dest: AudioNode, at: number, dur: number, vol: number): GainNode {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.004);
    g.gain.setValueAtTime(vol, at + Math.max(0.005, dur - 0.02));
    g.gain.linearRampToValueAtTime(0, at + dur);
    g.connect(dest);
    return g;
  }

  function voice(kind: VoiceKind, dest: AudioNode, at: number, dur: number, vol: number, f0: number, f1: number, layer?: Partial<SfxLayer>): AudioScheduledSourceNode[] {
    const g = envGain(dest, at, dur, vol);
    const srcs: AudioScheduledSourceNode[] = [];
    if (kind === 'noise') {
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const filt = ac.createBiquadFilter();
      filt.type = f0 >= 2000 ? 'highpass' : 'lowpass';
      filt.frequency.setValueAtTime(f0, at);
      filt.frequency.linearRampToValueAtTime(f1, at + dur);
      src.connect(filt);
      filt.connect(g);
      srcs.push(src);
    } else {
      const osc = ac.createOscillator();
      if (kind === 'triangle') osc.type = 'triangle';
      else if (kind === 'fm') osc.type = 'sine';
      else osc.setPeriodicWave(pulse(layer?.duty ?? (kind === 'pulseA' ? 0.5 : 0.25)));
      osc.frequency.setValueAtTime(f0, at);
      if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, at + dur);
      if (kind === 'fm') {
        const mod = ac.createOscillator();
        const mg = ac.createGain();
        mod.frequency.setValueAtTime(f0 * (layer?.fmRatio ?? 2), at);
        mg.gain.value = layer?.fmDepth ?? 200;
        mod.connect(mg);
        mg.connect(osc.frequency);
        srcs.push(mod);
      }
      osc.connect(g);
      srcs.push(osc);
    }
    for (const s of srcs) {
      s.start(at);
      s.stop(at + dur + 0.01);
    }
    return srcs;
  }

  function drum(code: number, at: number, vol: number): AudioScheduledSourceNode[] {
    switch (code) {
      case 1: return voice('triangle', music, at, 0.12, vol, 160, 40);
      case 2: return [...voice('noise', music, at, 0.16, vol * 0.7, 1800, 900), ...voice('triangle', music, at, 0.06, vol * 0.5, 220, 140)];
      case 3: return voice('noise', music, at, 0.035, vol * 0.4, 8000, 8000);
      case 4: return voice('noise', music, at, 0.14, vol * 0.35, 7000, 6000);
      case 5: return voice('triangle', music, at, 0.15, vol, 220, 90);
      default: return [];
    }
  }

  return {
    available: true,
    now: () => ac.currentTime,
    note(role, value, at, dur) {
      const vol = ROLE_GAIN[role];
      const srcs =
        role === 'drums'
          ? drum(value, at, vol)
          : voice(role === 'bass' ? 'triangle' : role === 'lead' ? 'pulseA' : 'pulseB', music, at, dur, vol, midiToHz(value), midiToHz(value));
      for (const s of srcs) pending.push(s);
      if (pending.length > 256) pending = pending.slice(-128);
    },
    cancel() {
      const t = ac.currentTime;
      for (const s of pending) {
        try {
          s.stop(t);
        } catch {
          /* already stopped */
        }
      }
      pending = [];
    },
    playSfx(recipe, opts) {
      const semis = (opts?.pitch ?? 0) + (opts?.key ?? 0);
      const mul = Math.pow(2, semis / 12);
      const vol = Math.max(0, Math.min(1, opts?.volume ?? 1));
      const at = ac.currentTime + 0.005;
      let end = 0;
      let loud = 0;
      for (const l of recipe.layers) {
        end = Math.max(end, ((l.delayMs ?? 0) + l.durMs) / 1000);
        loud = Math.max(loud, l.volume * vol);
      }
      if (!admitSfx(active, loud, ac.currentTime)) return;
      const srcs: AudioScheduledSourceNode[] = [];
      for (const l of recipe.layers) {
        const t = at + (l.delayMs ?? 0) / 1000;
        const f0 = l.freq * (l.voice === 'noise' ? 1 : mul);
        const f1 = (l.freqEnd ?? l.freq) * (l.voice === 'noise' ? 1 : mul);
        srcs.push(...voice(l.voice, sfxBus, t, l.durMs / 1000, l.volume * vol, f0, f1, l));
      }
      active.push({
        endSec: at + end,
        volume: loud,
        stop: () => {
          for (const s of srcs) {
            try {
              s.stop();
            } catch {
              /* done */
            }
          }
        },
      });
    },
    setVolume(v) {
      master.gain.setValueAtTime(Math.max(0, Math.min(1, v)) * 0.8, ac.currentTime);
    },
    unlock() {
      if (ac.state !== 'running') void ac.resume();
    },
    suspend(on) {
      if (on) void ac.suspend();
      else void ac.resume();
    },
  };
}

export function nullSynth(): Synth {
  return {
    available: false,
    now: () => -1,
    note() {},
    cancel() {},
    playSfx() {},
    setVolume() {},
    unlock() {},
    suspend() {},
  };
}
