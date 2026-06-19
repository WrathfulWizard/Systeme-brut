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

See [`LORE.md`](LORE.md) for the full world bible.

## Controls

| Action              | Keys                     |
| ------------------- | ------------------------ |
| Move                | `WASD` / arrow keys      |
| Attack              | `J` or **left mouse**    |
| Dodge roll          | `SPACE` (i-frames)       |
| Lock on / off       | `TAB` or **right mouse** |
| Drink estus (heal)  | `Q`                      |
| Tend ember / select | `E`                      |
| Menu navigate       | `W` / `S`                |

## What's in the build

**An open world of five hand-tuned regions** — Ashen Barrows, The Mireheart,
Emberreach Highlands, The Palewood, and the boss fortress of the Cinderhold —
laid out as one seamless map with noise-warped borders and chokepoints. Each
region has its own palette, ground art, props, ambient colour-grade and enemy,
announced by an **Elden-Ring-style title card** as you cross into it.

- **Soulslike combat** — stamina-gated, *committed* attacks (wind-up → active →
  recovery); dodge roll with i-frames; lock-on strafe combat.
- **Three enemy archetypes** — the patient Hollow, the swarming Mireling, the
  heavy Emberknight — each with telegraphed, punishable strikes.
- **A boss** — the **Cinder Lord**, sealed behind a fog gate, with telegraphed
  overhead slams and a faster second phase at half health.
- **RPG progression** — enemies drop **runes**; spend them at an ember to
  *reinforce* (level up). Die and your runes spill as a recoverable bloodstain —
  reclaim them or lose them on a second death.
- **Estus flasks** — limited heals, refilled only by tending an ember.
- **Hazards** — lava in the Highlands burns through your guard.
- **Save/continue** — runes, level and last ember persist between runs.
- **2.5D depth** — everything Y-sorted with soft shadows and additive lighting.
- **Atmosphere & juice** — a title screen, drifting ash, bonfire embers, a
  cinematic vignette, hit sparks, floating damage numbers, attack lunge and
  hit-stop.
- **Procedural audio** (`src/systems/audio.ts`) — every sound is synthesised at
  runtime via Web Audio: sword swings, hits, dodges, estus, a low ambient drone
  that tenses for the boss fight. Zero audio files, like the art.
- **100% generated content** (`src/art/`) — characters, a full biome tileset,
  props, the boss, and all sound are produced in code. Zero external asset files.

## Architecture

```
electron/        Desktop shell (main + preload). Owns the window; headless smoke.
src/
  main.ts        Phaser bootstrap (pixel-perfect, RESIZE scale).
  config.ts      Combat / AI tuning.
  art/
    pixelart.ts  Texture bakers (grid + direct-canvas).
    sprites.ts   Hand-authored character grids (Penitent, Hollow, Mireling).
    gen.ts       Procedural tileset, props, boss generators.
    util.ts      Seeded RNG, value-noise, colour math.
  world/
    biomes.ts    The five regions: palette, props, enemy, lore.
    worldgen.ts  Voronoi zones, terrain, props, bonfires, spawns, boss arena.
  systems/       Input (edge-detected), shared HUD state.
  entities/      Player, Enemy (archetypes), Boss — state machines.
  scenes/        Boot (bake art) → Game (world) + UI (HUD overlay).
scripts/         Static smoke test + static-file copy.
```

## Verify (headless)

The Electron shell has a smoke mode that boots the *real* renderer under a
virtual display, drives synthetic input through combat and the bonfire menu,
and fails on any thrown error:

```bash
ASHBOUND_SMOKE=1 xvfb-run -a electron . --no-sandbox          # boot + input
ASHBOUND_SHOT=out.png ASHBOUND_SMOKE=1 xvfb-run -a electron . --no-sandbox  # + screenshot
```

And the static checks:

```bash
npm run typecheck      # strict TS, no errors
npm run smoke          # static: build artifacts wired correctly
```

## Package distributables

```bash
npm run dist:mac   # → release/Ashbound-*.dmg   (run on macOS)
npm run dist:win   # → release/Ashbound Setup *.exe (run on Windows)
```

## Roadmap (next slices)

- **Art depth** — more walk/attack frames and 4-direction sprites; authored
  sheets can drop straight into the baker (swap grids or load PNG atlases).
- **Combat** — weapon move-sets, poise/stagger, parry & riposte, ranged foes.
- **More bosses** — one regional boss per zone, each gating a reward.
- **World** — interiors (the Cinderhold proper), an ember fast-travel network,
  NPCs with branching dialogue, and findable items/keys.
- **Audio** — ambient beds per region + combat SFX.
- **Map/menus** — pause screen, equipment, a world map.
