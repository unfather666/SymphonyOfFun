// Fails when the current branch changes more than one games/<id>/ folder relative to its base.
// Base: $GUARD_BASE, else origin/$GITHUB_BASE_REF (PRs in CI), else origin/main. No base found → skip with a note.
import { execFileSync } from 'node:child_process';
import { guardMessage, touchedGames } from './guardLogic.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const candidates = [process.env.GUARD_BASE, process.env.GITHUB_BASE_REF && `origin/${process.env.GITHUB_BASE_REF}`, 'origin/main'].filter(Boolean);
let base = null;
for (const c of candidates) {
  try {
    git('rev-parse', '--verify', `${c}^{commit}`);
    base = c;
    break;
  } catch {
    /* try next */
  }
}
if (!base) {
  console.log('guard: no base branch found; folder guard skipped (CI always has one).');
  process.exit(0);
}
const mergeBase = git('merge-base', base, 'HEAD');
const changed = git('diff', '--name-only', `${mergeBase}`, '--').split('\n').filter(Boolean);
let atBase = [];
try {
  atBase = git('ls-tree', '-d', '--name-only', `${mergeBase}:games`).split('\n').filter(Boolean);
} catch {
  /* no games/ at base */
}
const touched = touchedGames(changed, new Set(atBase));
const msg = guardMessage(touched);
if (msg) {
  console.error(`guard: ${msg}`);
  process.exit(1);
}
console.log(`guard: ok (${touched.length ? `games/${touched[0]}/` : 'no game folder'} changed vs ${base}).`);
