// A small local copy of the core loader's field checks so content tests need no core internals.
import type { FieldSpec, Schema } from '../../../src/core/api';

const ID = /^[a-z0-9_]+$/;

function ok(spec: FieldSpec, v: unknown): boolean {
  switch (spec.type) {
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) && (!spec.int || Number.isInteger(v)) && (spec.min === undefined || v >= spec.min) && (spec.max === undefined || v <= spec.max);
    case 'string':
      return typeof v === 'string' && (!spec.oneOf || spec.oneOf.includes(v));
    case 'boolean':
      return typeof v === 'boolean';
    case 'id':
      return typeof v === 'string' && ID.test(v);
    case 'string[]':
      return Array.isArray(v) && v.every((x) => typeof x === 'string');
    case 'number[]':
      return Array.isArray(v) && v.every((x) => typeof x === 'number');
    case 'id[]':
      return Array.isArray(v) && v.every((x) => typeof x === 'string' && ID.test(x));
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'any':
      return true;
  }
}

/** Plain-English problems of one def against a schema ([] = fine). */
export function problemsOf(def: Record<string, unknown>, schema: Schema): string[] {
  const out: string[] = [];
  for (const k of Object.keys(def)) if (!['id', 'extends', 'tags'].includes(k) && !(k in schema)) out.push(`unknown field ${k}`);
  for (const [k, spec] of Object.entries(schema)) {
    const v = def[k];
    if (v === undefined) {
      if (!spec.optional) out.push(`missing ${k}`);
    } else if (!ok(spec, v)) out.push(`bad ${k}`);
  }
  return out;
}
