import type { EventBus, EventPayload } from '../api';

export const EVENT_QUEUE_CAP = 4096;
const EMPTY: EventPayload = Object.freeze({});

export interface CoreEventBus extends EventBus {
  /** Deliver everything queued before this call. Events emitted by handlers wait for the next flush. */
  flush(): number;
  clear(): void;
  queued(): number;
  /** Drop every handler (game shutdown). */
  offAll(): void;
}

interface Queued {
  name: string;
  payload: EventPayload;
  key: string | undefined;
}

export function createEventBus(warn: (key: string, msg: string) => void = () => {}): CoreEventBus {
  const handlers = new Map<string, Array<(p: EventPayload) => void>>();
  let queue: Queued[] = [];
  let spare: Queued[] = [];
  const merge = new Map<string, Queued>();

  function checkPayload(name: string, payload: EventPayload): boolean {
    for (const k in payload) {
      const t = typeof payload[k];
      if (t !== 'number' && t !== 'string' && t !== 'boolean') {
        warn(`event-payload:${name}`, `Event "${name}" field "${k}" is a ${t}; payloads carry ids and numbers only. Dropped.`);
        return false;
      }
    }
    return true;
  }

  return {
    emit(name, payload = EMPTY, mergeKey) {
      if (!checkPayload(name, payload)) return;
      if (mergeKey !== undefined) {
        const key = name + '\u0000' + mergeKey;
        const prev = merge.get(key);
        if (prev) {
          prev.payload = payload;
          return;
        }
        if (queue.length >= EVENT_QUEUE_CAP) {
          warn('event-queue-full', `Event queue full (${EVENT_QUEUE_CAP}); dropping new events.`);
          return;
        }
        const q = { name, payload, key };
        merge.set(key, q);
        queue.push(q);
        return;
      }
      if (queue.length >= EVENT_QUEUE_CAP) {
        warn('event-queue-full', `Event queue full (${EVENT_QUEUE_CAP}); dropping new events.`);
        return;
      }
      queue.push({ name, payload, key: undefined });
    },
    on(name, handler) {
      let list = handlers.get(name);
      if (!list) handlers.set(name, (list = []));
      list.push(handler);
      return () => {
        const l = handlers.get(name);
        if (!l) return;
        const i = l.indexOf(handler);
        if (i >= 0) l.splice(i, 1);
      };
    },
    flush() {
      const batch = queue;
      queue = spare;
      queue.length = 0;
      merge.clear();
      for (let i = 0; i < batch.length; i++) {
        const ev = batch[i]!;
        const list = handlers.get(ev.name);
        if (!list) continue;
        for (let j = 0; j < list.length; j++) list[j]!(ev.payload);
      }
      const n = batch.length;
      batch.length = 0;
      spare = batch;
      return n;
    },
    clear() {
      queue.length = 0;
      merge.clear();
    },
    queued: () => queue.length,
    offAll() {
      handlers.clear();
    },
  };
}
