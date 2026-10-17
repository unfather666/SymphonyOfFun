# Handoff

One section per area. Update your own section in each milestone commit (BUILD-PLAN §10).

## Core (S0) — done 2026-10-17
- State: scaffold, core, launcher, three stub games, CI (`check.yml`), manual `web.yml` / `desktop.yml`, CODEOWNERS, arch scans, folder guard. `src/core/api/**` is now frozen (changes by a separate small PR the coordinator reviews).
- Check: `npm run check`. Browser smoke: `agent-tests/launcher-smoke.mjs` (needs `playwright-core` outside the repo; see its header).
- Decisions taken in S0 are listed in the S0 PR description and in `docs/ARCHITECTURE.md`.
- Not yet done: `desktop.yml` has never run (S2, when Un asks); 4x-throttle budget row for the launcher (S2).

## Shooter
- State: M0 merged (one lit room). M1 in review: rig (60 items in 20 sets as JSON, `resolveRig` with 13 exact fixtures, up to 6 slots x 3 presets, rig menu on `;`, elite drops, progress save v1 with points).
- Next: M2 light and madness (light script, madness meter T1-T5, whisperer/eye/dreamer, ghosts, music warp).
- Check: `npm run check`; browser: `npm run dev` then `PW=$(npm root -g)/playwright node games/shooter/agent-tests/smoke.mjs`.
- Dev cheats (dev build console): `sof.cheat('give_all')`, `sof.cheat('slots6')`.
- Decisions: see `games/shooter/README.md` and PR descriptions. Core ask: sequencer detune.

## Racer
- State (M0 done, 2026-10-17): car, pooled road, HUD, beat clock hooked to core `chip:beat`; Three view in `games/racer/render/three/`. Layout and decisions in `games/racer/README.md`.
- Check: `npm run check`. Browser smoke + budget numbers: `agent-tests/racer-smoke.mjs` (needs `playwright-core` outside the repo; header has the command).
- Next: M1 (all 11 segment kinds, generator hash fixture, curves/hills/ramps/gaps), M2 music assembler, M3 hazards/death/pieces/power-ups, M4 10 levels/polish.

## Mr Fart (M0 done 2026-10-17)
- State: M0 shipped (`mrfart-m0`): physics behind `PhysicsApi` (Rapier + null stand-in, contract tests on both), sim in `logic/`, placeholder render, 33 game tests.
- Next: M1 Society (stress, clench, witnesses, intolerance, midnight settlement, reputation bar, people reactions). Branch `mrfart-m1` from main, one PR per milestone.
- Check: `npm run check`. Visual smoke: see README; `?game=mrfart&seed=1`.
- Decisions: fart `force` in rules is a velocity change (px/s) at forceScale 4; pieces are cheap pool particles, not Rapier bodies; people/props get bodies only near the player from M3 (ledger).
