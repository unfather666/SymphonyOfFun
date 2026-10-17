# Tempo Road (`games/racer/`)

3D low-poly chiptune racer. Owned by the racer game thread (BUILD-PLAN §0, §10). Design: `plan/DESIGN-racer.md`.

Run: `npm run dev`, then open `/?game=racer&seed=1` (add `&level=1..10`). Keys: J accelerate (tap on the beat for a speed bonus), K brake, arrows/WASD steer, `;` jump on ramps, L use a power-up, Enter pause.

## Layout
- `logic/` pure, Node-tested: `rng` (hash-seeded streams), `trackgen` + `track` (segment ring, section snapshots, poses), `car`, `sim` (one step function, phases, beat sync, respawn), `level` (bars, segment length, intensity).
- `content/` JSON defs: `rules`, `segments` (11 kinds), `themes` (10), `levels` (10), `props`, `vehicles`, `strings.json`.
- `render/three/` the only place that imports `three`: `renderer`, `scene` (chase camera, pooled segment meshes), `segmentMesh` (road, props, dressing), `geo` (flat-shaded box/quad builder). `render/hud.ts` draws the HUD on the core 2D canvas.
- `schemas.ts` field specs for the core loader. `index.ts` wires everything.

## Decisions
- Flat colours baked into vertex colours (no lights): cheaper than the design's directional light and the same look. Fog and 384x216 backing canvas (core scales it with nearest filter) replace the separate render target.
- Segment length = cruise speed × beat period (`cruiseFrac` 0.8 × max speed): at cruise the car crosses one segment per beat, so beat lines on the road land on the beat. At 120 bpm that is 12 m.
- `lane` is in road half-widths: ±1 is the road edge, ±1.3 the end of the shoulder. Drop-off segments (`narrow`) and `gap` are deadly past that / when not airborne.
- Beat edge for the HUD, FOV pulse and sync window = `chip:beat` time + `audioLatencyMs` (40, the sequencer's audio trail).

## Status
| Milestone | What works | How to see it | Known gaps |
|---|---|---|---|
| M0 car on a beat | Pooled endless road, car accelerates/steers/brakes, demo song, beat marker, FOV pulse, sync bonus, HUD, 22 draw calls | `?game=racer&seed=1` | Straights only, no hazards, demo song |
| M1 road to the beat | All 11 segment kinds drive and draw: curves, hills, ramps, gaps (jump with `;`), narrow bridges (fall off the edge), split barrier, wide road, tunnels; landing room after every gap; fall = death, respawn at section start; generator hash fixture; autopilot completes all 10 levels in tests | `?game=racer&seed=1&level=7`; dev params `&bot=1` (autopilot), `&at=<beat or kind id>&freeze=1` (jump to a segment and hold the frame) | No hazards yet; song is still the launcher demo song; death is a plain 2.5 s pause (calamities come in M3) |

## Core asks
(none)

## Budget
Row added to `docs/budgets.md` each milestone.
