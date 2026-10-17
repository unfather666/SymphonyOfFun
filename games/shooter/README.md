# Deep Signal (`games/shooter/`)

Top-down shooter, 384x216. Owned by the shooter game thread.

Run: `npm run dev`, then open `/?game=shooter&seed=1`. Pick a level on the select screen (arrows, `J` to start, `;` for the rig menu).

## Layout
`logic/` pure sim (Node-tested), `render/` drawing only, `content/` JSON defs + `schemas.ts` + `load.ts` (loads through core), `tests/` vitest, `agent-tests/` browser smoke scripts (need `npm run dev`).

## Dev cheats
In the dev console: `sof.cheat('points')`, `'god'`, `'give_all'`, `'slots6'`, `'madness3'`, `'madness'`, `'clear'` (finish the current level), `'stress'` (keep 200 enemies and 512 bullets alive).

Browser scripts in `agent-tests/` (need `npm run dev`): `smoke.mjs`, `levels-smoke.mjs`, `playthrough.mjs` (phone-size touch pass over levels 1 to 12), `budget.mjs` (4x CPU throttle step time under the stress load).

## Core asks
- `chip.sequencer.detune(voice, cents)`: not in the frozen API. The game seeks to a second half of each song instead.

## Budget
Measured rows are in `docs/budgets.md`.
