-- ============================================================================
-- Systeme Brut · seed data
-- Mirrors the numbers in the mockups so SB-00 has something real to render
-- before the live ingestion paths (Apple Health / Strava webhooks) are wired.
-- ============================================================================

-- --- Node A: exercises + a session with PR -------------------------------
insert into exercises (id, name, is_main_lift) values
  (1, 'Squat', true), (2, 'Bench', true), (3, 'Row', true), (4, 'OHP', true)
on conflict (id) do nothing;

insert into training_sessions (id, occurred_at, split) values
  (1, '2026-06-17 06:42', 'Lower A')
on conflict (id) do nothing;

insert into sets (session_id, exercise_id, set_kind, weight_kg, reps, ordinal) values
  (1, 1, 'rp1',      140, 5, 1),
  (1, 1, 'rp_burst', 140, 3, 2),
  (1, 1, 'rp_burst', 140, 2, 3);

insert into goals (node, metric, target_value, unit, target_date, status, notes) values
  ('training', 'distance_km', 10, 'km', '2026-07-15', 'active', '10k build-up');

insert into cardio_sessions (occurred_at, distance_km, pace_avg_sec_per_km, source, external_id) values
  ('2026-06-06', 5.0, 370, 'strava', 'strava_1001'),
  ('2026-06-10', 5.5, 361, 'strava', 'strava_1002'),
  ('2026-06-13', 6.0, 355, 'strava', 'strava_1003'),
  ('2026-06-16', 7.2, 342, 'strava', 'strava_1004')
on conflict do nothing;

-- --- Node B: regimen + bloodwork + titration ------------------------------
insert into compounds (id, name, class, default_route, half_life_hours) values
  (1, 'Testosterone Cyp', 'androgen', 'IM',   192),
  (2, 'Anavar',           'oral',     'oral', 9)
on conflict (id) do nothing;

insert into administrations (compound_id, administered_at, dose_mg, route) values
  (1, '2026-06-16 08:10', 14, 'IM'),
  (2, '2026-06-16 08:10', 20, 'oral'),
  (1, '2026-06-17 08:10', 14, 'IM'),
  (2, '2026-06-17 08:10', 20, 'oral');

insert into lab_panels (id, drawn_at, lab_name) values
  (1, '2026-06-08', 'Quest')
on conflict (id) do nothing;

insert into lab_results (panel_id, marker, value, unit, range_low, range_high) values
  (1, 'GGT',        42, 'U/L',   8,  61),
  (1, 'ALT',        68, 'U/L',   7,  55),
  (1, 'HDL',        31, 'mg/dL', 40, 60),
  (1, 'Hematocrit', 49, '%',     38, 50),
  (1, 'Cystatin C', 0.91, 'mg/L', 0.6, 1.0);

insert into titration_log (compound_id, changed_at, dose_before_mg, dose_after_mg, notes) values
  (1, '2026-06-12', 11, 14, 'Trough low-normal, progressing per plan'),
  (2, '2026-05-20', 10, 20, 'No ALT rise at 4wk check');

-- --- Node C: nutrition + micronutrients ----------------------------------
insert into nutrition_logs (logged_on, meal, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source) values
  ('2026-06-11', null, 2640, 200, 300, 86, 32, 'cronometer_via_apple_health'),
  ('2026-06-12', null, 2510, 195, 280, 82, 30, 'cronometer_via_apple_health'),
  ('2026-06-13', null, 2980, 220, 330, 92, 35, 'cronometer_via_apple_health'),
  ('2026-06-14', null, 2860, 210, 315, 88, 33, 'cronometer_via_apple_health'),
  ('2026-06-15', null, 3020, 225, 340, 95, 36, 'cronometer_via_apple_health'),
  ('2026-06-16', null, 2750, 205, 300, 84, 31, 'cronometer_via_apple_health'),
  ('2026-06-17', null, 2840, 215, 310, 88, 34, 'cronometer_via_apple_health');

insert into micronutrients (logged_on, nutrient, kind, amount, unit, target_amount, rda_pct) values
  ('2026-06-17', 'Vitamin D',   'vitamin',     9.2,  'µg',  20,   46),
  ('2026-06-17', 'Vitamin B12', 'vitamin',     6.1,  'µg',  2.4,  254),
  ('2026-06-17', 'Vitamin C',   'vitamin',     64,   'mg',  90,   71),
  ('2026-06-17', 'Folate',      'vitamin',     280,  'µg',  400,  70),
  ('2026-06-17', 'Sodium',      'electrolyte', 3850, 'mg',  2300, null),
  ('2026-06-17', 'Potassium',   'electrolyte', 3100, 'mg',  3400, null),
  ('2026-06-17', 'Magnesium',   'mineral',     340,  'mg',  400,  null),
  ('2026-06-17', 'Calcium',     'mineral',     980,  'mg',  1000, null),
  ('2026-06-17', 'Chloride',    'electrolyte', 2700, 'mg',  2300, null);

insert into sleep_sessions (started_at, ended_at, duration_min, device_source) values
  ('2026-06-16 22:05', '2026-06-17 05:17', 432, 'apple_health');

-- --- SB-Σ: the synthesizer feed ------------------------------------------
insert into insights (created_at, severity, body, node_refs) values
  ('2026-06-17 10:05', 'flag',
   'Sodium elevated 4th straight day. Cross-check against this week''s BP readings.',
   '{micronutrients:5,lab_results:4}'),  -- cross-node: nutrition (sodium) + pharmacology (cardiovascular)
  ('2026-06-17 09:12', 'flag',
   'ALT 24% over range, 9d into an oral. Suggest follow-up.',
   '{lab_results:2}'),
  ('2026-06-17 08:40', 'flag',
   'HDL below range, third panel running.',
   '{lab_results:3}'),
  ('2026-06-16 18:00', 'info',
   'Squat tonnage trending up 3 weeks running.',
   '{sets:1}'),
  ('2026-06-16 12:00', 'info',
   'Vitamin D trending down three weeks, consistent with reduced outdoor training.',
   '{micronutrients:1}');
