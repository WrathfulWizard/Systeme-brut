-- ============================================================================
-- Systeme Brut · Node B — Clinical Pharmacology
-- Architecture v2
--
-- Continuous regimen, titrated against bloodwork. No cycle planning.
--   · DROPPED: cycles, cycle_compounds       — nothing to plan against
--   · administrations                         — loses cycle_id
--   · titration_log                           — new (dose changes + trigger)
--   · compounds / lab_panels / lab_results    — unchanged from v1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Compounds — the pharmacology catalogue
-- ----------------------------------------------------------------------------
create table if not exists compounds (
  id                serial primary key,
  name              text not null,         -- 'Testosterone Cyp', 'Anavar'
  class             text,                  -- 'androgen' | 'oral' | 'ancillary'
  default_route     text default 'IM',     -- 'IM' | 'oral' | 'subq'
  half_life_hours   numeric,               -- feeds estimated_serum_levels
  notes             text
);

-- ----------------------------------------------------------------------------
-- Administrations — the daily micro-dose log.
-- v1 carried a cycle_id; v2 drops it (continuous regimen, no cycles).
-- ----------------------------------------------------------------------------
create table if not exists administrations (
  id            serial primary key,
  compound_id   integer not null references compounds(id),
  administered_at timestamptz not null default now(),
  dose_mg       numeric not null,
  route         text,                      -- defaults from compound when null
  notes         text
);

-- v2 change: regimen is continuous — there is no cycle to attach to.
alter table administrations drop column if exists cycle_id;

create index if not exists idx_admin_compound on administrations(compound_id);
create index if not exists idx_admin_time     on administrations(administered_at);

-- v1 cycle tables are gone in v2. Drop dependents first.
drop table if exists cycle_compounds;
drop table if exists cycles;

-- ----------------------------------------------------------------------------
-- Lab panels / lab results — bloodwork
-- ----------------------------------------------------------------------------
create table if not exists lab_panels (
  id            serial primary key,
  drawn_at      timestamptz not null default now(),
  lab_name      text,
  notes         text
);

create table if not exists lab_results (
  id            serial primary key,
  panel_id      integer not null references lab_panels(id) on delete cascade,
  marker        text not null,             -- 'ALT', 'HDL', 'Hematocrit' ...
  value         numeric not null,
  unit          text,
  range_low     numeric,
  range_high    numeric,
  flagged       boolean
    generated always as (
      (range_low  is not null and value < range_low) or
      (range_high is not null and value > range_high)
    ) stored
);

create index if not exists idx_lab_results_panel on lab_results(panel_id);

-- ----------------------------------------------------------------------------
-- Titration log — every dose change and what triggered it. The trigger is a
-- nullable reference to whatever lab_result prompted the change.
-- ----------------------------------------------------------------------------
create table if not exists titration_log (
  id                  serial primary key,
  compound_id         integer references compounds(id),
  changed_at          timestamptz not null,
  dose_before_mg      numeric,
  dose_after_mg       numeric not null,
  trigger_lab_result  integer references lab_results(id),  -- nullable
  notes               text
);

create index if not exists idx_titration_compound on titration_log(compound_id);
