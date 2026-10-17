import type { GameId } from './core/api';
import { boot } from './core/runtime';
import { GAMES } from '../games';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');

const stringFiles = import.meta.glob('../games/*/content/strings.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;
const strings = {} as Record<GameId, Record<string, string>>;
for (const [path, table] of Object.entries(stringFiles)) {
  const id = path.split('/')[2] as GameId;
  strings[id] = table;
}

boot({
  stage: document.getElementById('stage')!,
  games: GAMES,
  strings,
  startGame: params.get('game'),
  seed: seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : null,
  crashDemo: params.get('crash') === '1',
});
