import type { MenuItem } from '../api';

/** Move the cursor by dir (+1/-1), wrapping and skipping disabled items. Returns -1 if none pickable. */
export function moveCursor(items: readonly Pick<MenuItem, 'disabled'>[], from: number, dir: number): number {
  const n = items.length;
  if (n === 0) return -1;
  for (let k = 1; k <= n; k++) {
    const i = (((from + dir * k) % n) + n) % n;
    if (!items[i]!.disabled) return i;
  }
  return -1;
}

export function firstPickable(items: readonly Pick<MenuItem, 'disabled'>[]): number {
  return items.findIndex((i) => !i.disabled);
}
