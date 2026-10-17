/** Default 32-colour palette (made for this project). Index 0 is transparent in sprites. */
export const DEFAULT_PALETTE: readonly string[] = Object.freeze([
  '#000000', // 0 black / transparent in sprites
  '#0b0b14', // 1 night
  '#1c1c2e', // 2 ink
  '#33334d', // 3 slate
  '#5c5c7a', // 4 grey
  '#8f8fa8', // 5 silver
  '#c7c7d6', // 6 mist
  '#f4f4f8', // 7 white
  '#3d1f1f', // 8 dried blood
  '#7a2626', // 9 brick
  '#c43c3c', // 10 red
  '#ff7a6b', // 11 salmon
  '#5c3317', // 12 brown
  '#a35a2a', // 13 rust
  '#e89a4f', // 14 orange
  '#ffd08a', // 15 peach
  '#6b5a12', // 16 olive
  '#b89b2e', // 17 mustard
  '#f2dc4b', // 18 yellow
  '#fff6a8', // 19 cream
  '#17402a', // 20 deep green
  '#2f7a3c', // 21 green
  '#62c14e', // 22 lime
  '#b8f07a', // 23 mint
  '#0f3a44', // 24 deep teal
  '#1f7380', // 25 teal
  '#3fb8c4', // 26 cyan
  '#a3f0f0', // 27 ice
  '#1f2466', // 28 navy
  '#3b47c4', // 29 blue
  '#8a5ad6', // 30 violet
  '#e07ad6', // 31 pink
]);

/** Sprite row char → palette index: '0'-'9' then 'a'-'v' (base 32). '.' or ' ' = transparent. */
export function charToIndex(ch: string): number {
  if (ch === '.' || ch === ' ') return -1;
  const n = parseInt(ch, 32);
  return Number.isNaN(n) ? -1 : n;
}
