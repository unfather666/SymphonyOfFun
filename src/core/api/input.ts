// Input actions and state.

// ---- input ----------------------------------------------------------------

export const ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'] as const;
export type Action = (typeof ACTIONS)[number];
export type AxisName = 'move' | 'aim';
export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PointerState {
  /** Position in 384x216 screen space. */
  x: number;
  y: number;
  down: boolean;
  /** true for the one step the pointer went down. */
  pressed: boolean;
}

export interface Input {
  held(a: Action): boolean;
  /** true for exactly one update step per press, even if press and release fell between steps. */
  pressed(a: Action): boolean;
  released(a: Action): boolean;
  /** Each component in [-1,1]; length <= 1. 'move' falls back to the d-pad actions. */
  axis(name: AxisName): Readonly<Vec2>;
  pointer(): Readonly<PointerState>;
  device(): InputDevice;
}
