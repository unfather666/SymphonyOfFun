# Licences log

Third-party code and assets in the shipped app. No third-party art, fonts or sounds are used: palette, font, sprites, sfx and music are made in code for this project (BUILD-PLAN §12 item 8). Check this list before any release.

| Package | Version | Licence | Used for | Ships in app |
|---|---|---|---|---|
| three | 0.186.1 | MIT | Racer 3D rendering | yes |
| @dimforge/rapier2d-compat | 0.21.0 | Apache-2.0 | Mr Fart physics | yes |
| vite | 8.3.4 | MIT | Dev server and bundler | no (build tool) |
| vitest | 5.0.5 | MIT | Tests | no |
| typescript | 7.0.2 | Apache-2.0 | Type checking | no |
| @types/three, @types/node | 0.186.0, 22.20.5 | MIT | Types | no |
| @tauri-apps/cli | 2.12.3 (desktop.yml only) | MIT OR Apache-2.0 | Desktop build | no |
| tauri (Rust crate) | 2.x | MIT OR Apache-2.0 | Desktop wrapper | yes (desktop build); bundle its notices at release (S2) |
