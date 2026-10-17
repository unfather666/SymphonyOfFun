import { ACTIONS, type Action, type AxisName, type Input, type InputDevice, type PointerState, type Vec2 } from '../api';

const N = ACTIONS.length;
export const ACTION_INDEX: Readonly<Record<Action, number>> = Object.fromEntries(ACTIONS.map((a, i) => [a, i])) as Record<Action, number>;

/**
 * Per-step input state. Raw sources (keyboard, gamepad, touch) write into `raw*`; latch() runs
 * once before every update step and turns raw state into held/pressed/released for that step.
 * A press that started and ended between two steps still reads as pressed for one step.
 */
export interface InputState extends Input {
  /** source: 0 keyboard, 1 gamepad, 2 touch. Held if any source holds it. */
  setRaw(source: number, a: Action, down: boolean): void;
  setAxis(source: number, name: AxisName, x: number, y: number): void;
  setPointer(x: number, y: number, down: boolean): void;
  setDevice(d: InputDevice): void;
  latch(): void;
  /** Forget everything (focus lost, game switch). */
  releaseAll(): void;
}

const SOURCES = 3;

function clampLen(v: Vec2) {
  const l = Math.hypot(v.x, v.y);
  if (l > 1) {
    v.x /= l;
    v.y /= l;
  }
}

export function createInputState(): InputState {
  const raw = new Uint8Array(N * SOURCES);
  const tapped = new Uint8Array(N); // went down since last latch
  const held = new Uint8Array(N);
  const prev = new Uint8Array(N);
  const pressedNow = new Uint8Array(N);
  const releasedNow = new Uint8Array(N);
  const rawAxis = new Float32Array(SOURCES * 4); // move x,y, aim x,y per source
  const move: Vec2 = { x: 0, y: 0 };
  const aim: Vec2 = { x: 0, y: 0 };
  const ptr: PointerState = { x: 0, y: 0, down: false, pressed: false };
  let ptrRawDown = false;
  let ptrTapped = false;
  let device: InputDevice = 'keyboard';

  const anyRaw = (i: number) => raw[i]! | raw[N + i]! | raw[2 * N + i]!;

  return {
    setRaw(source, a, down) {
      const i = ACTION_INDEX[a];
      const wasAny = anyRaw(i);
      raw[source * N + i] = down ? 1 : 0;
      if (down && !wasAny) tapped[i] = 1;
    },
    setAxis(source, name, x, y) {
      const o = source * 4 + (name === 'move' ? 0 : 2);
      rawAxis[o] = x;
      rawAxis[o + 1] = y;
    },
    setPointer(x, y, down) {
      ptr.x = x;
      ptr.y = y;
      if (down && !ptrRawDown) ptrTapped = true;
      ptrRawDown = down;
    },
    setDevice(d) {
      device = d;
    },
    latch() {
      for (let i = 0; i < N; i++) {
        const now = anyRaw(i) || tapped[i] ? 1 : 0;
        pressedNow[i] = now && !prev[i] ? 1 : 0;
        releasedNow[i] = !now && prev[i] ? 1 : 0;
        held[i] = now;
        prev[i] = now;
        tapped[i] = 0;
      }
      for (let k = 0; k < 2; k++) {
        const v = k === 0 ? move : aim;
        let x = 0;
        let y = 0;
        for (let s = 0; s < SOURCES; s++) {
          x += rawAxis[s * 4 + k * 2]!;
          y += rawAxis[s * 4 + k * 2 + 1]!;
        }
        if (k === 0) {
          x += (held[ACTION_INDEX.right]! - held[ACTION_INDEX.left]!);
          y += (held[ACTION_INDEX.down]! - held[ACTION_INDEX.up]!);
        }
        v.x = Math.max(-1, Math.min(1, x));
        v.y = Math.max(-1, Math.min(1, y));
        clampLen(v);
      }
      ptr.pressed = ptrTapped;
      ptr.down = ptrRawDown || ptrTapped;
      ptrTapped = false;
    },
    releaseAll() {
      raw.fill(0);
      tapped.fill(0);
      rawAxis.fill(0);
      ptrRawDown = false;
      ptrTapped = false;
    },
    held: (a) => held[ACTION_INDEX[a]] === 1,
    pressed: (a) => pressedNow[ACTION_INDEX[a]] === 1,
    released: (a) => releasedNow[ACTION_INDEX[a]] === 1,
    axis: (name) => (name === 'move' ? move : aim),
    pointer: () => ptr,
    device: () => device,
  };
}
