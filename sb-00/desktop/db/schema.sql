-- Systeme Brut · SB-00 desktop — local SQLite store.
-- Mirrors supabase/migrations (v2) in SQLite dialect. The Postgres project
-- remains the source of truth for the schema; this is the on-device cache the
-- standalone program reads and the ingestion services write.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---- Node A: Iron & Asphalt ---------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_main_lift INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id INTEGER PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  split TEXT
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  set_kind TEXT DEFAULT 'straight',
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  ordinal INTEGER
);

CREATE TABLE IF NOT EXISTS cardio_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  distance_km REAL NOT NULL,
  duration_sec INTEGER,
  pace_avg_sec_per_km INTEGER,
  elevation_gain_m REAL,
  splits TEXT,                       -- JSON
  sport TEXT NOT NULL DEFAULT 'run', -- run / ride / swim
  gear_id TEXT,                      -- Strava gear id (links to gear.external_id)
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT UNIQUE
);

-- Running shoes / bikes with accumulated mileage (synced from Strava gear).
CREATE TABLE IF NOT EXISTS gear (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,           -- Strava gear id, or NULL for manual
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'shoe', -- shoe / bike
  distance_m REAL NOT NULL DEFAULT 0,
  retired INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value REAL NOT NULL,
  unit TEXT,
  target_date TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT
);

-- ---- Node B: Clinical Pharmacology --------------------------------------
CREATE TABLE IF NOT EXISTS compounds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT,
  default_route TEXT DEFAULT 'IM',
  half_life_hours REAL
);

CREATE TABLE IF NOT EXISTS administrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compound_id INTEGER NOT NULL REFERENCES compounds(id),
  administered_at TEXT NOT NULL,
  dose_mg REAL NOT NULL,
  route TEXT
);

CREATE TABLE IF NOT EXISTS lab_panels (
  id INTEGER PRIMARY KEY,
  drawn_at TEXT NOT NULL,
  lab_name TEXT
);

CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id INTEGER NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
  marker TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  range_low REAL,
  range_high REAL
);

CREATE TABLE IF NOT EXISTS titration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compound_id INTEGER REFERENCES compounds(id),
  changed_at TEXT NOT NULL,
  dose_before_mg REAL,
  dose_after_mg REAL NOT NULL,
  trigger_lab_result INTEGER REFERENCES lab_results(id),
  notes TEXT
);

-- ---- Node C: Nutrition & Telemetry --------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_on TEXT NOT NULL,
  meal TEXT,
  calories_kcal REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  fiber_g REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  UNIQUE(logged_on, meal, source)
);

CREATE TABLE IF NOT EXISTS micronutrients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_on TEXT NOT NULL,
  nutrient TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount REAL,
  unit TEXT,
  target_amount REAL,
  rda_pct REAL,
  source TEXT NOT NULL DEFAULT 'cronometer_via_apple_health',
  UNIQUE(logged_on, nutrient, source)
);

CREATE TABLE IF NOT EXISTS wearable_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measured_at TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  device_source TEXT NOT NULL DEFAULT 'apple_health',
  UNIQUE(measured_at, metric, device_source)
);

CREATE TABLE IF NOT EXISTS sleep_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_min INTEGER,
  device_source TEXT NOT NULL DEFAULT 'apple_health',
  UNIQUE(started_at, device_source)
);

-- ---- SB-Σ: the Synthesizer ----------------------------------------------
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  body TEXT NOT NULL,
  node_refs TEXT NOT NULL DEFAULT '[]',   -- JSON array of "table:id"
  dedup_key TEXT,                         -- stable slug for SB-Σ-raised flags; NULL for hand-seeded
  resolved_at TEXT
);

-- ---- desktop-only: connection state -------------------------------------
-- Tokens/credentials live in the OS-encrypted secrets file, NOT here.
CREATE TABLE IF NOT EXISTS connections (
  source TEXT PRIMARY KEY,                 -- 'strava' | 'cronometer' | 'apple_health'
  status TEXT NOT NULL DEFAULT 'disconnected',
  detail TEXT,
  last_sync_at TEXT,
  cursor TEXT                              -- per-source pagination/high-water mark
);

-- ---- Node B (reworked): continuous compound protocol --------------------
-- A protocol is a compound run continuously at a current daily dose. Changing
-- the dose ("titrate") updates daily_dose_mg and appends a titration_log row.
CREATE TABLE IF NOT EXISTS protocols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compound_id INTEGER NOT NULL REFERENCES compounds(id),
  daily_dose_mg REAL NOT NULL,
  route TEXT,
  started_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  ended_at TEXT,                          -- set when discontinued; serum keeps clearing
  note TEXT
);

-- ---- key/value settings (agent model, base url, etc.) -------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ---- cardio sport tag (added for multi-sport: run/ride/swim) ------------
-- (column added defensively via migration in index.ts for existing DBs)
