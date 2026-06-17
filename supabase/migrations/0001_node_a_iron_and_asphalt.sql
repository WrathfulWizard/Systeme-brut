-- ============================================================================
-- Systeme Brut · Node A — Iron & Asphalt (Training)
-- Architecture v2
--
-- DC-style lifting log plus a 10k running build-up.
--   · exercises / training_sessions / sets        — unchanged from v1
--   · cardio_sessions                             — extended for Strava + goals
--   · goals                                       — new (powers the 10k progression)
--   · exercise_session_volume / exercise_current_pr — views, a PR is just a
--                                                   property of existing sets
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Exercises — the catalogue of movements
-- ----------------------------------------------------------------------------
create table if not exists exercises (
  id            serial primary key,
  name          text not null,
  modality      text default 'barbell',   -- 'barbell' | 'machine' | 'cable' | 'bodyweight'
  is_main_lift  boolean default false,     -- surfaced in the PR/logbook view
  notes         text,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Training sessions — one workout
-- ----------------------------------------------------------------------------
create table if not exists training_sessions (
  id            serial primary key,
  occurred_at   timestamptz not null default now(),
  split         text,                      -- DC split label, e.g. 'Push A'
  bodyweight_kg numeric,
  notes         text
);

-- ----------------------------------------------------------------------------
-- Sets — the atomic training record. Rest-pause bursts live here as
-- separate rows tagged on set_kind ('rp1' | 'rp_burst' | 'straight' ...).
-- ----------------------------------------------------------------------------
create table if not exists sets (
  id            serial primary key,
  session_id    integer not null references training_sessions(id) on delete cascade,
  exercise_id   integer not null references exercises(id),
  set_kind      text default 'straight',   -- 'straight' | 'rp1' | 'rp_burst'
  weight_kg     numeric not null,
  reps          integer not null,
  rpe           numeric,
  ordinal       integer,                   -- order within the session
  created_at    timestamptz not null default now()
);

create index if not exists idx_sets_session  on sets(session_id);
create index if not exists idx_sets_exercise on sets(exercise_id);

-- ----------------------------------------------------------------------------
-- Cardio sessions — extended for Strava ingestion and the 10k build-up.
-- v1 columns are assumed present; the v2 delta is the source/external_id/
-- pace/elevation/splits block. Written as ADD COLUMN IF NOT EXISTS so this
-- file is idempotent whether the table pre-exists or not.
-- ----------------------------------------------------------------------------
create table if not exists cardio_sessions (
  id            serial primary key,
  occurred_at   timestamptz not null default now(),
  distance_km   numeric not null,
  duration_sec  integer,
  notes         text
);

alter table cardio_sessions
  add column if not exists source              text default 'manual', -- 'manual' | 'strava'
  add column if not exists external_id         text,                  -- Strava activity id
  add column if not exists pace_avg_sec_per_km integer,
  add column if not exists elevation_gain_m    numeric,
  add column if not exists splits              jsonb;                 -- per-km split array

-- Strava activity ids are unique when present; manual rows leave it null.
create unique index if not exists idx_cardio_external_id
  on cardio_sessions(external_id) where external_id is not null;

-- ----------------------------------------------------------------------------
-- Goals — target-driven progression (the 10km build-up is the first one).
-- ----------------------------------------------------------------------------
create table if not exists goals (
  id            serial primary key,
  node          text not null,             -- 'training' | 'pharmacology' | 'nutrition'
  metric        text not null,             -- e.g. 'distance_km'
  target_value  numeric not null,
  unit          text,
  target_date   date,
  status        text default 'active',     -- 'active' | 'achieved' | 'abandoned'
  notes         text
);

-- ----------------------------------------------------------------------------
-- PR / logbook views — no new stored table. A PR is the max session volume
-- (sum of weight * reps) an exercise has ever hit.
-- ----------------------------------------------------------------------------
create or replace view exercise_session_volume as
  select
    session_id,
    exercise_id,
    sum(weight_kg * reps) as volume
  from sets
  group by session_id, exercise_id;

create or replace view exercise_current_pr as
  select
    exercise_id,
    max(volume) as pr_volume
  from exercise_session_volume
  group by exercise_id;
