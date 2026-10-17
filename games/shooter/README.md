# Deep Signal (`games/shooter/`)

Top-down sci-fi shooter, 384x216, darkness is the gameplay. Owned by the shooter game thread (BUILD-PLAN §0, §10).

Run: `npm run dev`, then open `/?game=shooter&seed=1`.

## Status
| Milestone | What works | How to see it | Known gaps |
|---|---|---|---|
| S0 stub | Title screen, demo song, Esc → pause → quit | `?game=shooter` | (replaced by M0) |
| M0 | One lit room (30x18 tiles, lantern cone, flickering lamp, glass, water), player walk/aim/fire/dash/flare, cultist (walks and shoots) and deep one (chases and lunges), two waves, exit opens when clear, death restarts the room, hit/kill sfx, flow-field pathing round walls | `?game=shooter&seed=1` (J fire, K dash, L flare, WASD move, arrows or mouse aim) | One room only, default Rivet bolt only, no music |
| M1 | 60 items / 20 sets / 3 kinds as JSON, `resolveRig` (cores alternate, mods fold, aux add effects), 6 slots x 3 presets (only slot 1 until level 10 unlocks more), rig menu (`;`), preset cycle (Q/E), elites drop unowned items, progress saved (points, items, presets), all 6 projectile kinds | `?game=shooter`, press `;`; dev console `sof.cheat('give_all')` and `sof.cheat('slots6')` | Slots 2-6 and set unlocks by points need levels (M3) | |
| M2 | Light script with four tricks (blackout, spotlight with waves arriving inside the circle, strobe, pulse with heartbeat), madness meter with tiers T1-T5 (tint and mask shiver, row tearing and whispers, ghosts, axis inversion with a warning flash, tunnel vision and x3 score), whisperer / eye (cone, back-hit kills) / dreamer (only visible under light), 11 songs with a warped half used from madness 2, combo and tier score multipliers | `?game=shooter&seed=1`; dev console `sof.cheat('madness3')` or `sof.cheat('madness')` | Light script is in the test room only until M3 levels; strobe and screen effects are off in reduced-fx |

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
