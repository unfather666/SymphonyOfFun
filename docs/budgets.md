# Budgets

Measured with the F3 readout, Chromium DevTools CPU throttle 4x unless noted. Append-only rows; one per milestone (BUILD-PLAN §7, §9).

| Date | Area | Scene | Step avg / worst (ms) | Draw avg (ms) | FPS | Notes |
|---|---|---|---|---|---|---|
| 2026-10-17 | S0 launcher | games screen, demo song | n/a (launcher has no sim) | not measured | 60 | Headless Chromium, no throttle (agent-tests/launcher-smoke.mjs); 4x-throttle row comes with S2 device rows |
| 2026-10-17 | shooter M0 | test_room, 4-5 enemies, firing | 0.18 / 3.10 | not measured | 55 | Headless Chromium, NO throttle (games/shooter/agent-tests/smoke.mjs); 4x row at M4 |
| 2026-10-17 | racer M0 | level 1 desert, 8 s driving | 0.09 / 3.1 | 2.1 | 45 | Headless Chromium + SwiftShader software GL, CPU throttle 4x; 21 draw calls, 3.5k triangles. FPS is limited by software GL compositing in this environment; step and draw ms are the figures to trust. Unthrottled: step 0.03 / 0.7, draw 0.6, 57 fps |
| 2026-10-17 | racer M1 | level 7 canyon, autopilot 130 s (6.7 km) | 0.02 / 2.2 (unthrottled) | 0.52 | 58 | Headless Chromium + software GL, no CPU throttle; 21 draw calls, 3.7k triangles; no deaths, no console errors. Throttled run at M1 not repeated (M0 row has the 4x figure) |
| 2026-10-17 | mrfart M0 | street block, 5 people, 10 props, player running | 0.8 / 2.4 | 2.9 | 60 | Headless Chromium, CDP 4x CPU throttle, unthrottled avg 0.22 ms |
| 2026-10-17 | shooter M1 | test_room, rig menu, firing | 0.16 / 1.50 | not measured | 60 | Headless Chromium, NO throttle; 4x row at M4 |
| 2026-10-17 | mrfart M1 | street block, 5 people, 10 props, player running | 1.1 / 4.4 | 3.5 | 59 | Headless Chromium, CDP 4x CPU throttle; worst step is a single spike (first frames), avg is the figure to trust |
