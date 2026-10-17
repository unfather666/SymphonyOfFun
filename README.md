# Symphony of Fun

Three retro games, one launcher: **Deep Signal** (top-down shooter), **Tempo Road** (beat-synced 3D racer) and **Mr Fart** (reputation physics comedy). 

Fully DESIGNED and CODED by Claude, using a systems structure process I built. This is all to see if Claude can make stable game engines (it definitely can) and if it can make adequately fun games based on minimal instructions (it definitely can't). They are tests for all to prove the value of Claude Code in OCT2026, and you can see for yourself that they have potential at best, but they're not great. Nonetheless, we see for certain what Claude is capable of: a lot.

```
npm ci
npm run dev      # http://localhost:5173  (?game=shooter|racer|mrfart skips the launcher, ?seed=N fixes the seed)
npm run check    # typecheck + tests + build + one-game-folder guard
```

Controls: WASD/arrows move, J/K/L/; = A/B/X/Y, Q/E = L/R, Enter = start, Esc = pause. Gamepad and touch work too. F3 shows the dev readout.

Layout and rules: `docs/ARCHITECTURE.md`. Licences: `LICENSES-LOG.md`.
