# Systeme Brut — repo orientation

An un-gamified biological command center: three nodes (training, pharmacology,
nutrition/telemetry) plus a Synthesizer (SB-Σ). **Read `docs/HANDOFF.md`
first.**

## Where things are

- `docs/` — architecture v2, closed IA, the handoff brief, and the mockups
  (mockup CSS is a **spec**, not shippable code — translate intent, not markup).
- `supabase/migrations/` — the v2 Postgres schema, split by node. `seed.sql`
  mirrors the mockup numbers.
- `sb-00/` — the master hub, a **Next.js 16 (App Router)** app. **This is the
  primary build.** It has its own `AGENTS.md` warning that Next 16 has breaking
  changes — read `node_modules/next/dist/docs/` before writing Next code.
- `sb-02-watchface/` — separate hardware problem, own README.
- SB-01 (mobile) is **paused** — do not start it without a reason; see handoff.

## Conventions that matter

- **One flag colour:** magenta `#e0157a` means *flag*, nothing else.
- **ASCII matrices are real monospace text** (`sb-00/lib/ascii.ts`), never a
  charting lib styled to look like ASCII.
- SB-00 currently reads `sb-00/lib/data.ts` (mirrors `supabase/seed.sql`). When
  wiring Supabase, replace that module with queries — shapes already match the
  tables/views.
- Never commit secrets (Supabase keys, Strava tokens). They belong in `.env`.

## Working in SB-00

```bash
cd sb-00 && npm install && npm run dev   # http://localhost:3000
npm run build                            # verify before committing
```
