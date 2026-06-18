import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let db: Database.Database | null = null;

/**
 * Open (and on first run, create + seed) the local SQLite store.
 * @param dbPath  absolute path under the app's userData dir
 */
export function openDb(dbPath: string): Database.Database {
  if (db) return db;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const here = __dirname;
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

  const seeded = db.prepare('SELECT COUNT(*) AS n FROM compounds').get() as { n: number };
  if (seeded.n === 0) {
    db.exec(readFileSync(join(here, 'seed.sql'), 'utf8'));
  } else {
    // Ensure connection rows exist even on an already-seeded DB.
    const ins = db.prepare(
      "INSERT OR IGNORE INTO connections(source, status) VALUES (?, 'disconnected')",
    );
    for (const s of ['strava', 'cronometer', 'apple_health']) ins.run(s);
  }
  migrate(db);
  return db;
}

/** Idempotent migrations for DBs created before a feature landed. */
function migrate(db: Database.Database) {
  // cardio_sessions.sport (multi-sport: run / ride / swim)
  const cols = db.prepare('PRAGMA table_info(cardio_sessions)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'sport')) {
    db.exec("ALTER TABLE cardio_sessions ADD COLUMN sport TEXT NOT NULL DEFAULT 'run'");
  }
  // cardio_sessions.gear_id (links a session to a shoe/bike in `gear`)
  if (!cols.some((c) => c.name === 'gear_id')) {
    db.exec('ALTER TABLE cardio_sessions ADD COLUMN gear_id TEXT');
  }
  // gear table (running shoes / bikes + mileage) for DBs created before it landed
  db.exec(`CREATE TABLE IF NOT EXISTS gear (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'shoe',
    distance_m REAL NOT NULL DEFAULT 0,
    retired INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual'
  )`);

  // insights.dedup_key (SB-Σ sweep: stable slug so a flag isn't re-raised).
  const icols = db.prepare('PRAGMA table_info(insights)').all() as { name: string }[];
  if (!icols.some((c) => c.name === 'dedup_key')) {
    db.exec('ALTER TABLE insights ADD COLUMN dedup_key TEXT');
  }

  // protocols.ended_at (discontinued compounds keep clearing from the end date).
  const pcols = db.prepare('PRAGMA table_info(protocols)').all() as { name: string }[];
  if (!pcols.some((c) => c.name === 'ended_at')) {
    db.exec('ALTER TABLE protocols ADD COLUMN ended_at TEXT');
  }

  // sets: rest-pause bursts / stretch seconds / widowmaker target (new set kinds)
  const scols = db.prepare('PRAGMA table_info(sets)').all() as { name: string }[];
  if (!scols.some((c) => c.name === 'rp_reps')) db.exec('ALTER TABLE sets ADD COLUMN rp_reps TEXT');
  if (!scols.some((c) => c.name === 'seconds')) db.exec('ALTER TABLE sets ADD COLUMN seconds INTEGER');
  if (!scols.some((c) => c.name === 'target_reps')) db.exec('ALTER TABLE sets ADD COLUMN target_reps INTEGER');

  // Backfill a continuous protocol from each compound's latest dose.
  const protoCount = (db.prepare('SELECT COUNT(*) AS n FROM protocols').get() as { n: number }).n;
  if (protoCount === 0) {
    const rows = db.prepare(`
      SELECT a.compound_id AS cid, a.dose_mg AS dose, a.route AS route
      FROM administrations a
      WHERE a.administered_at = (SELECT MAX(administered_at) FROM administrations a2 WHERE a2.compound_id = a.compound_id)
      GROUP BY a.compound_id
    `).all() as { cid: number; dose: number; route: string }[];
    const ins = db.prepare(
      "INSERT INTO protocols (compound_id, daily_dose_mg, route, started_at, active) VALUES (?,?,?,date('now'),1)",
    );
    for (const r of rows) ins.run(r.cid, r.dose, r.route);
  }

  // Default agent settings.
  const setIns = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  setIns.run('agent_provider', 'ollama');
  setIns.run('agent_url', 'http://127.0.0.1:11434');
  setIns.run('agent_model', '');

  // Weight goal + a seed bodyweight if none exist yet.
  const hasWeightGoal = db.prepare("SELECT 1 FROM goals WHERE metric='body_mass' LIMIT 1").get();
  if (!hasWeightGoal) {
    db.prepare("INSERT INTO goals (node, metric, target_value, unit, status, notes) VALUES ('nutrition','body_mass',86,'kg','active','Lean recomp target')").run();
  }
  const hasWeight = db.prepare("SELECT 1 FROM wearable_readings WHERE metric='body_mass' LIMIT 1").get();
  if (!hasWeight) {
    db.prepare("INSERT OR IGNORE INTO wearable_readings (measured_at, metric, value, unit, device_source) VALUES (datetime('now'),'body_mass',89.4,'kg','manual')").run();
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not opened — call openDb() first');
  return db;
}
