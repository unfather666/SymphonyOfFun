# Handoff

One section per area. Update your own section in each milestone commit (BUILD-PLAN §10).

## Core (S0) — done 2026-10-17
- State: scaffold, core, launcher, three stub games, CI (`check.yml`), manual `web.yml` / `desktop.yml`, CODEOWNERS, arch scans, folder guard. `src/core/api/**` is now frozen (changes by a separate small PR the coordinator reviews).
- Check: `npm run check`. Browser smoke: `agent-tests/launcher-smoke.mjs` (needs `playwright-core` outside the repo; see its header).
- Decisions taken in S0 are listed in the S0 PR description and in `docs/ARCHITECTURE.md`.
- Not yet done: `desktop.yml` has never run (S2, when Un asks); 4x-throttle budget row for the launcher (S2).

## Shooter
- State: M0 merged. M1 (PR #6) in review, M2 built on top of it (branch `shooter-m2`): rig (60 items in 20 sets as JSON, `resolveRig` with 13 exact fixtures, up to 6 slots x 3 presets, rig menu on `;`, elite drops, progress save v1 with points).
- M2: light script (`logic/lightscript.ts`), madness (`logic/madness.ts`, effects in `render/madnessFx.ts`, ghosts in `logic/fx.ts`), whisperer/eye/dreamer, 11 songs, `musicControl.ts` warps playback from madness 2.
- Next: M3 100 levels (generator, tiers, bosses, unlock table, save v2, level select).
- Check: `npm run check`; browser: `npm run dev` then `PW=$(npm root -g)/playwright node games/shooter/agent-tests/smoke.mjs`.
- Dev cheats (dev build console): `sof.cheat('give_all')`, `sof.cheat('slots6')`, `sof.cheat('madness3')`, `sof.cheat('madness')`.
- Decisions: see `games/shooter/README.md` and PR descriptions. Core ask: sequencer detune.

## Racer
- State (M2 done, 2026-10-17; M1 before it): car, all 11 road kinds generated and drawn, HUD, beat clock hooked to core `chip:beat`, autopilot (`logic/bot.ts`); Three view in `games/racer/render/three/`. Layout and decisions in `games/racer/README.md`. Regenerate the generator hash fixture with `UPDATE_FIXTURES=1 npx vitest run games/racer/tests/trackgen.test.ts` only when a generator change is intended.
- Check: `npm run check`. Browser smoke + budget numbers: `agent-tests/racer-smoke.mjs` (needs `playwright-core` outside the repo; header has the command).
- Music: patterns are authored as data in `games/racer/content/patterns/*.json` (all in C; major and minor patterns share one chord progression each so genres mix). The generator script is not in the repo; add patterns by hand in the same format (see `songgen.ts` PatternDef) or ask for the script. Next: M3 hazards/death/pieces/power-ups, M4 10 levels/polish.

## Mr Fart (M2 done 2026-10-17)
- State: M0 (#2) physics + sim, M1 (#5) society/reputation merged. M2 (`mrfart-m2`): job generator + board, pipeline (verbs grab/carry/place/press/escort), 6 job types, subjects T0-T1, leash, rewards; 74 game tests.
- Next: M3 Absurdity (all 20 job types, T2-T4 subjects, counts/modifiers, items + cursed items with sound key/pitch, endings via `?ending=<id>`, full 6x4 map, 60 people, pacing table). Branch `mrfart-m3` from main.
- Adding a job type = a JSON def in `content/job_types/` (steps use verbs in `logic/verbs.ts`); a subject = JSON in `content/subjects/`; strings for each in `strings.json` (content test enforces).
- Check: `npm run check`. Visual smoke: see README; `?game=mrfart&seed=1`.
- Decisions: fart `force` in rules is a velocity change (px/s) at forceScale 4; pieces are cheap pool particles, not Rapier bodies; people/props get bodies only near the player from M3 (ledger).
