import { getDb } from './index';
import { computeTrainingStatus } from './training';
import type { LiftInput, AdminInput, TitrationInput, LabPanelInput, ProtocolInput, BodyMetricInput } from '../../lib/types';

/** Effective rep count for volume: RP sums its bursts, a stretch is held not repped. */
function effectiveReps(input: LiftInput): number {
  if (input.setKind === 'rp') return (input.rpReps ?? []).reduce((a, b) => a + (b || 0), 0);
  if (input.setKind === 'stretch') return 0;
  return input.reps ?? 0;
}
const rpJson = (input: LiftInput) => (input.setKind === 'rp' && input.rpReps?.length ? JSON.stringify(input.rpReps.filter((n) => n > 0)) : null);
const TARGET_DEFAULT = 20;

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
  const target = input.setKind === 'widowmaker' ? (input.targetReps ?? TARGET_DEFAULT) : null;
  db.prepare(
    'INSERT INTO sets (session_id, exercise_id, set_kind, weight_kg, reps, rp_reps, seconds, target_reps, ordinal) VALUES (?,?,?,?,?,?,?,?,?)',
  ).run(sessionId, exerciseId, input.setKind, input.weightKg, effectiveReps(input),
        rpJson(input), input.setKind === 'stretch' ? (input.seconds ?? null) : null, target, ord);

  // SB-Σ reminders fired on the write path (deduped, never on a read):
  if (input.setKind === 'widowmaker' && (input.reps ?? 0) < (target ?? TARGET_DEFAULT)) {
    raiseDedupedInsight(
      `widowmaker-miss-${input.exercise}-${input.date}`.toLowerCase(),
      'flag',
      `Widowmaker on ${input.exercise}: ${input.reps ?? 0}/${target ?? TARGET_DEFAULT} reps — short of target. Hold the weight here until you hit ${target ?? TARGET_DEFAULT}.`,
      ['sets:0'],
    );
  }
  maybeRaiseDeloadFlag();
}

export function updateSet(id: number, input: LiftInput) {
  const db = getDb();
  const exerciseId = ensureExercise(input.exercise);
  const sessionId = sessionForDate(input.date);
  const target = input.setKind === 'widowmaker' ? (input.targetReps ?? TARGET_DEFAULT) : null;
  db.prepare(
    'UPDATE sets SET session_id=?, exercise_id=?, set_kind=?, weight_kg=?, reps=?, rp_reps=?, seconds=?, target_reps=? WHERE id=?',
  ).run(sessionId, exerciseId, input.setKind, input.weightKg, effectiveReps(input),
        rpJson(input), input.setKind === 'stretch' ? (input.seconds ?? null) : null, target, id);
}

/** Raise a flag once (deduped by key): skipped if open or resolved within 14d. */
export function raiseDedupedInsight(key: string, severity: 'info' | 'flag', body: string, refs: string[] = []): boolean {
  const db = getDb();
  const recentCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const exists = db.prepare('SELECT 1 FROM insights WHERE dedup_key = ? AND (resolved_at IS NULL OR resolved_at > ?) LIMIT 1');
  if (exists.get(key, recentCutoff)) return false;
  db.prepare('INSERT INTO insights (created_at, severity, body, node_refs, dedup_key) VALUES (?,?,?,?,?)')
    .run(nowIso(), severity, body, JSON.stringify(refs), key);
  return true;
}

/** After ≥4 hard weeks with no back-off, remind the operator to deload. */
export function maybeRaiseDeloadFlag() {
  const st = computeTrainingStatus();
  if (st.deloadDue) {
    raiseDedupedInsight('deload-due', 'flag',
      `${st.weeksSinceDeload} weeks of training with no back-off week. Schedule a deload — drop volume ~40% for a week to consolidate.`,
      ['sets:0']);
  }
}

export function deleteSet(id: number) {
  getDb().prepare('DELETE FROM sets WHERE id = ?').run(id);
}

export function addAdministration(input: AdminInput) {
  const db = getDb();
  const compoundId = ensureCompound(input.compound);
  db.prepare(
    'INSERT INTO administrations (compound_id, administered_at, dose_mg, route) VALUES (?,?,?,?)',
  ).run(compoundId, input.administeredAt, input.doseMg, input.route);
}

export function updateAdministration(id: number, input: AdminInput) {
  const db = getDb();
  const compoundId = ensureCompound(input.compound);
  db.prepare(
    'UPDATE administrations SET compound_id=?, administered_at=?, dose_mg=?, route=? WHERE id=?',
  ).run(compoundId, input.administeredAt, input.doseMg, input.route, id);
}

export function deleteAdministration(id: number) {
  getDb().prepare('DELETE FROM administrations WHERE id = ?').run(id);
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

export function deleteTitration(id: number) {
  getDb().prepare('DELETE FROM titration_log WHERE id = ?').run(id);
}

export function deleteLabPanel(id: number) {
  // lab_results cascade on panel delete (FK ON DELETE CASCADE)
  getDb().prepare('DELETE FROM lab_panels WHERE id = ?').run(id);
}

/* ---- body composition (caliper bf% + tape measurements) ----------------- */

/** Upsert a day's body composition. Weight here also feeds the mass trend. */
export function addBodyMetric(input: BodyMetricInput) {
  const db = getDb();
  const day = input.measuredOn.slice(0, 10);
  db.prepare(`
    INSERT INTO body_metrics (measured_on, weight_kg, body_fat_pct, chest_cm, arm_cm, thigh_cm, waist_cm)
    VALUES (@d, @w, @bf, @ch, @ar, @th, @wa)
    ON CONFLICT(measured_on) DO UPDATE SET
      weight_kg=COALESCE(excluded.weight_kg, weight_kg),
      body_fat_pct=COALESCE(excluded.body_fat_pct, body_fat_pct),
      chest_cm=COALESCE(excluded.chest_cm, chest_cm),
      arm_cm=COALESCE(excluded.arm_cm, arm_cm),
      thigh_cm=COALESCE(excluded.thigh_cm, thigh_cm),
      waist_cm=COALESCE(excluded.waist_cm, waist_cm)
  `).run({
    d: day, w: input.weightKg ?? null, bf: input.bodyFatPct ?? null,
    ch: input.chestCm ?? null, ar: input.armCm ?? null, th: input.thighCm ?? null, wa: input.waistCm ?? null,
  });
  // Mirror weight into wearable_readings so the bodyweight trend includes it.
  if (input.weightKg != null) {
    db.prepare(`
      INSERT INTO wearable_readings (measured_at, metric, value, unit, device_source)
      VALUES (?, 'body_mass', ?, 'kg', 'manual')
      ON CONFLICT(measured_at, metric, device_source) DO UPDATE SET value=excluded.value
    `).run(`${day}T06:30:00`, input.weightKg);
  }
}

export function deleteBodyMetric(id: number) {
  getDb().prepare('DELETE FROM body_metrics WHERE id = ?').run(id);
}

/* ---- continuous protocol (Node B rework) -------------------------------- */

const nowIso = () => new Date().toISOString();
const todayDate = () => nowIso().slice(0, 10);

export function addProtocol(input: ProtocolInput) {
  const db = getDb();
  const compoundId = ensureCompound(input.compound);
  // Allow backdating so protocols started before adopting the app estimate serum
  // correctly. Guard against a future date.
  const startedAt = input.startedAt && input.startedAt <= todayDate() ? input.startedAt.slice(0, 10) : todayDate();
  db.prepare(
    'INSERT INTO protocols (compound_id, daily_dose_mg, route, started_at, active, note) VALUES (?,?,?,?,1,?)',
  ).run(compoundId, input.doseMg, input.route, startedAt, input.note ?? null);
}

/** Change a running protocol's dose; logs the before→after as a titration. */
export function titrateProtocol(id: number, newDoseMg: number, note?: string) {
  const db = getDb();
  const p = db.prepare('SELECT compound_id AS cid, daily_dose_mg AS dose FROM protocols WHERE id = ?').get(id) as
    { cid: number; dose: number } | undefined;
  if (!p) return;
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO titration_log (compound_id, changed_at, dose_before_mg, dose_after_mg, notes) VALUES (?,?,?,?,?)',
    ).run(p.cid, todayDate(), p.dose, newDoseMg, note ?? null);
    db.prepare('UPDATE protocols SET daily_dose_mg = ? WHERE id = ?').run(newDoseMg, id);
  });
  tx();
}

export function endProtocol(id: number) {
  // Record the end date so the serum model keeps decaying the compound from here.
  getDb().prepare('UPDATE protocols SET active = 0, ended_at = ? WHERE id = ?').run(todayDate(), id);
}

export function deleteProtocol(id: number) {
  getDb().prepare('DELETE FROM protocols WHERE id = ?').run(id);
}

/* ---- flags (SB-Σ) ------------------------------------------------------- */

export function resolveInsight(id: number) {
  getDb().prepare('UPDATE insights SET resolved_at = ? WHERE id = ?').run(nowIso(), id);
}

export function addInsight(severity: 'info' | 'flag', body: string, nodeRefs: string[] = []) {
  getDb().prepare(
    'INSERT INTO insights (created_at, severity, body, node_refs) VALUES (?,?,?,?)',
  ).run(nowIso(), severity, body, JSON.stringify(nodeRefs));
}

/** A flag SB-Σ proposes during a sweep. `key` is a stable slug for de-dup. */
export interface AgentFlag {
  severity: 'info' | 'flag';
  body: string;
  nodes: string[];   // node names the model named: training/cardio/pharmacology/nutrition
  key: string;
}

// Map the node a flag names → a representative table ref, so the existing
// nodesOf() pipeline tags the flag with the right node on the Flags screen.
const NODE_REF: Record<string, string> = {
  training: 'sets:0', lifting: 'sets:0', lift: 'sets:0', cardio: 'cardio_sessions:0',
  pharmacology: 'administrations:0', pharma: 'administrations:0', ped: 'administrations:0',
  nutrition: 'nutrition_logs:0', substrate: 'nutrition_logs:0', diet: 'nutrition_logs:0',
};

/**
 * Persist the flags SB-Σ raised during a sweep. De-duplicated by `dedup_key`:
 * a flag is skipped if one with the same key is still open, OR was resolved in
 * the last 14 days — so the agent never re-raises something you just cleared.
 * Returns how many new flags were actually written.
 */
export function addAgentFlags(flags: AgentFlag[]): number {
  const db = getDb();
  const recentCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const exists = db.prepare(
    'SELECT 1 FROM insights WHERE dedup_key = ? AND (resolved_at IS NULL OR resolved_at > ?) LIMIT 1',
  );
  const ins = db.prepare(
    'INSERT INTO insights (created_at, severity, body, node_refs, dedup_key) VALUES (?,?,?,?,?)',
  );
  let written = 0;
  for (const f of flags) {
    const body = (f.body ?? '').trim();
    if (!body) continue;
    const key = ((f.key && f.key.trim()) || body).toLowerCase().slice(0, 120);
    if (exists.get(key, recentCutoff)) continue;
    const refs = [...new Set((f.nodes ?? []).map((n) => NODE_REF[n.toLowerCase().trim()]).filter(Boolean))];
    ins.run(nowIso(), f.severity === 'info' ? 'info' : 'flag', body, JSON.stringify(refs), key);
    written++;
  }
  return written;
}

/* ---- settings ----------------------------------------------------------- */

export function getSetting(key: string): string | undefined {
  const r = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return r?.value;
}
export function setSetting(key: string, value: string) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getCatalog() {
  const db = getDb();
  const exercises = (db.prepare('SELECT name FROM exercises ORDER BY is_main_lift DESC, name').all() as { name: string }[]).map((r) => r.name);
  const compounds = (db.prepare('SELECT name FROM compounds ORDER BY name').all() as { name: string }[]).map((r) => r.name);
  return { exercises, compounds };
}
