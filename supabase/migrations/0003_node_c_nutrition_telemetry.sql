-- ============================================================================
-- Systeme Brut · Node C — Nutrition & Telemetry
-- Architecture v2
--
-- Structurally unchanged from v1, but `source` / `device_source` values now
-- mean something specific because of how ingestion actually works:
--
--   · Cronometer has no public API. It natively syncs food energy + macros
--     into Apple Health, so nutrition rides the same Apple Health pipeline as
--     everything else. nutrition_logs.source = 'cronometer_via_apple_health'.
--   · Apple Health is the umbrella device_source for wearable + sleep data,
--     regardless of which watch actually fed it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nutrition logs — daily intake, imported (not manually logged on SB-01).
-- ----------------------------------------------------------------------------
create table if not exists nutrition_logs (
  id            serial primary key,
  logged_on     date not null,
  meal          text,                      -- 'breakfast' | 'lunch' | ... | null = daily total
  calories_kcal numeric,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  fiber_g       numeric,
  source        text not null default 'manual',
                -- 'cronometer_via_apple_health' | 'manual'
  created_at    timestamptz not null default now()
);

create index if not exists idx_nutrition_logged_on on nutrition_logs(logged_on);

-- ----------------------------------------------------------------------------
-- Micronutrients — vitamins kept separate from minerals/electrolytes, since
-- the electrolyte side is the piece that actually talks to Node B (sodium/BP).
-- ----------------------------------------------------------------------------
create table if not exists micronutrients (
  id            serial primary key,
  logged_on     date not null,
  nutrient      text not null,             -- 'Vitamin D', 'Sodium', 'Potassium' ...
  kind          text not null,             -- 'vitamin' | 'mineral' | 'electrolyte'
  amount        numeric,
  unit          text,
  target_amount numeric,
  rda_pct       numeric,
  source        text not null default 'cronometer_via_apple_health'
);

create index if not exists idx_micro_logged_on on micronutrients(logged_on);
create index if not exists idx_micro_kind      on micronutrients(kind);

-- ----------------------------------------------------------------------------
-- Wearable readings — BPM and other point telemetry. Apple Health is the
-- umbrella value because that is what lands in the DB regardless of watch.
-- ----------------------------------------------------------------------------
create table if not exists wearable_readings (
  id            serial primary key,
  measured_at   timestamptz not null,
  metric        text not null,             -- 'heart_rate' | 'hrv' | 'spo2' ...
  value         numeric not null,
  unit          text,
  device_source text not null default 'apple_health'
);

create index if not exists idx_wearable_time   on wearable_readings(measured_at);
create index if not exists idx_wearable_metric on wearable_readings(metric);

-- ----------------------------------------------------------------------------
-- Sleep sessions
-- ----------------------------------------------------------------------------
create table if not exists sleep_sessions (
  id              serial primary key,
  started_at      timestamptz not null,
  ended_at        timestamptz not null,
  duration_min    integer,
  efficiency_pct  numeric,
  device_source   text not null default 'apple_health'
);

create index if not exists idx_sleep_started on sleep_sessions(started_at);
