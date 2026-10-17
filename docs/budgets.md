# Budgets

Measured with the F3 readout, Chromium DevTools CPU throttle 4x unless noted. Append-only rows; one per milestone (BUILD-PLAN §7, §9).

| Date | Area | Scene | Step avg / worst (ms) | Draw avg (ms) | FPS | Notes |
|---|---|---|---|---|---|---|
| 2026-10-17 | S0 launcher | games screen, demo song | n/a (launcher has no sim) | not measured | 60 | Headless Chromium, no throttle (agent-tests/launcher-smoke.mjs); 4x-throttle row comes with S2 device rows |
| 2026-10-17 | shooter M0 | test_room, 4-5 enemies, firing | 0.18 / 3.10 | not measured | 55 | Headless Chromium, NO throttle (games/shooter/agent-tests/smoke.mjs); 4x row at M4 |
