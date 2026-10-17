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
(owned by the racer thread)

## Mr Fart
(owned by the mrfart thread)
