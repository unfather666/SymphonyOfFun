# Handoff

One section per area. Update your own section in each milestone commit (BUILD-PLAN §10).

## Core (S0) — done 2026-10-17
- State: scaffold, core, launcher, three stub games, CI (`check.yml`), manual `web.yml` / `desktop.yml`, CODEOWNERS, arch scans, folder guard. `src/core/api/**` is now frozen (changes by a separate small PR the coordinator reviews).
- Check: `npm run check`. Browser smoke: `agent-tests/launcher-smoke.mjs` (needs `playwright-core` outside the repo; see its header).
- Decisions taken in S0 are listed in the S0 PR description and in `docs/ARCHITECTURE.md`.
- Not yet done: `desktop.yml` has never run (S2, when Un asks); 4x-throttle budget row for the launcher (S2).

## Shooter
- State: M0 done (one lit room, player, cultist + deep one, waves, exit, restart). Branch `shooter-m0`.
- Next: M1 rig (60 items JSON, `resolveRig`, slot UI, presets saved) - 5 projectile kinds already exist in `logic/bullets.ts` and `logic/effects.ts`.
- Check: `npm run check`; browser: `npm run dev` then `PW=$(npm root -g)/playwright node games/shooter/agent-tests/smoke.mjs`.
- Decisions: see `games/shooter/README.md` "Decisions" and PR descriptions. Core ask: sequencer detune (README).

## Racer
- State (M0 done, 2026-10-17): car, pooled road, HUD, beat clock hooked to core `chip:beat`; Three view in `games/racer/render/three/`. Layout and decisions in `games/racer/README.md`.
- Check: `npm run check`. Browser smoke + budget numbers: `agent-tests/racer-smoke.mjs` (needs `playwright-core` outside the repo; header has the command).
- Next: M1 (all 11 segment kinds, generator hash fixture, curves/hills/ramps/gaps), M2 music assembler, M3 hazards/death/pieces/power-ups, M4 10 levels/polish.

## Mr Fart (M1 done 2026-10-17)
- State: M0 merged (#2): physics behind `PhysicsApi`, sim in `logic/`, placeholder render. M1 (`mrfart-m1`): stress, clench, witnesses, intolerance, midnight settlement, reputation, people reactions; 55 game tests.
- Next: M2 Jobs (6 job types, leash, subjects T0-T1, board UI, rewards, tier by tasksDone). Branch `mrfart-m2` from main, one PR per milestone.
- Check: `npm run check`. Visual smoke: see README; `?game=mrfart&seed=1`.
- Decisions: fart `force` in rules is a velocity change (px/s) at forceScale 4; pieces are cheap pool particles, not Rapier bodies; people/props get bodies only near the player from M3 (ledger).
