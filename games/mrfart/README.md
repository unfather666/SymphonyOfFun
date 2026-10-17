# Mr Fart (`games/mrfart/`)

Top-down physics game, 384x216. One folder, one `GameModule` (`index.ts`).

Run: `npm run dev`, open `/?game=mrfart&seed=1`. Walk with WASD or arrows, run with K, clench with L (hold), J or Space interacts, `;` uses the selected item, Q and E change item. F3 shows step and draw times. `?ending=<id>` jumps to that ending screen (see `content/endings/`).

## Layout
- `physics/PhysicsApi.ts` the only physics surface; `physics/NullPhysics.ts` test stand-in; `physics/rapier/` the only place Rapier is imported.
- `logic/` pure, Node-tested: `sim.ts` (one `stepSim`), `farts.ts` (the one door that fires a fart), `meters.ts`, `people.ts`, `routes.ts`, `stream.ts` (bodies only near the player), `map.ts`, `pools.ts`, `rules.ts`; jobs: `jobs.ts` (generator), `pipeline.ts`, `verbs.ts`, `subjects.ts`, `trail.ts`; `items.ts`, `endings.ts`; `save.ts` (progress v2 with a v1 migration, options v1).
- Art: pixel sprites are data in `content/sprites/*.json` (people share one sheet recoloured per person at load, subjects and props have their own). Night tint is a core mask pass skipped under `reducedFx`.
- Touch: the core overlay has A and B only, so on touch a tap on the meter bar toggles the clench and a tap on the item label uses the item (taps at its left and right ends change item).
- `content/` JSON: `rules.json` (all caps and tuning), one folder per kind of thing, `map.json`, `strings.json`, `events.json`.
- `render/` drawing only. `index.ts` wires core to the sim.
- Physics units are pixels; `impulseRadial(force)` is the velocity change in px/s for a mass-1 body at the centre, heavier bodies move less (`MASS_REF`).
- Adding a job type, subject, item or ending is a JSON def plus its strings; content tests check counts and strings.

## Tests
`npm run test` runs `tests/`: physics contract on both implementations, determinism, meter and witness numbers, map and line of sight, pool full policies, rules validation, job pipeline and every job type played by a scripted player (`tests/bot.ts`), items, endings, streaming of 60 people, `save.test.ts` (round trip, v1 fixture, bad data), a ten-minute playthrough with all 60 residents about, and a pacing run (`PACING=1` prints the table below with 12 jobs per band).

## Pacing
Scripted player walking the street graph at walking speed, taking the first board offer and returning to the board each time (a perfect player: a person is slower).

| Band | Jobs sampled | Mean seconds per task | Tasks per hour |
|---|---|---|---|
| tier 0 (tasks 0-49) | 12 | 22 | 162 |
| tier 1 (50-99) | 12 | 38 | 94 |
| tier 2 (100-149) | 12 | 22 | 165 |
| tier 3 (150-199) | 12 | 50 | 72 |
| mixed (200+) | 12 | 30 | 120 |

Reaching 1,000 tasks at those rates is about 8.5 hours for the scripted player. The next absurdity tier starts every 50 tasks, so the scripted player reaches tier 1 after about 18 minutes of play; a person takes longer. Dev console: `sof.cheat('load_test')` fills the body cap and piece pool for budget runs; other cheats are in `logic/cheats.ts`.

## Core asks
(none)

## Budget
See `docs/budgets.md`: one row per milestone, Chromium headless, 4x CPU throttle. The M4 row is the full scene: body cap and 256 pieces in play.
