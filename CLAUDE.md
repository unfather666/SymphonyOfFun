# Symphony of Fun — rules for every session

Copied verbatim from the build plan (BUILD-PLAN §0 and §5). Section numbers refer to that plan; the parts a game thread needs are summarised in `docs/ARCHITECTURE.md`.

Commands: `npm run dev` (launcher at localhost:5173, `?game=<id>&seed=N` skips it), `npm run check` (typecheck + tests + build + folder guard; run before every push).

## 0 Read me first (you are a game thread)

- You own exactly one folder: `games/<yourgame>/`. Everything you build lives there: code, JSON content, tests, `README.md`.
- You never edit `src/core/**`, `src/main.ts`, `games/index.ts`, `package.json`, `.github/**`, `tsconfig*.json`, `vite.config.ts`, or another game's folder. If the core lacks something you need, do without it or write a local helper inside your folder, and put one line in your `README.md` under "Core asks". The coordinator decides whether core changes (Un delegated).
- Core is used only through `CoreContext` (§4). Import from `src/core/api` only. Nothing else in core is yours to import.
- Build the milestones in your design in order, M0 → M4. One PR per milestone. Each milestone has a "done when" list; a PR is ready when its list is true and `npm run check` is green locally.
- Keep it simple. Plain objects, plain functions, JSON data. No class trees, no singletons, no ECS, no extra npm packages (§2 lists the only allowed libraries).
- Everything drawn is code-drawn or pixel art written as data in your folder. No downloaded assets. If you must add a file that is not yours (a font, a sprite), do not; use code-drawn placeholders instead (decision §12 item 8).

## 5 Rules every PR obeys (distilled from the master guide)

1. Fixed step 60 Hz, cap 5 steps per frame, draw interpolates with `alpha`. No variable step, ever.
2. Sim reads `ctx.clock` and `ctx.random` only. `Math.random`, `Date.now`, `performance.now` in `games/**` fail the scan test (dev readout excepted, in core).
3. Timers are timestamps on the game clock compared on read, not counters, unless the thing counts steps by nature (animation frame index, work units per step).
4. Data, logic, display apart: `logic/` pure and Node-tested, `render/` never mutates, `index.ts` wires. New kind of thing = new JSON def, not a new `if`.
5. Kinds are data keyed by stable ids `^[a-z0-9_]+$`, one-parent `extends`, read-only after load, never derived from display names. Validation at load refuses unknown keys and out-of-range numbers; a broken def is dropped with a plain-English message, the game still starts.
6. Every state change through one door (a function), undo by restoring saved state. Anything that waits is an explicit state machine (`enter/update/exit`).
7. No garbage in the step: pools for bullets, pieces, particles, bodies; no `filter/map/spread/closures/template strings` inside `update`. Preallocate scratch vectors.
8. Scale by indexing (grid or id map), never by scanning every entity for every entity per step.
9. Events only between things that should not know each other; calls inside a feature. Never emit from inside a handler (queue). Payloads are ids and numbers, never live objects.
10. Fail safe: catch at the game boundary (core does), validate at load, log once, keep going with the part switched off.
11. Nothing player-facing hardcoded: text in `strings.json`, caps in `content/rules.json`, per-step buffer sizes as named constants with a stated full policy (skip / replace oldest / merge).
12. Tests: each must be able to fail; assert exact values; no wall clock (`setTimeout`) in sim tests; a bug fix ships with the test that failed; never skip or loosen a test to get green.
13. One job per file, about 300 lines; split by reason to change.
14. Measure before optimising; degrade by live counts (fewer particles/pieces), never by changing step time.
15. Never disable, skip or cancel CI. A push is a spend: run `npm run check` locally first, one push per checkpoint.
