# SB-00 — Master Hub (standalone desktop program)

The dense viewer for Systeme Brut, packaged as a **standalone Electron desktop
app** with automatic ingestion from **Strava**, **Cronometer**, and **Apple
Health**. The Next.js UI is static-exported and runs inside Electron; all live
data comes from the Electron backend over IPC — there is no dev server or
browser required at runtime.

```
┌──────────────────────── Electron app ────────────────────────┐
│  main process (Node)                                          │
│   • SQLite store (better-sqlite3)   • OS-encrypted secrets    │
│   • ingestion services + scheduler  • local HTTP receiver     │
│            │ IPC (window.sb)                                   │
│  renderer (static-exported Next.js UI) ── reads snapshots     │
└──────────────────────────────────────────────────────────────┘
        ▲ Strava API      ▲ Cronometer export    ▲ phone bridge → receiver
```

## Run it

```bash
npm install
npm run rebuild:native        # compile better-sqlite3 for Electron's ABI (once)

npm run desktop               # build UI + backend, launch the app
# or, live-reload the UI while developing:
npm run desktop:dev           # next dev + Electron pointed at it
```

Package installers (dmg / nsis / AppImage) for distribution:

```bash
npm run dist                  # → release/
```

The app also still builds as a plain static web bundle (`npm run build` → `out/`),
where it renders the seed data with connections disabled.

## Getting your own data in

Two ways, by node:

- **Training & Pharmacology — hand-logged.** Each screen has a `＋ Log …`
  button (Lifts: log a set; Pharmacology: log a dose, a titration change, or a
  lab panel). Entries write straight to the local SQLite store and the screen
  updates immediately. New exercises/compounds you type are remembered. Every
  logged row has `edit` / `del` controls — sets and doses open back in the form
  prefilled; titration entries and lab panels delete in place.
- **Cardio & Nutrition — synced.** These pull in automatically — runs from
  Strava, nutrition from Cronometer — so there's no manual entry on those
  screens. Link them on **Connections** (below).

The app ships seeded with demo numbers so it isn't empty on first launch; your
logged and synced entries accumulate alongside them.

## Data sources — how each one actually pulls

Open the **Connections** screen in the app to link them.

| Source           | Mechanism                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| **Strava**       | Real API. OAuth2 (loopback redirect), then runs are polled every 15 min.  |
| **Apple Health** | Push only — no cloud API. A phone bridge POSTs to the local receiver.     |
| **Cronometer**   | Unofficial. Logs in with stored credentials and pulls the daily export.   |

### Strava
Create a free personal API application at <https://www.strava.com/settings/api>
and set its **Authorization Callback Domain** to `127.0.0.1`. Then, on the
**Connections** screen, paste the app's **Client ID** and **Client Secret** and
*Save credentials* (stored OS-encrypted — no env vars needed). Click *Connect
Strava*: the system browser opens, you authorize, and activities flow into
Cardio. Tokens refresh automatically.

> Prefer env vars? `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` are still honored
> as a fallback if set before launch.

### Apple Health
Apple exposes no server API; HealthKit data lives on the phone. Install the
**Health Auto Export** app (or build a Shortcut) and point its REST export at
the endpoint shown on the Connections screen:

```
POST http://<this-machine-ip>:8787/ingest/health
```

Set it to run on a schedule (e.g. hourly). Optionally set `HEALTH_INGEST_TOKEN`
and add it as a `Bearer` header to gate the endpoint. Cronometer's macros ride
this same pipeline (Cronometer → Apple Health → receiver, tagged
`cronometer_via_apple_health`).

### Cronometer (unofficial — credentials stored)
> ⚠️ Cronometer has **no public API**. This path logs in with your username and
> password (held **OS-encrypted** via Electron `safeStorage`, never written in
> the clear or committed) and scrapes the same daily CSV export the web app
> generates. It is against Cronometer's ToS and can break if their login flow
> changes. The non-credential alternative is the Apple Health pipeline above.

Enter your login on the Connections screen and *Link account*; the trailing two
weeks of daily nutrition + micronutrients are pulled hourly (`cronometer_direct`).

## Layout

- `app/` — one route per IA screen plus `/connections`. Client components that
  read a single `Snapshot` from the provider (`app/providers.tsx`), which uses
  `window.sb` IPC in the desktop app and falls back to seed data in a browser.
- `components/` — `HubFrame`, `Nav`, `Ascii`, `Feed`, `SerumLiquidRender`.
- `lib/` — `types.ts` (the IPC contract), `seed-data.ts` (first-paint / web
  fallback), `ascii.ts` (the real-monospace `█`/`░` bars).
- `desktop/` — the Electron backend (compiled to `dist-electron/`):
  - `main.ts` / `preload.ts` — shell, window, IPC, Strava OAuth loopback.
  - `db/` — SQLite schema + seed + the snapshot/connection queries.
  - `ingest/` — `strava.ts`, `cronometer.ts`, `appleHealth.ts`, `receiver.ts`,
    `secrets.ts`, and the orchestrator `index.ts`.
  - `smoke.cjs` — `node desktop/smoke.cjs` exercises DB + both parsers.

> `AGENTS.md` notes Next 16 has breaking changes — check
> `node_modules/next/dist/docs/` before writing Next code.
