-- ============================================================================
-- Systeme Brut · SB-Σ — The Synthesizer (cross-cutting)
-- Architecture v2
--
-- Cross-references all three nodes and surfaces what's worth noticing.
--   · insights                       — the flag/info feed (unchanged from v1)
--   · estimated_serum_levels         — materialized view (unchanged from v1)
--   · cross-node                     — NOT a schema change; a filter over
--                                      insights whose node_refs spans >1 node
--
-- Node membership is a prefix lookup on node_refs entries:
--   sets: / cardio_sessions:                                   -> training
--   administrations: / lab_results: / titration_log:           -> pharmacology
--   nutrition_logs: / micronutrients: /
--   wearable_readings: / sleep_sessions:                       -> nutrition
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Insights — the SB-Σ feed. Each row is a flag or an info note. node_refs is
-- an array of "table:id" pointers; an insight touching tables from more than
-- one node group is cross-node by definition — no flag column needed.
-- ----------------------------------------------------------------------------
create table if not exists insights (
  id            serial primary key,
  created_at    timestamptz not null default now(),
  severity      text not null default 'info',  -- 'info' | 'flag'
  body          text not null,
  node_refs     text[] not null default '{}',  -- e.g. {'lab_results:42','micronutrients:7'}
  resolved_at   timestamptz
);

create index if not exists idx_insights_created  on insights(created_at desc);
create index if not exists idx_insights_severity on insights(severity);
create index if not exists idx_insights_noderefs on insights using gin (node_refs);

-- ----------------------------------------------------------------------------
-- node_of(ref) — map a single "table:id" ref to its node group.
-- ----------------------------------------------------------------------------
create or replace function node_of(ref text)
returns text
language sql
immutable
as $$
  select case split_part(ref, ':', 1)
    when 'sets'              then 'training'
    when 'cardio_sessions'   then 'training'
    when 'administrations'   then 'pharmacology'
    when 'lab_results'       then 'pharmacology'
    when 'titration_log'     then 'pharmacology'
    when 'nutrition_logs'    then 'nutrition'
    when 'micronutrients'    then 'nutrition'
    when 'wearable_readings' then 'nutrition'
    when 'sleep_sessions'    then 'nutrition'
    else 'unknown'
  end
$$;

-- ----------------------------------------------------------------------------
-- insight_nodes — distinct node groups each insight touches, plus a
-- cross-node flag. This is the render-time lookup the Flags screen filters on.
-- ----------------------------------------------------------------------------
create or replace view insight_nodes as
  select
    i.id,
    array(
      select distinct node_of(ref)
      from unnest(i.node_refs) as ref
      order by 1
    ) as nodes
  from insights i;

create or replace view insight_classified as
  select
    i.*,
    n.nodes,
    cardinality(n.nodes) > 1 as is_cross_node
  from insights i
  join insight_nodes n on n.id = i.id;

-- ----------------------------------------------------------------------------
-- estimated_serum_levels — materialized view. Per-compound exponential decay
-- from each administration, summed across a daily grid. Approximation only:
-- this is the number the rendered "visual readout" stands in for.
-- ----------------------------------------------------------------------------
drop materialized view if exists estimated_serum_levels;
create materialized view estimated_serum_levels as
  with grid as (
    select generate_series(
      (current_date - interval '30 days')::date,
      current_date::date,
      interval '1 day'
    )::date as day
  )
  select
    g.day,
    a.compound_id,
    c.name as compound,
    round(sum(
      a.dose_mg * power(
        0.5,
        greatest(extract(epoch from (g.day - a.administered_at::date)) / 86400.0, 0)
          / (coalesce(c.half_life_hours, 168) / 24.0)
      )
    )::numeric, 2) as estimated_mg
  from grid g
  join administrations a on a.administered_at::date <= g.day
  join compounds c       on c.id = a.compound_id
  group by g.day, a.compound_id, c.name;

create index if not exists idx_serum_day      on estimated_serum_levels(day);
create index if not exists idx_serum_compound on estimated_serum_levels(compound_id);
