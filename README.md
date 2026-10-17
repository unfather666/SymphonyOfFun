# Symphony of Fun

Three retro games, one launcher: **Deep Signal** (top-down shooter), **Tempo Road** (beat-synced 3D racer) and **Mr Fart** (reputation physics comedy).

```
npm ci
npm run dev      # http://localhost:5173  (?game=shooter|racer|mrfart skips the launcher, ?seed=N fixes the seed)
npm run check    # typecheck + tests + build + one-game-folder guard
```

Controls: WASD/arrows move, J/K/L/; = A/B/X/Y, Q/E = L/R, Enter = start, Esc = pause. Gamepad and touch work too. F3 shows the dev readout.

Layout and rules: `docs/ARCHITECTURE.md`, `CLAUDE.md`. Licences: `LICENSES-LOG.md`.
