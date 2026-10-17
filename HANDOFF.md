# Handoff

One section per area. Update your own section in each milestone commit (BUILD-PLAN §10).

## Core (S0) — done 2026-10-17
- State: scaffold, core, launcher, three stub games, CI (`check.yml`), manual `web.yml` / `desktop.yml`, CODEOWNERS, arch scans, folder guard. `src/core/api/**` is now frozen (changes by a separate small PR the coordinator reviews).
- Check: `npm run check`. Browser smoke: `agent-tests/launcher-smoke.mjs` (needs `playwright-core` outside the repo; see its header).
- Decisions taken in S0 are listed in the S0 PR description and in `docs/ARCHITECTURE.md`.
- Not yet done: `desktop.yml` has never run (S2, when Un asks); 4x-throttle budget row for the launcher (S2).

## Shooter
(owned by the shooter thread)

## Racer
- State (M0 done, 2026-10-17): car, pooled road, HUD, beat clock hooked to core `chip:beat`; Three view in `games/racer/render/three/`. Layout and decisions in `games/racer/README.md`.
- Check: `npm run check`. Browser smoke + budget numbers: `agent-tests/racer-smoke.mjs` (needs `playwright-core` outside the repo; header has the command).
- Next: M1 (all 11 segment kinds, generator hash fixture, curves/hills/ramps/gaps), M2 music assembler, M3 hazards/death/pieces/power-ups, M4 10 levels/polish.

## Mr Fart
(owned by the mrfart thread)
