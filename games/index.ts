// Game registry. Owned by core: game threads never edit this file.
import type { GameModule } from '../src/core/api';
import mrfart from './mrfart';
import racer from './racer';
import shooter from './shooter';

export const GAMES: readonly GameModule[] = [shooter, racer, mrfart];
