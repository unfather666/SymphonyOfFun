# Handoff

One section per area. Update your own section in each milestone commit (BUILD-PLAN §10).

## Core (S0) — done 2026-10-17
- State: scaffold, core, launcher, three stub games, CI (`check.yml`), manual `web.yml`, `desktop.yml` (Windows exe / macOS dmg / Linux AppImage to a GitHub Release: Run workflow = private draft, tick publish or push a `v*` tag = public), CODEOWNERS, arch scans, folder guard. `src/core/api/**` is now frozen (changes by a separate small PR the coordinator reviews).
- Check: `npm run check`. Browser smoke: `agent-tests/launcher-smoke.mjs` (needs `playwright-core` outside the repo; see its header).
- Decisions taken in S0 are listed in the S0 PR description and in `docs/ARCHITECTURE.md`.
- Not yet done: bundle Rust crate notices at release (LICENSES-LOG); 4x-throttle budget row for the launcher (S2).

## Shooter
- State: M0 to M4 merged; playable from the launcher. Madness warp runs through the core sequencer rate.
- Next: nothing planned; remaining ideas are balance tuning.
- Check: `npm run check`; browser: `npm run dev` then `PW=$(npm root -g)/playwright node games/shooter/agent-tests/smoke.mjs` (also `levels-smoke.mjs`, `playthrough.mjs`, `budget.mjs`).
- Dev cheats (dev console): `sof.cheat('points')`, `'god'`, `'give_all'`, `'slots6'`, `'madness3'`, `'madness'`, `'clear'`, `'stress'`.

## Racer
- State (M4 done, 2026-10-17): level list, saves, touch controls, 96 patterns and tutorial captions on top of sim phases, hazards/pickups/pools/calamities on top of the road and car, autopilot (`logic/bot.ts`) clears every level in tests; Three view in `games/racer/render/three/`. Layout and decisions in `games/racer/README.md`. Regenerate the generator hash fixture with `UPDATE_FIXTURES=1 npx vitest run games/racer/tests/trackgen.test.ts` only when a generator change is intended.
- Check: `npm run check`. Browser smoke + budget numbers: `agent-tests/racer-smoke.mjs` (needs `playwright-core` outside the repo; header has the command).
- Music: patterns are authored as data in `games/racer/content/patterns/*.json` (all in C; major and minor patterns share one chord progression each so genres mix). `games/racer/tools/genpatterns.py` writes all of them (usage in its header); or add patterns by hand in the same format (see `songgen.ts` PatternDef). Next: polish passes only.

## Mr Fart (M4 done 2026-10-17)
- State: M0 to M3 merged (#2, #5, #9, #12). M4 (`mrfart-m4`): sprite data, night tint, touch taps, reducedFx, save sections with a v1 fixture, 10-minute scripted playthrough, budget row. The game is complete; remaining work is polish only.
- Sprites are data; the generator script is not in the repo. To change a look, edit the JSON in `games/mrfart/content/sprites/` (frames are rows of chars, keys map chars to palette indices).
- Adding content: a JSON def in the matching `content/` folder plus strings in `strings.json`; the content tests enforce counts and strings.
- Check: `npm run check`. Visual smoke: `?game=mrfart&seed=1`.
