import type { ContentLoader, Def, FieldSpec, Registry, Schema } from '../api';

export const ID_RE = /^[a-z0-9_]+$/;
const IMPLICIT = new Set(['id', 'extends', 'tags']);

type Raw = Record<string, unknown>;

function checkField(name: string, spec: FieldSpec, v: unknown): string | null {
  const t = spec.type;
  switch (t) {
    case 'number': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return `"${name}" must be a number`;
      if (spec.int && !Number.isInteger(v)) return `"${name}" must be a whole number`;
      if (spec.min !== undefined && v < spec.min) return `"${name}" is ${v}, below the minimum ${spec.min}`;
      if (spec.max !== undefined && v > spec.max) return `"${name}" is ${v}, above the maximum ${spec.max}`;
      return null;
    }
    case 'string':
      if (typeof v !== 'string') return `"${name}" must be text`;
      if (spec.oneOf && !spec.oneOf.includes(v)) return `"${name}" is "${v}", expected one of ${spec.oneOf.join(', ')}`;
      return null;
    case 'boolean':
      return typeof v === 'boolean' ? null : `"${name}" must be true or false`;
    case 'id':
      return typeof v === 'string' && ID_RE.test(v) ? null : `"${name}" must be an id (a-z, 0-9, _)`;
    case 'string[]':
      return Array.isArray(v) && v.every((x) => typeof x === 'string') ? null : `"${name}" must be a list of text`;
    case 'number[]':
      return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? null : `"${name}" must be a list of numbers`;
    case 'id[]':
      return Array.isArray(v) && v.every((x) => typeof x === 'string' && ID_RE.test(x)) ? null : `"${name}" must be a list of ids`;
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v) ? null : `"${name}" must be an object`;
    case 'any':
      return null;
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze((o as Raw)[k]);
  }
  return o;
}

function flatten(files: Record<string, unknown>): Array<{ file: string; raw: unknown }> {
  const out: Array<{ file: string; raw: unknown }> = [];
  for (const file of Object.keys(files).sort()) {
    let v = files[file];
    // import.meta.glob eager JSON gives { default: ... } plus named keys.
    if (v && typeof v === 'object' && !Array.isArray(v) && 'default' in v) v = (v as Raw).default;
    if (Array.isArray(v)) for (const r of v) out.push({ file, raw: r });
    else out.push({ file, raw: v });
  }
  return out;
}

/**
 * Validate and register defs. Broken defs are dropped with a plain-English message; the rest load.
 * extends: one parent, resolved before validation (child keys override; tags are unioned).
 */
export function loadRegistry<T extends Def = Def>(kind: string, files: Record<string, unknown>, schema: Schema): Registry<T> {
  const errors: string[] = [];
  const raws = new Map<string, { file: string; raw: Raw }>();
  for (const { file, raw } of flatten(files)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`${kind}: ${file} has an entry that is not an object; dropped.`);
      continue;
    }
    const r = raw as Raw;
    const id = r.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      errors.push(`${kind}: ${file} has a def with a bad id ${JSON.stringify(id)} (use a-z, 0-9, _); dropped.`);
      continue;
    }
    if (raws.has(id)) {
      errors.push(`${kind}: id "${id}" in ${file} is already used in ${raws.get(id)!.file}; the second one is dropped.`);
      continue;
    }
    raws.set(id, { file, raw: r });
  }

  const resolved = new Map<string, Raw | null>();
  function resolve(id: string, chain: string[]): Raw | null {
    if (resolved.has(id)) return resolved.get(id)!;
    const entry = raws.get(id);
    if (!entry) return null;
    const parentId = entry.raw.extends;
    if (parentId === undefined) {
      resolved.set(id, entry.raw);
      return entry.raw;
    }
    if (typeof parentId !== 'string') {
      errors.push(`${kind}: "${id}" has "extends" that is not an id; dropped.`);
      resolved.set(id, null);
      return null;
    }
    if (chain.includes(parentId)) {
      errors.push(`${kind}: "${id}" extends itself through ${[...chain, parentId].join(' → ')}; dropped.`);
      resolved.set(id, null);
      return null;
    }
    const parent = resolve(parentId, [...chain, parentId]);
    if (!parent) {
      errors.push(`${kind}: "${id}" extends "${parentId}", which is missing or broken; dropped.`);
      resolved.set(id, null);
      return null;
    }
    const pTags = Array.isArray(parent.tags) ? (parent.tags as string[]) : [];
    const cTags = Array.isArray(entry.raw.tags) ? (entry.raw.tags as string[]) : [];
    const merged: Raw = { ...parent, ...entry.raw, tags: [...new Set([...pTags, ...cTags])] };
    resolved.set(id, merged);
    return merged;
  }

  const defs: T[] = [];
  const byId = new Map<string, T>();
  const byTag = new Map<string, T[]>();
  for (const id of raws.keys()) {
    const r = resolve(id, [id]);
    if (!r) continue;
    const problems: string[] = [];
    for (const key of Object.keys(r)) {
      if (!IMPLICIT.has(key) && !(key in schema)) problems.push(`unknown field "${key}"`);
    }
    if (r.tags !== undefined && !(Array.isArray(r.tags) && r.tags.every((t) => typeof t === 'string'))) problems.push('"tags" must be a list of text');
    for (const [name, spec] of Object.entries(schema)) {
      const v = r[name];
      if (v === undefined) {
        if (!spec.optional) problems.push(`missing "${name}"`);
        continue;
      }
      const p = checkField(name, spec, v);
      if (p) problems.push(p);
    }
    if (problems.length) {
      errors.push(`${kind}: "${id}" ${problems.join('; ')}; dropped.`);
      continue;
    }
    const { extends: _ext, ...rest } = r;
    const def = deepFreeze({ ...rest, id, tags: (r.tags as string[] | undefined) ?? [] }) as unknown as T;
    defs.push(def);
    byId.set(id, def);
    for (const t of def.tags) {
      let l = byTag.get(t);
      if (!l) byTag.set(t, (l = []));
      l.push(def);
    }
  }
  const none: readonly T[] = Object.freeze([]);
  return {
    kind,
    byId: (id) => byId.get(id),
    get(id) {
      const d = byId.get(id);
      if (!d) throw new Error(`${kind}: no def with id "${id}"`);
      return d;
    },
    byTag: (tag) => byTag.get(tag) ?? none,
    all: () => defs,
    errors,
  };
}

export function createContentLoader(onErrors: (kind: string, errors: readonly string[]) => void = () => {}): ContentLoader {
  return {
    load(kind, files, schema) {
      const reg = loadRegistry(kind, files, schema);
      if (reg.errors.length) onErrors(kind, reg.errors);
      return reg as never;
    },
  };
}
