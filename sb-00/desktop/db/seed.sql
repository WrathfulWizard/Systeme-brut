-- Seed the local store with the mockup numbers so the hub is populated before
-- any live source is connected. Runs once, only when the DB is empty.

INSERT INTO exercises (id, name, is_main_lift) VALUES
  (1,'Squat',1),(2,'Bench',1),(3,'Row',1),(4,'OHP',1);

INSERT INTO training_sessions (id, occurred_at, split) VALUES
  (1,'2026-06-17T06:42:00','Lower A'),
  (2,'2026-06-15T06:40:00','Push A'),
  (3,'2026-06-12T06:38:00','Pull A'),
  (4,'2026-06-05T06:35:00','Push B');
-- Realistic DC sets; session volumes (sum weight*reps) drive PR/tonnage views.
INSERT INTO sets (session_id, exercise_id, set_kind, weight_kg, reps, ordinal) VALUES
  (1,1,'straight',140,5,1),(1,1,'straight',140,5,2),(1,1,'straight',140,5,3),
  (1,1,'rp1',140,8,4),(1,1,'rp_burst',140,3,5),(1,1,'rp_burst',140,2,6),
  (2,2,'straight',100,6,1),(2,2,'straight',100,6,2),(2,2,'straight',100,6,3),
  (2,2,'rp1',100,6,4),(2,2,'rp_burst',100,3,5),(2,2,'rp_burst',100,2,6),
  (3,3,'straight',110,8,1),(3,3,'straight',110,8,2),(3,3,'straight',110,8,3),
  (3,3,'rp1',110,8,4),(3,3,'rp_burst',110,4,5),
  (4,4,'straight',70,8,1),(4,4,'straight',70,8,2),(4,4,'straight',70,8,3),
  (4,4,'rp1',70,7,4),(4,4,'rp_burst',70,4,5);

INSERT INTO goals (node, metric, target_value, unit, target_date, status, notes) VALUES
  ('training','distance_km',10,'km','2026-07-15','active','10k build-up');

INSERT INTO cardio_sessions (occurred_at, distance_km, pace_avg_sec_per_km, source, external_id) VALUES
  ('2026-06-06',5.0,370,'strava','seed_strava_1001'),
  ('2026-06-10',5.5,361,'strava','seed_strava_1002'),
  ('2026-06-13',6.0,355,'strava','seed_strava_1003'),
  ('2026-06-16',7.2,342,'strava','seed_strava_1004');

INSERT INTO compounds (id, name, class, default_route, half_life_hours) VALUES
  (1,'Testosterone Cyp','androgen','IM',192),
  (2,'Anavar','oral','oral',9),
  (3,'Masteron E','androgen','IM',120),
  (4,'Trenbolone Acetate','androgen','IM',24),
  (5,'Deca Durabolin','androgen','IM',168);

-- Continuous daily micro-dosing — gives the serum estimate a real accumulation curve.
INSERT INTO administrations (compound_id, administered_at, dose_mg, route) VALUES
  (1,'2026-06-08T08:10:00',14,'IM'),(2,'2026-06-08T08:10:00',20,'oral'),
  (1,'2026-06-09T08:10:00',14,'IM'),(2,'2026-06-09T08:10:00',20,'oral'),
  (1,'2026-06-10T08:10:00',14,'IM'),(2,'2026-06-10T08:10:00',20,'oral'),
  (1,'2026-06-11T08:10:00',14,'IM'),(2,'2026-06-11T08:10:00',20,'oral'),
  (1,'2026-06-12T08:10:00',14,'IM'),(2,'2026-06-12T08:10:00',20,'oral'),
  (1,'2026-06-13T08:10:00',14,'IM'),(2,'2026-06-13T08:10:00',20,'oral'),
  (1,'2026-06-14T08:10:00',14,'IM'),(2,'2026-06-14T08:10:00',20,'oral'),
  (1,'2026-06-15T08:10:00',14,'IM'),(2,'2026-06-15T08:10:00',20,'oral'),
  (1,'2026-06-16T08:10:00',14,'IM'),(2,'2026-06-16T08:10:00',20,'oral'),
  (1,'2026-06-17T08:10:00',14,'IM'),(2,'2026-06-17T08:10:00',20,'oral');

INSERT INTO lab_panels (id, drawn_at, lab_name) VALUES (1,'2026-06-08','Quest');
INSERT INTO lab_results (panel_id, marker, value, unit, range_low, range_high) VALUES
  (1,'GGT',42,'U/L',8,61),
  (1,'ALT',68,'U/L',7,55),
  (1,'HDL',31,'mg/dL',40,60),
  (1,'Hematocrit',49,'%',38,50),
  (1,'Cystatin C',0.91,'mg/L',0.6,1.0);

INSERT INTO titration_log (compound_id, changed_at, dose_before_mg, dose_after_mg, notes) VALUES
  (1,'2026-06-12',11,14,'Trough low-normal, progressing per plan'),
  (2,'2026-05-20',10,20,'No ALT rise at 4wk check');

INSERT INTO nutrition_logs (logged_on, meal, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source) VALUES
  ('2026-06-11',NULL,2640,200,300,86,32,'cronometer_via_apple_health'),
  ('2026-06-12',NULL,2510,195,280,82,30,'cronometer_via_apple_health'),
  ('2026-06-13',NULL,2980,220,330,92,35,'cronometer_via_apple_health'),
  ('2026-06-14',NULL,2860,210,315,88,33,'cronometer_via_apple_health'),
  ('2026-06-15',NULL,3020,225,340,95,36,'cronometer_via_apple_health'),
  ('2026-06-16',NULL,2750,205,300,84,31,'cronometer_via_apple_health'),
  ('2026-06-17',NULL,2840,215,310,88,34,'cronometer_via_apple_health');

INSERT INTO micronutrients (logged_on, nutrient, kind, amount, unit, target_amount, rda_pct) VALUES
  ('2026-06-17','Vitamin D','vitamin',9.2,'µg',20,46),
  ('2026-06-17','Vitamin B12','vitamin',6.1,'µg',2.4,254),
  ('2026-06-17','Vitamin C','vitamin',64,'mg',90,71),
  ('2026-06-17','Folate','vitamin',280,'µg',400,70),
  ('2026-06-17','Sodium','electrolyte',3850,'mg',2300,NULL),
  ('2026-06-17','Potassium','electrolyte',3100,'mg',3400,NULL),
  ('2026-06-17','Magnesium','mineral',340,'mg',400,NULL),
  ('2026-06-17','Calcium','mineral',980,'mg',1000,NULL),
  ('2026-06-17','Chloride','electrolyte',2700,'mg',2300,NULL);

INSERT INTO sleep_sessions (started_at, ended_at, duration_min, device_source) VALUES
  ('2026-06-16T22:05:00','2026-06-17T05:17:00',432,'apple_health');

INSERT INTO insights (created_at, severity, body, node_refs) VALUES
  ('2026-06-17T10:05:00','flag','Sodium elevated 4th straight day. Cross-check against this week''s BP readings.','["micronutrients:5","lab_results:4"]'),
  ('2026-06-17T09:12:00','flag','ALT 24% over range, 9d into an oral. Suggest follow-up.','["lab_results:2"]'),
  ('2026-06-17T08:40:00','flag','HDL below range, third panel running.','["lab_results:3"]'),
  ('2026-06-16T18:00:00','info','Squat tonnage trending up 3 weeks running.','["sets:1"]'),
  ('2026-06-16T12:00:00','info','Vitamin D trending down three weeks, consistent with reduced outdoor training.','["micronutrients:1"]');

INSERT INTO connections (source, status) VALUES
  ('strava','disconnected'),('cronometer','disconnected'),('apple_health','disconnected');

-- Continuous protocol (replaces ad-hoc daily dose logging)
INSERT INTO protocols (compound_id, daily_dose_mg, route, started_at, active, note) VALUES
  (1,14,'IM','2026-05-01',1,'TRT base, micro-dosed daily'),
  (2,20,'oral','2026-05-20',1,'8-week oral run'),
  (3,12,'IM','2026-05-10',1,'Hardener — burnished gold, confident stream'),
  (4,10,'IM','2026-05-25',1,'Short ester, daily — crimson, oscillating'),
  (5,15,'IM','2026-05-05',1,'Joint support / mass — saturated orange');

-- Bodyweight trend + weight goal (for the Substrate node + the goal corner)
INSERT INTO goals (node, metric, target_value, unit, target_date, status, notes) VALUES
  ('nutrition','body_mass',86,'kg','2026-08-01','active','Lean recomp target');
INSERT INTO wearable_readings (measured_at, metric, value, unit, device_source) VALUES
  ('2026-06-11T06:30:00','body_mass',90.4,'kg','manual'),
  ('2026-06-13T06:30:00','body_mass',90.1,'kg','manual'),
  ('2026-06-15T06:30:00','body_mass',89.7,'kg','manual'),
  ('2026-06-17T06:30:00','body_mass',89.4,'kg','manual');

INSERT INTO settings (key, value) VALUES
  ('agent_provider','ollama'),
  ('agent_url','http://127.0.0.1:11434'),
  ('agent_model','');
