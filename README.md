# Systeme Brut

An un-gamified biological command center for competitive bodybuilding and
longevity. One ecosystem across three nodes — **training**, **pharmacology**,
and **nutrition/telemetry** — with a Synthesizer (**SB-Σ**) that cross-references
all three and surfaces what's worth noticing rather than just logging what
happened.

Start with **[`docs/HANDOFF.md`](docs/HANDOFF.md)**.

## Surfaces

| Code      | Surface              | Status        | Stack                                       |
| --------- | -------------------- | ------------- | ------------------------------------------- |
| **SB-00** | Master hub (desktop) | **building**  | Electron + Next.js + SQLite; Supabase-bound |
| **SB-01** | Mobile module        | paused        | React Native + Expo, Android-only APK       |
| **SB-02** | Wrist module         | not started   | Xiaomi Smart Band 10 watchface, BPM-led     |
| **SB-Σ**  | The Synthesizer      | cross-cutting | `insights` + `estimated_serum_levels`       |

SB-00 ships as a **standalone desktop program** with automatic ingestion from
**Strava** (real API), **Apple Health** (phone bridge → local receiver), and
**Cronometer** (Apple Health pipeline + an opt-in unofficial scraper). See
[`sb-00/README.md`](sb-00/README.md) for the connection setup.

Build order is deliberate: **SB-00 first** — it's a web app with no platform
fight and is genuinely usable on its own once data flows in. See the handoff for
why SB-01 is paused.

## Repository layout

```
docs/                       Architecture v2, closed IA, the handoff brief, mockups
  systeme-brut-architecture-v2.md
  systeme-brut-ia-closed.md
  HANDOFF.md
  mockups/                  Visual references (spec, not shippable CSS)
supabase/
  migrations/               The v2 schema, by node
  seed.sql                  Mockup numbers, so SB-00 renders before ingestion is wired
sb-00/                      The master hub — Next.js app (PRIMARY build)
sb-02-watchface/            Wrist module — separate hardware problem, own README
```

## SB-00 — the hub

```bash
cd sb-00
npm install
npm run rebuild:native   # better-sqlite3 for Electron's ABI (once)
npm run desktop          # build + launch the standalone app
```

Seven screens, mirroring the closed IA: **Overview**, **Lifts**, **Cardio**,
**Pharmacology**, **Nutrition**, **Flags (SB-Σ, by node)**, and **Connections**
(link Strava / Cronometer / Apple Health). The Electron backend keeps a local
**SQLite** store (seeded from the mockup numbers so the hub is populated on
first run) that the ingestion services write and the UI reads over IPC. SQLite
mirrors the v2 schema; the Supabase Postgres project remains the schema source
of truth, and `supabase/migrations/` is what a server-side deployment runs.

### Design system

Translated from the mockups' `:root` spec into `sb-00/app/globals.css` — not
copied markup. The rules that matter:

- **One flag colour.** Magenta (`#e0157a`) means *flag* and nothing else.
  Everything else is flat and quiet on purpose.
- **ASCII matrices are real monospace text** (`lib/ascii.ts` builds the `█`/`░`
  bars), never a chart library dressed up to look like ASCII.
- **Corner coordinate marks** on every frame; Inter / Archivo Narrow / Roboto
  Mono type pairing.
- The **serum "visual readout"** is the one maximalist moment — a glossy WebGL
  liquid (`components/SerumLiquidRender.tsx`) standing in for the estimated
  serum numbers in the ASCII matrix beneath it. It degrades to a static fallback
  where WebGL is unavailable.

## Backend (Supabase)

The v2 schema lives in `supabase/migrations/`, split by node:

- `0001_node_a_iron_and_asphalt.sql` — training + cardio + goals + PR views
- `0002_node_b_pharmacology.sql` — regimen, bloodwork, titration (no cycles)
- `0003_node_c_nutrition_telemetry.sql` — nutrition, micronutrients, telemetry
- `0004_synthesizer.sql` — insights, cross-node classification, serum estimate

Ingestion is webhook-based via Edge Functions: **Strava** (real API),
**Apple Health** (sanctioned bridge app), and **Cronometer** rides the Apple
Health pipeline rather than a fragile scraper. See the architecture doc for the
detail.
