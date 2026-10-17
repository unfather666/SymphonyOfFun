// Which tutorial caption (if any) is up at a given beat. Captions start at the beats listed on the level.
export function tutorialAt(starts: readonly number[] | undefined, beat: number, showBeats: number): number {
  if (!starts) return -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    const s = starts[i]!;
    if (beat >= s) return beat < s + showBeats ? i : -1;
  }
  return -1;
}
