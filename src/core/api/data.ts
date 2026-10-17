// Saves and content defs.

// ---- saves ----------------------------------------------------------------

export interface SaveSection<T = unknown> {
  key: string;
  version: number;
  serialize(): T;
  deserialize(data: T): void;
  /** Bring data from an older version up to `version`. */
  migrate?(data: unknown, fromVersion: number): T;
}

export interface SaveResult {
  ok: boolean;
  /** Plain-English reason when not ok. */
  message: string;
}

export interface SaveStore {
  register<T>(section: SaveSection<T>): void;
  save(slot: string): SaveResult;
  load(slot: string): SaveResult;
  has(slot: string): boolean;
  remove(slot: string): void;
}

// ---- content --------------------------------------------------------------

export type FieldSpec =
  | { type: 'number'; min?: number; max?: number; int?: boolean; optional?: boolean }
  | { type: 'string'; oneOf?: readonly string[]; optional?: boolean }
  | { type: 'boolean'; optional?: boolean }
  | { type: 'id'; optional?: boolean }
  | { type: 'string[]' | 'number[]' | 'id[]'; optional?: boolean }
  | { type: 'object' | 'any'; optional?: boolean };

/** Fields besides the implicit id, extends and tags. Unknown keys are refused. */
export type Schema = Readonly<Record<string, FieldSpec>>;

export interface Def {
  readonly id: string;
  readonly tags: readonly string[];
  readonly [key: string]: unknown;
}

export interface Registry<T extends Def = Def> {
  readonly kind: string;
  byId(id: string): T | undefined;
  /** Throws a plain-English error if missing; use where an id was validated at load. */
  get(id: string): T;
  byTag(tag: string): readonly T[];
  all(): readonly T[];
  /** Plain-English messages for dropped defs. */
  readonly errors: readonly string[];
}

export interface ContentLoader {
  /**
   * files: the result of import.meta.glob('./content/kind/*.json', { eager: true }) or a plain
   * object of path → JSON. Each file holds one def or an array of defs.
   */
  load<T extends Def = Def>(kind: string, files: Record<string, unknown>, schema: Schema): Registry<T>;
}
