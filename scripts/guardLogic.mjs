// Pure logic for the cross-folder guard (BUILD-PLAN §10): a PR may change at most one games/<id>/ folder.
// A folder that did not exist on the base branch does not count (the scaffold creates all three).

/** @param {string[]} changed @param {Set<string>} existingAtBase */
export function touchedGames(changed, existingAtBase) {
  const set = new Set();
  for (const f of changed) {
    const m = /^games\/([^/]+)\//.exec(f);
    if (m && existingAtBase.has(m[1])) set.add(m[1]);
  }
  return [...set].sort();
}

/** @returns {string | null} plain-English failure, or null when fine */
export function guardMessage(touched) {
  if (touched.length <= 1) return null;
  return `This change edits ${touched.length} game folders (${touched.map((g) => `games/${g}/`).join(', ')}). Each PR may change one game only; split it.`;
}
