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
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not opened — call openDb() first');
  return db;
}
