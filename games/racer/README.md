# Racer (`games/racer/`)

Owned by the racer game thread (BUILD-PLAN §0, §10).

Run: `npm run dev`, then open `/?game=racer&seed=1` (add `&level=1..10`). Keys: J accelerate (tap on the beat for a speed bonus), K brake, arrows/WASD steer, `;` jump on ramps, L use the held power-up, Enter pause. On the end screen: J or Enter runs it again, K returns to the launcher.

Dev-only params: `&bot=1` autopilot, `&at=<beat or kind id>&freeze=1` jump to a segment and hold the frame, `&calamity=<id>` end the run with that calamity after 1.5 s. `globalThis.sofRacer.info()` is the readout used by `agent-tests/racer-smoke.mjs`.

## Layout
- `logic/` pure, Node-tested. `sim` (create, one step, hash), `phases` (RUN, DYING, FINISHED, OVER as enter/update/exit), `simtypes` (state shape), `car`, `interact` (hits, pickups, dodge settling), `hazards` (placement and moving state), `breakage`, `powerups`, `calamity`, `score`, `fx` (effect-code queue), `pieces` (pooled struct-of-arrays), `trackgen` + `track` (segment ring, section snapshots), `songgen` (assembler), `level`, `rng`, `bot`.
- `content/` JSON defs: `rules`, `segments`, `themes`, `levels`, `props`, `vehicles`, `hazards`, `powerups`, `calamities`, `patterns`, `strings.json`. `content.ts` loads them through the core loader; `schemas.ts` holds the field specs.
- `render/three/` is the only place that imports `three`: `renderer`, `scene`, `camera` (chase and death cameras), `segmentMesh`, `worldObjects` (hazards and pickups, one rebuilt geometry), `pieces` (instanced debris and smoke), `geo`. `render/hud.ts` draws on the core 2D canvas.
- `index.ts` wires; `fxplay.ts` turns the sim's effect codes into core sound and screen effects.

## Decisions
- Flat colours baked into vertex colours (no lights); fog and a 384x216 backing canvas.
- Segment length = cruise speed × beat period, so at cruise the car crosses one segment per beat.
- `lane` is in road half-widths: ±1 is the road edge, ±1.3 the end of the shoulder. Hazards sit on one of three lane centres (±2/3, 0).
- Beat edge for the HUD, FOV pulse and sync window = `chip:beat` time + `audioLatencyMs`.
- Hazards and pickups use their own random stream (salt 2) so the road generator hash fixture does not change when they are tuned.
- Pools: debris `piecesCap` (reduced effects: 128), smoke `smokeCap` (64). Full policy: skip the new piece and count it (`pool.skipped`). Effects queue holds 32 codes; full policy: drop the new code.
- Moving hazards (sweepers, periodic windows) are functions of the game clock, so the sim state stays small and deterministic.

## Core asks
(none)

## Budget
Row added to `docs/budgets.md` each milestone.
