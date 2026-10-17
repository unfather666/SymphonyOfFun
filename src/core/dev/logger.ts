import type { Logger } from '../api';

export interface CoreLogger extends Logger {
  /** Messages logged so far (newest last, capped at 64) for the crash screen and tests. */
  recent(): readonly string[];
}

export function createLogger(prefix: string, sink: Pick<Console, 'info' | 'warn' | 'error'> = console): CoreLogger {
  const seen = new Set<string>();
  const recent: string[] = [];
  const keep = (m: string) => {
    recent.push(m);
    if (recent.length > 64) recent.shift();
  };
  return {
    info(msg) {
      sink.info(`[${prefix}] ${msg}`);
    },
    warn(key, msg) {
      if (seen.has(key)) return;
      seen.add(key);
      keep(msg);
      sink.warn(`[${prefix}] ${msg}`);
    },
    error(key, msg) {
      if (seen.has('E' + key)) return;
      seen.add('E' + key);
      keep(msg);
      sink.error(`[${prefix}] ${msg}`);
    },
    recent: () => recent,
  };
}
