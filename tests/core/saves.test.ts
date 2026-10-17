import { describe, expect, test } from 'vitest';
import { createSaveStore, memoryStorage } from '../../src/core/saves/store';

function setup(version = 1, migrate?: (d: unknown, from: number) => { n: number }) {
  const storage = memoryStorage();
  const state = { n: 0 };
  const store = createSaveStore('shooter', storage, () => 1000);
  store.register<{ n: number }>({
    key: 'progress',
    version,
    serialize: () => ({ n: state.n }),
    deserialize: (d) => {
      state.n = d.n;
    },
    ...(migrate ? { migrate } : {}),
  });
  return { storage, state, store };
}

describe('save store', () => {
  test('round trip', () => {
    const { state, store } = setup();
    state.n = 42;
    expect(store.save('a').ok).toBe(true);
    state.n = 0;
    expect(store.load('a')).toEqual({ ok: true, message: '' });
    expect(state.n).toBe(42);
  });
  test('envelope shape', () => {
    const { storage, state, store } = setup();
    state.n = 1;
    store.save('a');
    const env = JSON.parse(storage.get('sof:shooter:a')!);
    expect(Object.keys(env).sort()).toEqual(['checksum', 'format', 'gameId', 'savedAt', 'sections', 'version']);
    expect(env.format).toBe('sof-save');
    expect(env.savedAt).toBe(1000);
    expect(env.sections.progress).toEqual({ version: 1, data: { n: 1 } });
  });
  test('damaged save is kept as :bad, untouched, and never overwritten', () => {
    const { storage, state, store } = setup();
    storage.set('sof:shooter:a', '{not json');
    const r = store.load('a');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/damaged/);
    expect(storage.get('sof:shooter:a:bad')).toBe('{not json');
    expect(storage.get('sof:shooter:a')).toBe('{not json');
    storage.set('sof:shooter:a', 'second garbage');
    store.load('a');
    expect(storage.get('sof:shooter:a:bad')).toBe('{not json');
    expect(state.n).toBe(0);
  });
  test('checksum mismatch is refused', () => {
    const { storage, state, store } = setup();
    state.n = 5;
    store.save('a');
    const env = JSON.parse(storage.get('sof:shooter:a')!);
    env.sections.progress.data.n = 999;
    storage.set('sof:shooter:a', JSON.stringify(env));
    state.n = 0;
    expect(store.load('a').message).toMatch(/checksum/);
    expect(state.n).toBe(0);
  });
  test('too-new section is refused and the slot is not overwritten', () => {
    const newer = setup(2);
    newer.state.n = 7;
    newer.store.save('a');
    const raw = newer.storage.get('sof:shooter:a')!;
    const older = setup(1);
    older.storage.set('sof:shooter:a', raw);
    expect(older.store.load('a').message).toMatch(/newer/);
    expect(older.store.save('a').ok).toBe(false);
    expect(older.storage.get('sof:shooter:a')).toBe(raw);
  });
  test('old version migrates', () => {
    const v1 = setup(1);
    v1.state.n = 3;
    v1.store.save('a');
    const raw = v1.storage.get('sof:shooter:a')!;
    const v2 = setup(2, (d, from) => {
      expect(from).toBe(1);
      return { n: (d as { n: number }).n * 10 };
    });
    v2.storage.set('sof:shooter:a', raw);
    expect(v2.store.load('a').ok).toBe(true);
    expect(v2.state.n).toBe(30);
  });
  test('missing migration is refused and kept', () => {
    const v1 = setup(1);
    v1.store.save('a');
    const v2 = setup(2);
    v2.storage.set('sof:shooter:a', v1.storage.get('sof:shooter:a')!);
    expect(v2.store.load('a').message).toMatch(/no migration/);
    expect(v2.storage.get('sof:shooter:a:bad')).not.toBeNull();
  });
  test('wrong game is refused', () => {
    const { storage, store } = setup();
    storage.set('sof:shooter:a', JSON.stringify({ format: 'sof-save', gameId: 'racer', version: 1, checksum: 0, sections: {} }));
    expect(store.load('a').message).toMatch(/not a shooter save/);
  });
  test('bad section key throws at register', () => {
    const { store } = setup();
    expect(() => store.register({ key: 'Bad Key', version: 1, serialize: () => 0, deserialize: () => {} })).toThrow();
  });
});
