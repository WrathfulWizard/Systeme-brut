# Ashbound

A top-down **2.5D pixel-art soulslike** for **macOS and Windows** — a desktop
program (Electron + Phaser 3 + TypeScript), not a website.

Tone and combat lineage: *Dark Souls / Elden Ring* (stamina economy,
committed attacks, dodge i-frames, lock-on), *Blasphemous* (grim penitent
aesthetic), *Moonlighter* (clean top-down ¾ pixel art with depth sorting).

## Run it

```bash
cd ashbound
npm install
npm start        # builds, then launches the desktop app
```

> First run downloads Electron (~persistent native binary). After that,
> `npm start` is instant.

## Controls

| Action            | Keys                    |
| ----------------- | ----------------------- |
| Move              | `WASD` / arrow keys     |
| Attack            | `J` or **left mouse**   |
| Dodge roll        | `SPACE` (i-frames)      |
| Lock on / off     | `TAB` or **right mouse**|
| Rest at the ember | `E` (when near it)      |

## What's in this vertical slice

- **Soulslike combat loop** — a stamina bar gates attacks and dodges; attacks
  are *committed* (wind-up → active → recovery, no instant cancel); the dodge
  roll has invulnerability frames early in the animation.
- **Lock-on** — strafe combat around the nearest Hollow; the Penitent always
  faces a locked target.
- **Telegraphed enemy AI** — Hollows idle, aggro, chase, then **wind up a slow,
  readable, punishable strike** (the magenta ring is the "incoming" flag).
- **2.5D depth** — every entity and prop is Y-sorted and casts a soft ground
  shadow, so things overlap correctly on the ground plane.
- **Bonfire loop** — die and respawn at the ember; resting there heals you and
  resurrects the Hollows, Souls-style.
- **All art is generated in code** (`src/art/`) — crisp baked pixel textures,
  zero external asset files, so it runs anywhere.

## Architecture

```
electron/        Desktop shell (main + preload). Owns the window only.
src/
  main.ts        Phaser bootstrap (pixel-perfect, RESIZE scale).
  config.ts      All combat/AI tuning in one place.
  art/           Pixel-art mini-DSL + sprite definitions, baked to textures.
  systems/       Input (edge-detected), shared HUD state.
  entities/      Player (the Penitent), Enemy (the Hollow) — state machines.
  scenes/        Boot (bake art) → Game (world) + UI (HUD overlay).
scripts/         Static smoke test + static-file copy.
```

## Verify

```bash
npm run typecheck      # strict TS, no errors
npm run smoke          # static: build artifacts wired correctly
npm run smoke:runtime  # boots the real renderer headlessly and checks for throws
                       # (on headless Linux: prefix with `xvfb-run -a`)
```

## Package distributables

```bash
npm run dist:mac   # → release/Ashbound-*.dmg   (run on macOS)
npm run dist:win   # → release/Ashbound Setup *.exe (run on Windows)
```

## Roadmap (next slices)

- Replace baked placeholder sprites with authored sheets (the baker stays —
  just swap the grids, or load real PNG atlases).
- Estus/flask healing, weapon move-sets & poise, parry/riposte.
- Multiple enemy archetypes + a first boss with phases.
- Hand-built tilemap levels (Tiled) with rooms, fog walls, and the ember network.
- Save files via the existing preload IPC bridge.
