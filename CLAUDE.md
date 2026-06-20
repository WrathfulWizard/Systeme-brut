# Systeme Brut — repo orientation

An un-gamified biological command center: three nodes (training, pharmacology,
nutrition/telemetry) plus a Synthesizer (SB-Σ). **Read `docs/HANDOFF.md`
first.**

## Where things are

- `docs/` — architecture v2, closed IA, the handoff brief, and the mockups
  (mockup CSS is a **spec**, not shippable code — translate intent, not markup).
- `supabase/migrations/` — the v2 Postgres schema, split by node. `seed.sql`
  mirrors the mockup numbers.
- `sb-00/` — the master hub, a **standalone Electron desktop app**: a
  static-exported **Next.js 16 (App Router)** UI over an Electron/Node backend
  (SQLite + Strava/Cronometer/Apple Health ingestion in `sb-00/desktop/`). **This
  is the primary build.** It has its own `AGENTS.md` warning that Next 16 has
  breaking changes — read `node_modules/next/dist/docs/` before writing Next code.
- `sb-02-watchface/` — separate hardware problem, own README.
- SB-01 (mobile) is **paused** — do not start it without a reason; see handoff.

## Conventions that matter

- **One flag colour:** magenta `#e0157a` means *flag*, nothing else.
- **ASCII matrices are real monospace text** (`sb-00/lib/ascii.ts`), never a
  charting lib styled to look like ASCII.
- SB-00's UI reads a `Snapshot` over IPC (`app/providers.tsx`); the Electron
  backend builds it from local SQLite (`desktop/db/queries.ts`). `lib/seed-data.ts`
  is the first-paint / browser fallback and mirrors the SQLite + Supabase seed.
- Ingestion lives in `desktop/ingest/`: Strava (real API pull), Apple Health
  (push → local receiver on :8787), Cronometer (Apple Health pipeline + opt-in
  scraper). Credentials/tokens are OS-encrypted via `safeStorage` in
  `secrets.bin` — **never** in SQLite or committed.
- Never commit secrets (Supabase keys, Strava tokens, `secrets.bin`, `*.db`).

## Repo hygiene

`main` must always reflect the latest shipped version — after pushing feature
work, merge it into `main` so the repo's default branch is never stale.

**Bump the version on every feature change:** any commit that develops SB-00
further must also bump `APP_VERSION` in `sb-00/lib/version.ts` (patch for fixes,
minor for features). A `git commit` hook in `.claude/settings.json` reminds you
when `sb-00/` is staged without a version bump.

## Coding stance (ponytail)

Write only what's necessary. Before implementing, walk the ladder: (1) does this
need to exist? skip if not — YAGNI; (2) does stdlib/the platform already do it?
(3) is it already an installed dependency? reuse it; (4) can it be one line?
(5) only then, the minimum viable solution. No unrequested abstractions, no
speculative config, no scaffolding nobody asked for. **Never** trade away
trust-boundary validation, data-loss prevention, security, or accessibility for
brevity.

## Working in SB-00

```bash
cd sb-00 && npm install && npm run rebuild:native
npm run desktop          # build UI + backend, launch the app
npm run build && npm run build:main && node desktop/smoke.cjs   # verify before committing
```
