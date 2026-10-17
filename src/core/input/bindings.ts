import type { Action } from '../api';

/** KeyboardEvent.code → action. Options menu remaps by replacing entries. */
export type KeyMap = Record<string, Action>;

export const DEFAULT_KEYS: Readonly<KeyMap> = Object.freeze({
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'a', KeyK: 'b', KeyL: 'x', Semicolon: 'y',
  KeyQ: 'l', KeyE: 'r',
  Enter: 'start', Space: 'a',
  Escape: 'select',
});

/** Bind `code` to `action`. Replaces the action's other non-arrow keys; arrows stay as a fallback. */
export function remapKey(map: KeyMap, action: Action, code: string): KeyMap {
  const out: KeyMap = {};
  for (const k in map) if (map[k] !== action || k.startsWith('Arrow')) out[k] = map[k]!;
  out[code] = action;
  return out;
}

export function keysFor(map: KeyMap, action: Action): string[] {
  return Object.keys(map).filter((k) => map[k] === action);
}

/** Standard gamepad mapping → action. */
export const PAD_BUTTONS: ReadonlyArray<[number, Action]> = [
  [0, 'a'], [1, 'b'], [2, 'x'], [3, 'y'], [4, 'l'], [5, 'r'],
  [8, 'select'], [9, 'start'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'],
];
export const PAD_DEADZONE = 0.2;

export function deadzone(v: number, dz = PAD_DEADZONE): number {
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * ((a - dz) / (1 - dz));
}
