# Mr Fart (`games/mrfart/`)

Top-down physics reputation game, 384x216. Owned by the mrfart game thread (BUILD-PLAN §0, §10). Design: `plan/DESIGN-mrfart.md`.

Run: `npm run dev`, open `/?game=mrfart&seed=1`. Walk with WASD or arrows, run with K. F3 shows step and draw times.

## Layout
- `physics/PhysicsApi.ts` the only physics surface; `physics/NullPhysics.ts` test stand-in; `physics/rapier/` the only place Rapier is imported.
- `logic/` pure, Node-tested: `sim.ts` (one `stepSim`), `farts.ts` (the one door that fires a fart), `meters.ts`, `people.ts`, `map.ts`, `pools.ts`, `rules.ts`.
- `content/` JSON: `rules.json` (all caps and tuning), `farts/ props/ people/ sprites/`, `map.json`, `strings.json`, `events.json`.
- `render/` drawing only. `index.ts` wires core to the sim.
- Physics units are pixels; `impulseRadial(force)` is the velocity change in px/s for a mass-1 body at the centre, heavier bodies move less (`MASS_REF`).

## Status
| Milestone | What works | How to see it | Known gaps |
|---|---|---|---|
| M0 Walk and fart | Rapier2D behind `PhysicsApi`; 2x2 block neighbourhood with static walls; Mr Fart (capsule); 10 props; 5 people on fixed loops; meter fills by distance (2x running); fart = radial impulse + green puffs + ring + pitch-bent chip sfx + camera shake; loud farts knock bins over and break crates into pieces | `?game=mrfart&seed=1`, run (K) until the meter fills | Placeholder rects for people and props; no witnesses or reputation yet (M1) |

## Tests
`npm run test` runs `tests/`: PhysicsApi contract on both implementations (null and Rapier), determinism (same seed 600 steps same hash, other seed differs), fart physics (loud knocks bins and breaks the crate, quiet does nothing, player not self-pushed), meter numbers, map building and line of sight, pool full policies, rules validation.

## Core asks
(none)

## Budget
M0 on Chromium headless, 4x CPU throttle, 5 people + 10 props moving: step 0.8 ms avg / 2.4 ms worst, draw 2.9 ms avg, 60 fps. Full budget row comes with M4.
