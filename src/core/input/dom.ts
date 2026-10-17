import type { Action, InputDevice } from '../api';
import { DEFAULT_KEYS, PAD_BUTTONS, deadzone, type KeyMap } from './bindings';
import type { InputState } from './state';
import { BUTTONS, PAUSE_BUTTON, STICK_RADIUS, hitButton, stickVector } from './touchLayout';

const KEY = 0, PAD = 1, TOUCH = 2;

interface Stick { id: number; ax: number; ay: number; x: number; y: number }

export interface DomInput {
  setKeyMap(map: KeyMap): void;
  keyMap(): KeyMap;
  /** Next keydown goes to cb instead of the game (key remap). Esc cancels (cb gets null). */
  captureNextKey(cb: (code: string | null) => void): void;
  pollGamepads(): void;
  setAimStick(on: boolean): void;
  drawTouch(ctx: CanvasRenderingContext2D): void;
  onFirstGesture(cb: () => void): void;
  onKey(cb: (code: string) => void): void;
}

export function attachDomInput(
  state: InputState,
  target: HTMLElement,
  toScreen: (cx: number, cy: number) => { x: number; y: number },
  onDevice: (d: InputDevice) => void,
): DomInput {
  let map: KeyMap = { ...DEFAULT_KEYS };
  let capture: ((code: string | null) => void) | null = null;
  let aimStick = false;
  let device: InputDevice = 'keyboard';
  const gesture: Array<() => void> = [];
  const keyHooks: Array<(code: string) => void> = [];
  let move: Stick | null = null;
  let aim: Stick | null = null;
  const buttonTouches = new Map<number, Action>();

  const setDevice = (d: InputDevice) => {
    if (d === device) return;
    device = d;
    state.setDevice(d);
    onDevice(d);
  };
  const fireGesture = () => {
    for (const g of gesture.splice(0)) g();
  };

  window.addEventListener('keydown', (e) => {
    fireGesture();
    if (capture) {
      const cb = capture;
      capture = null;
      cb(e.code === 'Escape' ? null : e.code);
      e.preventDefault();
      return;
    }
    for (const h of keyHooks) h(e.code);
    const a = map[e.code];
    if (a) {
      setDevice('keyboard');
      state.setRaw(KEY, a, true);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const a = map[e.code];
    if (a) state.setRaw(KEY, a, false);
  });
  window.addEventListener('blur', () => state.releaseAll());

  function updateTouchAxes() {
    const m = move ? stickVector(move.ax, move.ay, move.x, move.y) : { x: 0, y: 0 };
    state.setAxis(TOUCH, 'move', m.x, m.y);
    const a = aim ? stickVector(aim.ax, aim.ay, aim.x, aim.y) : { x: 0, y: 0 };
    state.setAxis(TOUCH, 'aim', a.x, a.y);
  }

  target.addEventListener('pointerdown', (e) => {
    fireGesture();
    const p = toScreen(e.clientX, e.clientY);
    state.setPointer(p.x, p.y, true);
    if (e.pointerType !== 'touch') {
      setDevice('keyboard');
      return;
    }
    setDevice('touch');
    const b = hitButton(p.x, p.y);
    if (b) {
      buttonTouches.set(e.pointerId, b.action);
      state.setRaw(TOUCH, b.action, true);
    } else if (p.x < 192) move = { id: e.pointerId, ax: p.x, ay: p.y, x: p.x, y: p.y };
    else if (aimStick) aim = { id: e.pointerId, ax: p.x, ay: p.y, x: p.x, y: p.y };
    updateTouchAxes();
    target.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  target.addEventListener('pointermove', (e) => {
    const p = toScreen(e.clientX, e.clientY);
    state.setPointer(p.x, p.y, e.buttons !== 0);
    for (const s of [move, aim]) if (s && s.id === e.pointerId) { s.x = p.x; s.y = p.y; }
    updateTouchAxes();
  });
  const up = (e: PointerEvent) => {
    const p = toScreen(e.clientX, e.clientY);
    state.setPointer(p.x, p.y, false);
    const a = buttonTouches.get(e.pointerId);
    if (a) {
      buttonTouches.delete(e.pointerId);
      state.setRaw(TOUCH, a, false);
    }
    if (move?.id === e.pointerId) move = null;
    if (aim?.id === e.pointerId) aim = null;
    updateTouchAxes();
  };
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
  target.addEventListener('contextmenu', (e) => e.preventDefault());

  const padPrev = new Uint8Array(17);
  return {
    setKeyMap(m) {
      map = { ...m };
    },
    keyMap: () => map,
    captureNextKey(cb) {
      capture = cb;
    },
    onFirstGesture(cb) {
      gesture.push(cb);
    },
    onKey(cb) {
      keyHooks.push(cb);
    },
    setAimStick(on) {
      aimStick = on;
      if (!on) aim = null;
    },
    pollGamepads() {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) if (p && p.connected) { pad = p; break; }
      if (!pad) return;
      let any = false;
      for (const [i, a] of PAD_BUTTONS) {
        const down = pad.buttons[i]?.pressed ? 1 : 0;
        if (down !== padPrev[i]) {
          padPrev[i] = down;
          state.setRaw(PAD, a, down === 1);
          any = true;
        }
      }
      const mx = deadzone(pad.axes[0] ?? 0), my = deadzone(pad.axes[1] ?? 0);
      const ax = deadzone(pad.axes[2] ?? 0), ay = deadzone(pad.axes[3] ?? 0);
      state.setAxis(PAD, 'move', mx, my);
      state.setAxis(PAD, 'aim', ax, ay);
      if (any || mx || my || ax || ay) {
        setDevice('gamepad');
        fireGesture();
      }
    },
    drawTouch(ctx) {
      if (device !== 'touch') return;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#f4f4f8';
      ctx.fillStyle = '#f4f4f8';
      for (const s of [move, aim]) {
        if (!s) continue;
        ctx.beginPath();
        ctx.arc(s.ax, s.ay, STICK_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        const v = stickVector(s.ax, s.ay, s.x, s.y);
        ctx.beginPath();
        ctx.arc(s.ax + v.x * STICK_RADIUS, s.ay + v.y * STICK_RADIUS, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const b of [...BUTTONS, PAUSE_BUTTON]) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}
