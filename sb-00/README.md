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
│   • SB-Σ agent (local Ollama)       • Cloudflare quick tunnel │
│            │ IPC (window.sb)                                   │
│  renderer (static-exported Next.js UI) ── reads snapshots     │
└──────────────────────────────────────────────────────────────┘
   ▲ Strava API   ▲ Apple Health → receiver   ▲ Cronometer   ▲ Ollama (localhost)
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
| **Strava**       | Real API. OAuth2 (loopback redirect); runs/rides/swims polled every 15 min, plus the gear (shoe/bike) locker with all-time mileage. |
| **Apple Health** | Push only — no cloud API. A phone bridge POSTs to the local receiver; always token-gated. Reachable on LAN, or over cellular via a Cloudflare quick tunnel. |
| **Cronometer**   | Recommended: ride the Apple Health pipe (no login). Alternates: a real browser sign-in (session persists) or a manual CSV import. |

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
**Health Auto Export** app (or build a Shortcut), set the export type to **REST
API → JSON**, and point it at the endpoint shown on the Connections screen. The
receiver is **always token-gated** — a per-install token is auto-generated and
OS-encrypted. Use the single copy-paste URL with the token baked in:

```
POST http://<lan-ip>:8787/ingest/health?token=<token>      # at home, on Wi-Fi
```

(Or send the token as an `Authorization: Bearer <token>` header — one or the
other, not both.) Set it to run on a schedule (e.g. hourly). **Away from home?**
Enable *Internet sync* on Connections: it opens a [Cloudflare quick
tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
(needs the free `cloudflared` binary) and shows a public HTTPS URL for the phone
— no port-forwarding. Cronometer's diet rides this same pipe (Cronometer → Apple
Health → receiver, tagged `cronometer_via_apple_health`), carrying calories,
macros, the full vitamin/mineral set, and bodyweight.

### Cronometer
**Recommended — no login, nothing to break.** In the Cronometer app enable
*Settings → Apple Health*; Cronometer then writes your nutrition into Apple
Health and it arrives through the receiver above. Two alternates on Connections:

- **Browser sign-in** — a real Chromium window opens; you sign in once and the
  session persists (it survives restarts, so it's effectively one-time). Beats
  the bot protection that 403s a bare scraper. Stored optional credentials let
  it re-link silently. Pulls the trailing two weeks hourly (`cronometer_direct`).
- **CSV import** — export *Daily Nutrition* yourself and drop the file in. Fully
  ToS-clean, no login, no network.

> Any stored Cronometer credentials are held **OS-encrypted** via Electron
> `safeStorage` — never written in the clear or committed.

## Layout

The renderer (`app/`, `components/`, `lib/`) reads a single `Snapshot`; the
Electron backend (`desktop/`) builds it from local SQLite and serves it over IPC.

- `app/` — one route per screen: `page.tsx` (**SB-Σ Synthesizer**, the home —
  chat + the launch briefing), `lifts/`, `cardio/`, `pharmacology/`,
  `nutrition/` (Substrate), `flags/`, `connections/`. `providers.tsx` exposes
  the snapshot + actions via `window.sb` IPC, falling back to seed data in a
  plain browser. `globals.css` is the design system; `layout.tsx` mounts the
  boot splash + route transitions.
- `components/`
  - `HubFrame`, `Nav`, `NodeGlyph` (per-node logos), `RouteTransition` — shell/chrome.
  - `Ascii` + `VBars` — the monospace `█`/`░` bars and the heart vertical-bar chart.
  - `Feed`, `LogForms` — the SB-Σ flag feed and the manual log forms.
  - `SerumLiquidRender` + `SerumDetail` — the WebGL serum readout and its per-compound detail.
  - `BootSplash` — the Ghost-in-the-Shell boot sequence (holds until SB-Σ's briefing is ready).
- `lib/` — `types.ts` (the IPC contract), `seed-data.ts` (first-paint / web
  fallback), `ascii.ts` (the bar builder), `version.ts` (`APP_VERSION`, bumped
  every feature change).
- `desktop/` — the Electron backend (compiled to `dist-electron/`):
  - `main.ts` / `preload.ts` — shell, window, the full IPC surface, Strava OAuth loopback.
  - `db/` — `schema.sql` + `seed.sql`, `queries.ts` (snapshot), `mutations.ts`
    (validated write path), `analytics.ts` + `training.ts` (progress/deload).
  - `ingest/` — `strava.ts`, `appleHealth.ts`, `cronometer.ts` +
    `cronometer-browser.ts`, `receiver.ts`, `tunnel.ts` (cloudflared),
    `lan.ts`, `secrets.ts` (`safeStorage` vault), and the orchestrator `index.ts`.
  - `agent/` — the local **SB-Σ** brain over Ollama: `ollama.ts` (chat / review
    / sweep), `launch.ts` (auto-start + model pull), `context.ts` (hub brief),
    `startup-review.ts` (the launch briefing).
  - `pharma/` — `compounds.ts` (half-life library) + `serum.ts` (the PK model).
  - `smoke.cjs` — `node desktop/smoke.cjs` exercises the DB, parsers, PK math,
    validation, and multi-source dedup end-to-end (run before committing).

> `AGENTS.md` notes Next 16 has breaking changes — check
> `node_modules/next/dist/docs/` before writing Next code.
