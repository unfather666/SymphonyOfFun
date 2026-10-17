import type { KeyMap } from '../input/bindings';
import { DEFAULT_KEYS } from '../input/bindings';

export interface Options {
  volume: number; // 0..10
  scale: number; // 0 = auto, else 1..6
  reducedFx: boolean | null; // null = platform default
  keys: KeyMap;
}

export const OPTIONS_KEY = 'sof:options';

export function defaultOptions(): Options {
  return { volume: 8, scale: 0, reducedFx: null, keys: { ...DEFAULT_KEYS } };
}

/** Parse stored options; anything malformed falls back to the default for that field. */
export function parseOptions(raw: string | null): Options {
  const d = defaultOptions();
  if (!raw) return d;
  try {
    const o = JSON.parse(raw) as Partial<Options>;
    return {
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 10 ? Math.round(o.volume) : d.volume,
      scale: typeof o.scale === 'number' && o.scale >= 0 && o.scale <= 6 ? Math.round(o.scale) : d.scale,
      reducedFx: typeof o.reducedFx === 'boolean' ? o.reducedFx : null,
      keys: o.keys && typeof o.keys === 'object' && Object.keys(o.keys).length > 0 ? (o.keys as KeyMap) : d.keys,
    };
  } catch {
    return d;
  }
}
