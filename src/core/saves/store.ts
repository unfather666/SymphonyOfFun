import type { SaveResult, SaveSection, SaveStore } from '../api';
import { hashString } from '../random/mulberry32';

export const SAVE_FORMAT = 'sof-save';
export const ENVELOPE_VERSION = 1;

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface Envelope {
  format: typeof SAVE_FORMAT;
  gameId: string;
  version: number;
  savedAt: number;
  checksum: number;
  sections: Record<string, { version: number; data: unknown }>;
}

export function memoryStorage(): Storage & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

/** localStorage when it works (it can throw in private mode), else memory. */
export function browserStorage(): Storage {
  try {
    const ls = globalThis.localStorage;
    const probe = '__sof_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => ls.setItem(k, v),
      remove: (k) => ls.removeItem(k),
    };
  } catch {
    return memoryStorage();
  }
}

export function checksumOf(sections: Envelope['sections']): number {
  return hashString(JSON.stringify(sections));
}

const ok = (message = ''): SaveResult => ({ ok: true, message });
const fail = (message: string): SaveResult => ({ ok: false, message });

export interface CoreSaveStore extends SaveStore {
  keyFor(slot: string): string;
}

/**
 * Sections are registered by the game; a slot holds one envelope. A save that fails to load
 * is copied untouched to `<slot>:bad` (never overwritten once written) and the slot is left as is.
 * A too-new save is refused and the slot is locked against saving over it this session.
 */
export function createSaveStore(gameId: string, storage: Storage, now: () => number = () => Date.now()): CoreSaveStore {
  const sections = new Map<string, SaveSection<unknown>>();
  const locked = new Set<string>();
  const keyFor = (slot: string) => `sof:${gameId}:${slot}`;

  function keepBad(slot: string, raw: string) {
    const badKey = keyFor(slot) + ':bad';
    if (storage.get(badKey) === null) storage.set(badKey, raw);
  }

  return {
    keyFor,
    register(section) {
      if (!/^[a-z0-9_]+$/.test(section.key)) throw new Error(`Save section key "${section.key}" must match ^[a-z0-9_]+$`);
      sections.set(section.key, section as SaveSection<unknown>);
    },
    save(slot) {
      if (locked.has(slot)) return fail(`Slot "${slot}" holds a save from a newer version; not overwriting it.`);
      const out: Envelope['sections'] = {};
      for (const [key, s] of sections) out[key] = { version: s.version, data: s.serialize() };
      const env: Envelope = {
        format: SAVE_FORMAT,
        gameId,
        version: ENVELOPE_VERSION,
        savedAt: now(),
        checksum: checksumOf(out),
        sections: out,
      };
      try {
        storage.set(keyFor(slot), JSON.stringify(env));
      } catch (e) {
        return fail(`Could not write the save (${e instanceof Error ? e.message : String(e)}).`);
      }
      return ok();
    },
    load(slot) {
      const raw = storage.get(keyFor(slot));
      if (raw === null) return fail(`No save in slot "${slot}".`);
      let env: Envelope;
      try {
        env = JSON.parse(raw) as Envelope;
      } catch {
        keepBad(slot, raw);
        return fail(`The save in slot "${slot}" is damaged (not JSON). A copy was kept as "${slot}:bad".`);
      }
      if (!env || env.format !== SAVE_FORMAT || env.gameId !== gameId || typeof env.sections !== 'object' || env.sections === null) {
        keepBad(slot, raw);
        return fail(`The save in slot "${slot}" is not a ${gameId} save. A copy was kept as "${slot}:bad".`);
      }
      if (env.version > ENVELOPE_VERSION) {
        locked.add(slot);
        return fail(`The save in slot "${slot}" was made by a newer version of the game.`);
      }
      if (checksumOf(env.sections) !== env.checksum) {
        keepBad(slot, raw);
        return fail(`The save in slot "${slot}" failed its checksum. A copy was kept as "${slot}:bad".`);
      }
      // Validate and migrate everything before touching game state.
      const ready: Array<[SaveSection<unknown>, unknown]> = [];
      for (const [key, s] of sections) {
        const entry = env.sections[key];
        if (!entry) continue; // section added after this save was made: keep defaults
        if (entry.version > s.version) {
          locked.add(slot);
          return fail(`Save section "${key}" is from a newer version (${entry.version} > ${s.version}).`);
        }
        let data = entry.data;
        if (entry.version < s.version) {
          if (!s.migrate) {
            keepBad(slot, raw);
            return fail(`Save section "${key}" is version ${entry.version} and there is no migration to ${s.version}.`);
          }
          try {
            data = s.migrate(data, entry.version);
          } catch (e) {
            keepBad(slot, raw);
            return fail(`Migrating save section "${key}" failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        ready.push([s, data]);
      }
      try {
        for (const [s, data] of ready) s.deserialize(data);
      } catch (e) {
        keepBad(slot, raw);
        return fail(`Loading the save failed: ${e instanceof Error ? e.message : String(e)}. A copy was kept as "${slot}:bad".`);
      }
      return ok();
    },
    has: (slot) => storage.get(keyFor(slot)) !== null,
    remove(slot) {
      storage.remove(keyFor(slot));
      locked.delete(slot);
    },
  };
}
