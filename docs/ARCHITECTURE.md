# Architecture

One web app (Vite + TypeScript). `src/main.ts` boots core, core shows the launcher, the launcher opens a game from `games/index.ts`. Games see only `src/core/api` (types, constants, `CoreContext`).

## Core modules (`src/core/`)

| Module | One line |
|---|---|
| `api/` | The frozen contract: `GameModule`, `GameInstance`, `CoreContext` and every type a game uses. The only import path for games. |
| `loop/` | `createClock` (game ms = steps × 1000/60) and `createFixedLoop` (60 Hz accumulator, cap 5 steps per frame, alpha). |
| `events/` | Typed queued `EventBus`: flushed once per step, emits from handlers wait a flush, cap 4096 (drop new), optional merge key, payloads ids/numbers only. |
| `random/` | mulberry32 `SeededStream` (float/int/range/chance/pick, get/setState) and FNV-1a; one stream per name, derived from the run seed. |
| `input/` | Actions not keys. `state.ts` latches per step (a tap between steps still counts once); `dom.ts` binds keyboard, gamepad and the touch overlay; `bindings.ts` default keys and remap. |
| `display/` | Two stacked 384x216 canvases (GL below for Three, 2D above), integer CSS scale. |
| `gfx2d/` | Palette (32 colours), 5x7 font as data, sprite sheets from strings, tilemap draw, darkness mask (light/cone), shake/flash/fade on the game clock. |
| `chip/` | WebAudio chip voices (pulse A/B, triangle, noise, FM), 8 core sfx, recipe registry, Sequencer (beats on the game clock, audio scheduled 120 ms ahead), demo song. |
| `saves/` | `SaveStore`: envelope with checksum, per-section versions and migrations, bad saves kept as `<slot>:bad`, too-new refused; localStorage with memory fallback. |
| `content/` | `loadRegistry`: JSON defs validated against a schema, one-parent `extends`, frozen, byId/byTag, broken defs dropped with plain messages; `strings.json` lookup. |
| `ui/` | Modal menu and text box (pause the game's update while open), notice toast. |
| `launcher/` | Title, game cards, options (volume, scale, reduced fx, key remap), credits, crash screen. |
| `dev/` | Logger (warn once per key) and the F3 readout (fps, step ms avg/worst, draw ms). `window.sof` in dev builds: `cheat(id)`, `stats()`, `state()`. |
| `faults/` | Crash guard: 3 failed updates (or draws) in a row → shutdown → launcher crash screen. |
| `runtime.ts` | Wires the above: frame loop, pause menu (start/select), hidden tab → pause, per-game context. |

## Per step
`input.latch()` → (modal ui open? `ui.update()`) else `clock.advance()` → `sequencer.tick()` (queues `chip:beat`) → `game.update(1000/60)` → `events.flush()`.
Per frame: `gfx.beginFrame()` (shake) → `game.draw(alpha)` → `gfx.endFrame()` (flash, fade) → ui → touch overlay → F3 readout.

## Notes for game threads
- Songs: `Pattern` = one entry per 16th step, `0` rest, `-1` hold, else MIDI note; drums use 1 kick, 2 snare, 3 hat, 4 open hat, 5 tom. `chip:beat` fires every 16th step with `{bar, beat, step16, step}`.
- Your own sfx: `ctx.chip.defineSfx('fart_squeaky', { layers: [...] })` in `init()`.
- Your own events: declare names in `games/<id>/content/events.json` as `<id>:<verb>`; the scan test checks every `emit` against it.
- Content: `ctx.content.load('enemy', import.meta.glob('./content/enemies/*.json', { eager: true }), schema)`.
- Three.js: `new WebGLRenderer({ canvas: ctx.display.glCanvas })`, size 384x216, inside `games/racer/render/three/` only.
- Rapier: `import RAPIER from '@dimforge/rapier2d-compat'; await RAPIER.init()` in `init()`, inside `games/mrfart/physics/rapier/` only.

## Enforcing tests (`tests/arch/arch.test.ts` unless noted)
| Rule | Test |
|---|---|
| §2 confinement, exact pins | `confinement` |
| §0 boundaries | `boundaries` (core only via api, no cross-game imports, pure `logic/`) |
| §10 one game folder per PR | `scripts/guard-folders.mjs` in `npm run check`; logic tested in `cross-folder guard` |
| 1 fixed step | `tests/core/loop.test.ts` |
| 2, 3 no wall clock / Math.random / timers in games | `determinism` scan; `tests/core/random.test.ts` |
| 5 ids, validation, extends, read-only | `content` scan; `tests/core/content.test.ts` |
| 9 events queued, ids/numbers payloads, declared names | `events` scan; `tests/core/events.test.ts` |
| 10 fail safe | `tests/core/misc.test.ts` crash guard; loader drop tests; `agent-tests/launcher-smoke.mjs` (`?crash=1`) |
| 11 text in strings.json | `content` scan (strings.json present); string lookup test |
| 13 file size | `file size` (400-line hard cap, aim 300) |
| 4, 6, 7, 8, 12, 14, 15 | Review only: these are about design choices (state machines, pools, indexing, test quality, measuring, CI hygiene) that a scan cannot judge reliably. Games add pool and determinism tests per BUILD-PLAN §8. |
