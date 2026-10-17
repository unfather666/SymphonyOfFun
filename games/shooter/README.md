# Deep Signal (`games/shooter/`)

Top-down sci-fi shooter, 384x216, darkness is the gameplay. Owned by the shooter game thread (BUILD-PLAN §0, §10).

Run: `npm run dev`, then open `/?game=shooter&seed=1`.

## Status
| Milestone | What works | How to see it | Known gaps |
|---|---|---|---|
| S0 stub | Title screen, demo song, Esc → pause → quit | `?game=shooter` | (replaced by M0) |
| M0 | One lit room (30x18 tiles, lantern cone, flickering lamp, glass, water), player walk/aim/fire/dash/flare, cultist (walks and shoots) and deep one (chases and lunges), two waves, exit opens when clear, death restarts the room, hit/kill sfx, flow-field pathing round walls | `?game=shooter&seed=1` (J fire, K dash, L flare, WASD move, arrows or mouse aim) | One room only, default Rivet bolt only, no music |

## Core asks
- `chip.sequencer.detune(voice, cents)` (design §4.7): not in the frozen API. M2 does without (see M2 row).

## Budget
(added at M4)

## Layout
`logic/` pure sim (Node-tested), `render/` drawing only, `content/` JSON defs + `schemas.ts` + `load.ts` (loads through core), `tests/` vitest, `agent-tests/smoke.mjs` browser smoke (needs `npm run dev`).

## Decisions
- Brains are data (`content/brains.json`): named states with `ms` and `next`; built-in kinds idle wander chase strafe shoot flee burst split. `split` also runs on death for defs with `splitInto`.
- Chasers follow a flow field (walking distance from the player, refreshed every 100 ms) when they have no line of sight, so they path round walls and through doors.
- Rig editing is on `;` (the `y` action) because core owns Start/Select for its pause menu.
