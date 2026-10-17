import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const ROOT = join(__dirname, '..', '..');

/** Files under dir (relative to repo root) matching ext, as posix paths. */
export function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const n of names) {
      if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (ext.test(n)) out.push(relative(ROOT, p).split(sep).join('/'));
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

export const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Strip comments (keeps strings) so scans do not trip on prose. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Module specifiers from import/export-from/dynamic import. */
export function imports(src: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}

export const GAME_IDS = ['shooter', 'racer', 'mrfart'] as const;
