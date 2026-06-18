import { getDb } from './index';
import type { LiftInput, AdminInput, TitrationInput, LabPanelInput } from '../../lib/types';

/**
 * Manual logging — the write path behind the in-app log forms (Training and
 * Pharmacology). Everything lands in the same local SQLite the snapshot reads,
 * so a write is immediately visible. Cardio and Nutrition are intentionally not
 * here: they sync in from Strava and Cronometer.
 */

/** Find an exercise by name (case-insensitive), creating it if new. */
function ensureExercise(name: string): number {
  const db = getDb();
  const hit = db.prepare('SELECT id FROM exercises WHERE name = ? COLLATE NOCASE').get(name) as { id: number } | undefined;
  if (hit) return hit.id;
  const main = /^(squat|bench|row|ohp|deadlift)$/i.test(name.trim()) ? 1 : 0;
  return db.prepare('INSERT INTO exercises (name, is_main_lift) VALUES (?, ?)').run(name.trim(), main).lastInsertRowid as number;
}

/** Find a compound by name (case-insensitive), creating a minimal row if new. */
function ensureCompound(name: string): number {
  const db = getDb();
  const hit = db.prepare('SELECT id FROM compounds WHERE name = ? COLLATE NOCASE').get(name) as { id: number } | undefined;
  if (hit) return hit.id;
  return db.prepare("INSERT INTO compounds (name, default_route) VALUES (?, 'IM')").run(name.trim()).lastInsertRowid as number;
}

/** Get (or create) the training session for a given calendar date. */
function sessionForDate(dateISO: string): number {
  const db = getDb();
  const day = dateISO.slice(0, 10);
  const hit = db.prepare("SELECT id FROM training_sessions WHERE substr(occurred_at,1,10) = ?").get(day) as { id: number } | undefined;
  if (hit) return hit.id;
  return db.prepare('INSERT INTO training_sessions (occurred_at, split) VALUES (?, NULL)').run(dateISO).lastInsertRowid as number;
}

export function addSet(input: LiftInput) {
  const db = getDb();
  const exerciseId = ensureExercise(input.exercise);
  const sessionId = sessionForDate(input.date);
  const ord = (db.prepare('SELECT COALESCE(MAX(ordinal),0)+1 AS n FROM sets WHERE session_id = ?').get(sessionId) as { n: number }).n;
  db.prepare(
    'INSERT INTO sets (session_id, exercise_id, set_kind, weight_kg, reps, ordinal) VALUES (?,?,?,?,?,?)',
  ).run(sessionId, exerciseId, input.setKind, input.weightKg, input.reps, ord);
}

export function addAdministration(input: AdminInput) {
  const db = getDb();
  const compoundId = ensureCompound(input.compound);
  db.prepare(
    'INSERT INTO administrations (compound_id, administered_at, dose_mg, route) VALUES (?,?,?,?)',
  ).run(compoundId, input.administeredAt, input.doseMg, input.route);
}

export function addTitration(input: TitrationInput) {
  const db = getDb();
  const compoundId = ensureCompound(input.compound);
  db.prepare(
    'INSERT INTO titration_log (compound_id, changed_at, dose_before_mg, dose_after_mg, notes) VALUES (?,?,?,?,?)',
  ).run(compoundId, input.changedAt, input.before ?? null, input.after, input.notes ?? null);
}

export function addLabPanel(input: LabPanelInput) {
  const db = getDb();
  const tx = db.transaction(() => {
    const panelId = db.prepare('INSERT INTO lab_panels (drawn_at, lab_name) VALUES (?,?)')
      .run(input.drawnAt, input.labName ?? null).lastInsertRowid as number;
    const ins = db.prepare(
      'INSERT INTO lab_results (panel_id, marker, value, unit, range_low, range_high) VALUES (?,?,?,?,?,?)',
    );
    for (const r of input.results) {
      if (!r.marker || r.value == null || Number.isNaN(r.value)) continue;
      ins.run(panelId, r.marker, r.value, r.unit ?? null, r.low ?? null, r.high ?? null);
    }
  });
  tx();
}

export function getCatalog() {
  const db = getDb();
  const exercises = (db.prepare('SELECT name FROM exercises ORDER BY is_main_lift DESC, name').all() as { name: string }[]).map((r) => r.name);
  const compounds = (db.prepare('SELECT name FROM compounds ORDER BY name').all() as { name: string }[]).map((r) => r.name);
  return { exercises, compounds };
}
