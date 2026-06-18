# Systeme Brut — Architecture v2

Supersedes `systeme-brut-architecture.md` (v1). Read v2 only.

Three structural changes since v1, all from closing the category decisions:

1. **Cycles are gone** — the regimen is continuous, titrated against bloodwork
   rather than planned in advance.
2. **Lifts and Cardio each get a dedicated deep view** — PR/logbook, 10k
   progression.
3. **Three external data sources need real ingestion paths** rather than
   placeholder `source` columns.

The SQL in this doc is implemented in `supabase/migrations/`.

---

## 1. Node A — Iron & Asphalt (Training)

`exercises`, `training_sessions`, `sets` are unchanged from v1.

`cardio_sessions` is extended for Strava and a real goal. Two views power the
Lifts PR/logbook screen — no new stored table, since a PR is just a property of
the existing `sets`:

```sql
create view exercise_session_volume as
  select session_id, exercise_id, sum(weight_kg * reps) as volume
  from sets
  group by session_id, exercise_id;

create view exercise_current_pr as
  select exercise_id, max(volume) as pr_volume
  from exercise_session_volume
  group by exercise_id;

alter table cardio_sessions
  add column source text default 'manual',   -- 'manual' | 'strava'
  add column external_id text,               -- Strava activity id
  add column pace_avg_sec_per_km integer,
  add column elevation_gain_m numeric,
  add column splits jsonb;                   -- per-km split array

create table goals (
  id serial primary key,
  node text not null,            -- 'training' | 'pharmacology' | 'nutrition'
  metric text not null,          -- 'distance_km', for the 10k build-up
  target_value numeric not null,
  unit text,
  target_date date,
  status text default 'active',  -- 'active' | 'achieved' | 'abandoned'
  notes text
);
```

## 2. Node B — Clinical Pharmacology

**Dropped:** `cycles`, `cycle_compounds`. There's no protocol to plan against —
compounds get picked, dosed daily, and titrated against bloodwork as it comes
in.

```sql
alter table administrations drop column cycle_id;

create table titration_log (
  id serial primary key,
  compound_id integer references compounds(id),
  changed_at timestamp not null,
  dose_before_mg numeric,
  dose_after_mg numeric not null,
  trigger_lab_result integer references lab_results(id),  -- nullable
  notes text
);
```

`compounds`, `lab_panels`, `lab_results` are unchanged from v1.

## 3. Node C — Nutrition & Telemetry

Structurally unchanged, but `source` / `device_source` values now mean
something specific (see Integrations below):

- `nutrition_logs.source` → `'cronometer_via_apple_health'` or `'manual'`
- `wearable_readings.device_source`, `sleep_sessions.device_source` →
  `'apple_health'` as the umbrella value, since Apple Health is what actually
  lands in the database regardless of which watch fed it.

## 4. Cross-cutting — the Synthesizer (SB-Σ)

`insights` and the `estimated_serum_levels` materialized view are unchanged.

The new cross-node section in the Flags screen **isn't a schema change** — it's
a filter over `insights` where `node_refs` touches more than one node. Node
membership is a prefix lookup:

| table prefix in `node_refs`                                      | node          |
| ---------------------------------------------------------------- | ------------- |
| `sets:`, `cardio_sessions:`                                      | training      |
| `administrations:`, `lab_results:`, `titration_log:`             | pharmacology  |
| `nutrition_logs:`, `micronutrients:`, `wearable_readings:`, `sleep_sessions:` | nutrition |

An insight whose `node_refs` array spans more than one of these groups is
cross-node by definition — no flag column needed, just that lookup at render
time. See `node_of()` and the `insight_classified` view in
`supabase/migrations/0004_synthesizer.sql`.

## 5. Integrations — what's actually real, checked today

**Cronometer — no API, route around it.** Cronometer has never shipped a public
API. The only direct option is an unofficial client that scrapes the export
endpoint with your username/password — explicitly licensed for personal backup
only, and it stores your credentials. Instead: Cronometer natively syncs food
energy + macros into **Apple Health** already. Nutrition rides the same Apple
Health pipeline as everything else; `source` reads
`cronometer_via_apple_health`, and there's no separate Cronometer code path to
maintain.

**Apple Health — no API, a sanctioned bridge app.** Apple doesn't expose a
server API; data is funneled through a bridge app that posts to a Supabase Edge
Function webhook receiver.

**Strava — real API, webhook subscription.** Strava activities land via an Edge
Function webhook and populate `cardio_sessions` with `source = 'strava'`.

### Desktop implementation (SB-00 standalone)

The SB-00 desktop program implements these same paths client-side against a
local SQLite mirror, so it works before/without the Supabase deployment:

- **Strava** — OAuth2 + scheduled `/athlete/activities` polling (`desktop/ingest/strava.ts`).
- **Apple Health** — a loopback HTTP receiver on `:8787` that a phone bridge
  (Health Auto Export / Shortcut) POSTs to (`desktop/ingest/receiver.ts`).
  Cronometer rides this (`source = 'cronometer_via_apple_health'`).
- **Cronometer (opt-in)** — the unofficial credential scraper, pulling the daily
  CSV export (`source = 'cronometer_direct'`, `desktop/ingest/cronometer.ts`).
  Credentials are OS-encrypted via Electron `safeStorage`.

---

## Tech stack (decided, not re-litigated)

- **Hub (SB-00):** SvelteKit or Next.js against Supabase. **This build uses
  Next.js** (App Router) — the provided serum render is already React +
  Three.js, so React is the path of least resistance. D3 / Observable Plot for
  any real charts — but the ASCII matrices in the mockups are meant to be **real
  monospace text**, not rendered charts dressed up to look like ASCII.
- **Backend:** Supabase — managed Postgres running the v2 schema directly, plus
  Edge Functions as the webhook receivers for Apple Health and Strava.
- **Mobile (SB-01), paused:** React Native + Expo, local-first SQLite, synced to
  Supabase. Now targeting Android only (a dedicated device, not the daily
  phone), which simplifies distribution to a plain sideloaded APK.
- **SB-02:** Xiaomi Smart Band 10 watchface, BPM-led. Separate hardware problem
  — see `sb-02-watchface/README.md`.
