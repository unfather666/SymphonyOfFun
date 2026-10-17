// Turns core input into the sim's DriveInput. Touch has only a stick, A and B, so jump and use are taps on the right half of the screen.
import type { CoreContext } from '../../src/core/api';
import type { DriveInput } from './logic/types';

/** Right-half tap zones in 384x216 screen space (the pause button and A/B sit outside them). */
const USE_ZONE = { x0: 192, y0: 30, y1: 100 };
const JUMP_ZONE = { x0: 192, y0: 100 };
/** Bottom-right corner holding the A and B buttons. */
const BUTTON_CORNER = { x0: 300, y0: 150 };

export type TapZone = 'none' | 'use' | 'jump';

export function tapZone(x: number, y: number): TapZone {
  if (x >= USE_ZONE.x0 && y >= USE_ZONE.y0 && y < USE_ZONE.y1) return 'use';
  if (x >= JUMP_ZONE.x0 && y >= JUMP_ZONE.y0 && !(x >= BUTTON_CORNER.x0 && y >= BUTTON_CORNER.y0)) return 'jump';
  return 'none';
}

export function readControls(ctx: CoreContext, inp: DriveInput): void {
  const touch = ctx.input.device() === 'touch';
  inp.steer = ctx.input.axis('move').x;
  inp.accel = touch || ctx.input.held('a');
  inp.accelPressed = ctx.input.pressed('a');
  inp.brake = ctx.input.held('b');
  inp.jumpPressed = ctx.input.pressed('y');
  inp.usePressed = ctx.input.pressed('x');
  if (touch) {
    const p = ctx.input.pointer();
    if (p.pressed) {
      const z = tapZone(p.x, p.y);
      if (z === 'jump') inp.jumpPressed = true;
      else if (z === 'use') inp.usePressed = true;
    }
  }
}
