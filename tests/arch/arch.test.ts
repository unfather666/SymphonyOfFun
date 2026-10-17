import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { CORE_EVENTS } from '../../src/core/api';
import { ID_RE } from '../../src/core/content/loader';
import { guardMessage, touchedGames } from '../../scripts/guardLogic.mjs';
import { GAME_IDS, files, imports, read, stripComments } from './scan';

const code = (dir: string) => files(dir, /\.(ts|tsx|mts|js|mjs)$/);
const gameFiles = code('games');
const coreFiles = code('src');

/** Resolve a relative specifier from a repo file to a repo path (no extension). */
const resolveFrom = (file: string, spec: string) => (spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), spec)) : spec);

describe('confinement (BUILD-PLAN §2)', () => {
  const rules: Array<[RegExp, string]> = [
    [/^three(\/|$)/, 'games/racer/render/three/'],
    [/^@dimforge\/rapier2d/, 'games/mrfart/physics/rapier/'],
  ];
  test('three and rapier only inside their folders', () => {
    const bad: string[] = [];
    for (const f of [...gameFiles, ...coreFiles])
      for (const spec of imports(read(f)))
        for (const [re, home] of rules) if (re.test(spec) && !f.startsWith(home)) bad.push(`${f} imports ${spec} (allowed only in ${home})`);
    expect(bad).toEqual([]);
  });
  test('package.json pins exact versions and only the allowed runtime deps', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@dimforge/rapier2d-compat', 'three']);
    for (const [n, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) expect(v, n).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('boundaries (BUILD-PLAN §0)', () => {
  test('games import core only through src/core/api, never another game', () => {
    const bad: string[] = [];
    for (const f of gameFiles) {
      if (f === 'games/index.ts') continue;
      const own = f.split('/')[1]!;
      for (const spec of imports(read(f))) {
        const r = resolveFrom(f, spec);
        if (r.startsWith('src/') && !/^src\/core\/api(\/index(\.ts)?)?$/.test(r)) bad.push(`${f} imports ${spec} (use src/core/api)`);
        const m = /^games\/([^/]+)/.exec(r);
        if (m && m[1] !== own) bad.push(`${f} imports another game: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
  test('core never imports a game except the registry in main.ts', () => {
    const bad: string[] = [];
    for (const f of coreFiles)
      for (const spec of imports(read(f))) {
        const r = resolveFrom(f, spec);
        if (r.startsWith('games') && f !== 'src/main.ts') bad.push(`${f} imports ${spec}`);
      }
    expect(bad).toEqual([]);
  });
  test('games/*/logic is pure: no core, render, DOM or audio', () => {
    const bad: string[] = [];
    for (const f of gameFiles.filter((f) => /^games\/[^/]+\/logic\//.test(f))) {
      const src = stripComments(read(f));
      for (const spec of imports(src)) {
        const r = resolveFrom(f, spec);
        if (r.startsWith('src/') || /\/render(\/|$)/.test(r) || /^(three|@dimforge)/.test(spec)) bad.push(`${f} imports ${spec}`);
      }
      if (/\b(document|window|AudioContext|localStorage|requestAnimationFrame)\b/.test(src)) bad.push(`${f} touches the DOM`);
    }
    expect(bad).toEqual([]);
  });
  test('every game folder exports a module with a matching id', () => {
    for (const id of GAME_IDS) expect(read(`games/${id}/index.ts`)).toMatch(new RegExp(`id:\\s*'${id}'`));
  });
});

describe('determinism (rules 2 and 3)', () => {
  test('no wall clock or Math.random in games/**', () => {
    const banned = /\b(Math\.random|Date\.now|performance\.now|new Date\s*\(|setTimeout|setInterval)\b/;
    const bad = gameFiles.filter((f) => banned.test(stripComments(read(f)))).map((f) => `${f}: ${stripComments(read(f)).match(banned)![0]}`);
    expect(bad).toEqual([]);
  });
  test('the scan itself catches a violation', () => {
    const banned = /\b(Math\.random|Date\.now|performance\.now|new Date\s*\(|setTimeout|setInterval)\b/;
    expect(banned.test(stripComments('const x = Math.random();'))).toBe(true);
    expect(banned.test(stripComments('// Math.random is banned'))).toBe(false);
  });
});

describe('content (rule 5)', () => {
  const NOT_DEFS = new Set(['strings.json', 'events.json']);
  const jsons = files('games', /\.json$/).filter((f) => f.includes('/content/') && !NOT_DEFS.has(posix.basename(f)));
  test('every def id is valid and unique per game and kind folder', () => {
    const bad: string[] = [];
    const seen = new Map<string, string>();
    for (const f of jsons) {
      let data: unknown;
      try {
        data = JSON.parse(read(f));
      } catch {
        bad.push(`${f} is not valid JSON`);
        continue;
      }
      const list = Array.isArray(data) ? data : [data];
      for (const d of list) {
        if (!d || typeof d !== 'object' || !('id' in d)) continue;
        const id = (d as { id: unknown }).id;
        if (typeof id !== 'string' || !ID_RE.test(id)) bad.push(`${f}: bad id ${JSON.stringify(id)}`);
        const key = `${posix.dirname(f)}#${String(id)}`;
        if (seen.has(key)) bad.push(`${f}: id "${String(id)}" also in ${seen.get(key)}`);
        else seen.set(key, f);
      }
    }
    expect(bad).toEqual([]);
  });
  test('every game has strings.json with text values (rule 11)', () => {
    for (const id of GAME_IDS) {
      const s = JSON.parse(read(`games/${id}/content/strings.json`)) as Record<string, unknown>;
      for (const [k, v] of Object.entries(s)) expect(typeof v, `${id}:${k}`).toBe('string');
    }
  });
});

describe('events (rule 9)', () => {
  const emitRe = /\.emit\(\s*['"`]([^'"`]+)['"`]/g;
  test('games emit only <game>:<verb> names declared in content/events.json', () => {
    const bad: string[] = [];
    for (const id of GAME_IDS) {
      const declared = new Set((JSON.parse(read(`games/${id}/content/events.json`)) as { events: string[] }).events);
      for (const d of declared) if (!new RegExp(`^${id}:[a-z0-9_]+$`).test(d)) bad.push(`${id}/events.json: "${d}" must be "${id}:<verb>"`);
      for (const f of gameFiles.filter((f) => f.startsWith(`games/${id}/`))) {
        for (const m of stripComments(read(f)).matchAll(emitRe)) if (!declared.has(m[1]!)) bad.push(`${f} emits undeclared "${m[1]}"`);
      }
    }
    expect(bad).toEqual([]);
  });
  test('core emits only CORE_EVENTS', () => {
    const known = new Set<string>(CORE_EVENTS);
    const bad: string[] = [];
    for (const f of coreFiles) for (const m of stripComments(read(f)).matchAll(emitRe)) if (!known.has(m[1]!)) bad.push(`${f} emits "${m[1]}"`);
    expect(bad).toEqual([]);
  });
});

describe('file size (rule 13)', () => {
  test('no source file over 400 lines', () => {
    const bad = [...gameFiles, ...coreFiles].map((f) => [f, read(f).split('\n').length] as const).filter(([, n]) => n > 400);
    expect(bad).toEqual([]);
  });
});

describe('cross-folder guard (BUILD-PLAN §10)', () => {
  const base = new Set(['shooter', 'racer', 'mrfart']);
  test('one game folder is fine', () => {
    expect(guardMessage(touchedGames(['games/racer/a.ts', 'docs/budgets.md', 'HANDOFF.md'], base))).toBeNull();
  });
  test('two game folders fail', () => {
    const t = touchedGames(['games/racer/a.ts', 'games/shooter/b.ts'], base);
    expect(t).toEqual(['racer', 'shooter']);
    expect(guardMessage(t)).toBe('This change edits 2 game folders (games/racer/, games/shooter/). Each PR may change one game only; split it.');
  });
  test('folders new on this branch do not count (scaffold)', () => {
    expect(touchedGames(['games/racer/a.ts', 'games/shooter/b.ts'], new Set())).toEqual([]);
  });
  test('games/index.ts is not a game folder', () => {
    expect(touchedGames(['games/index.ts', 'games/racer/x.ts'], base)).toEqual(['racer']);
  });
});
