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

  // insights.dedup_key (SB-Σ sweep: stable slug so a flag isn't re-raised).
  const icols = db.prepare('PRAGMA table_info(insights)').all() as { name: string }[];
  if (!icols.some((c) => c.name === 'dedup_key')) {
    db.exec('ALTER TABLE insights ADD COLUMN dedup_key TEXT');
  }

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
