# Systeme Brut — Information Architecture, closed

The nav/category decisions the v2 schema is built from.

## SB-00 — Master Hub

- **00 Overview** — curated, not full parity across categories. Surfaces
  whatever's most relevant right now, not a tile per node. Currently: active
  regimen, serum estimate, any flagged labs, SB-Σ's quick feed.
- **Training** (grouped nav item, expands):
  - **Lifts** — DC training log, plus a dedicated PR / logbook view.
  - **Cardio** — running log, plus a dedicated progression view tracked against
    the current target (10km).
- **Pharmacology** — one consolidated page: current regimen/compounds, daily
  micro-administration log, bloodwork, plus a dedicated titration history block
  (dose changes and what triggered them). **No cycle planner.**
- **Nutrition** — one consolidated page: macros, vitamins, minerals together.
- **Flags — SB-Σ** — the deep view, sectioned by node (Training / Pharmacology /
  Nutrition), plus a **cross-node** section for things that don't belong to one
  node alone (sodium/BP, calories/weight trend).

## SB-01 — Mobile (paused, Android-only device)

- **Training tab** → splits into Lifts / Cardio, mirroring the hub.
- **Pharm tab** — logging only: pick a compound, log today's dose. No bloodwork,
  no titration history here.
- **Flags tab** — sectioned by node, mirroring the hub's structure.

Nutrition is **gone from SB-01 entirely** — Cronometer feeds the hub directly
via Apple Health, so there's nothing to log manually. Sleep still shows because
it's automatic telemetry, not a manual entry.

Mobile stays the live moment (today's set, today's dose, an open flag); the hub
is where synthesis happens (PR history, 10k progression, titration history,
cross-node correlations).

## SB-02 — Wrist module

Xiaomi Smart Band 10 watchface, BPM-led. Separate hardware problem with its own
README — see `sb-02-watchface/`.

## Schema implications

All closed and implemented in `supabase/migrations/`:

- Drop `cycles` and `cycle_compounds` — no planned protocols anymore, just an
  ongoing regimen titrated against bloodwork as it comes in.
- Add a `titration_log` table: date, compound_id, dose_before, dose_after, a
  reference to whatever `lab_result` (if any) triggered the change, notes.
- `insights.node_refs` already supports multiple node references, so the new
  cross-node section in Flags is a filter (insights touching 2+ nodes), not a
  schema change.
- A lightweight `goals` concept — target distance, tracked against
  `cardio_sessions` over time for the progression view.
- The Lifts PR/logbook view is a computed view over `sets` (max volume per
  exercise per session) rather than a new stored table.
