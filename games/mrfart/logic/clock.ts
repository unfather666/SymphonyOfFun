// In-game time. A day is world.dayMs of game clock; the game starts at world.startHour.
export function hourAt(nowMs: number, dayMs: number, startHour: number): number {
  return (startHour + (nowMs / dayMs) * 24) % 24;
}

/** Day number: increases at every 00:00 (day 0 starts at the clock's zero). */
export function dayIndexAt(nowMs: number, dayMs: number, startHour: number): number {
  return Math.floor((nowMs + (startHour / 24) * dayMs) / dayMs);
}

/** "08:05". */
export function formatClock(hour: number): string {
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
