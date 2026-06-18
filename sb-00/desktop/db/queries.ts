import { getDb } from './index';
import { getCatalog } from './mutations';
import type {
  Snapshot, Insight, NodeGroup, SyncMeta, ConnectionState, SourceId, SourceStatus,
} from '../../lib/types';

/* ---- small formatting helpers ------------------------------------------- */

const md = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
const weekday = (iso: string) =>
  ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(iso).getDay()];
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const paceStr = (secPerKm?: number) =>
  secPerKm ? `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}/km` : '—';

const NODE_OF: Record<string, NodeGroup> = {
  sets: 'training', cardio_sessions: 'training',
  administrations: 'pharmacology', lab_results: 'pharmacology', titration_log: 'pharmacology',
  nutrition_logs: 'nutrition', micronutrients: 'nutrition',
  wearable_readings: 'nutrition', sleep_sessions: 'nutrition',
};
const nodesOf = (refs: string[]): NodeGroup[] =>
  [...new Set(refs.map((r) => NODE_OF[r.split(':')[0]]).filter(Boolean) as NodeGroup[])];

/* ---- the snapshot -------------------------------------------------------- */

export function getSnapshot(): Snapshot {
  const db = getDb();

  const insights: Insight[] = (db.prepare(
    'SELECT id, created_at, severity, body, node_refs FROM insights WHERE resolved_at IS NULL ORDER BY created_at DESC',
  ).all() as { id: number; created_at: string; severity: string; body: string; node_refs: string }[])
    .map((r) => {
      const today = new Date().toDateString();
      const at = new Date(r.created_at).toDateString() === today ? hm(r.created_at) : 'Yday';
      return {
        id: r.id, at, severity: r.severity as Insight['severity'], body: r.body,
        nodes: nodesOf(JSON.parse(r.node_refs)),
      };
    });

  // recent sets (latest few), formatted
  const recentSets = (db.prepare(`
    SELECT ts.occurred_at AS at, e.name AS exercise, s.set_kind AS kind, s.weight_kg AS w, s.reps AS reps
    FROM sets s JOIN training_sessions ts ON ts.id = s.session_id JOIN exercises e ON e.id = s.exercise_id
    ORDER BY ts.occurred_at DESC, s.ordinal ASC LIMIT 5
  `).all() as { at: string; exercise: string; kind: string; w: number; reps: number }[])
    .map((r) => ({
      date: md(r.at), exercise: r.exercise,
      set: r.kind === 'rp1' ? 'RP1' : r.kind === 'rp_burst' ? 'RP burst' : 'Straight',
      weight: `${r.w}kg`, reps: String(r.reps),
    }));

  // session volume per exercise → PR (max) and weekly tonnage (sum, 7d)
  const sessionVol = db.prepare(`
    SELECT e.name AS lift, ts.occurred_at AS at, SUM(s.weight_kg * s.reps) AS vol
    FROM sets s JOIN training_sessions ts ON ts.id = s.session_id JOIN exercises e ON e.id = s.exercise_id
    WHERE e.is_main_lift = 1 GROUP BY ts.id, e.id
  `).all() as { lift: string; at: string; vol: number }[];

  const prMap = new Map<string, { vol: number; at: string }>();
  for (const r of sessionVol) {
    const cur = prMap.get(r.lift);
    if (!cur || r.vol > cur.vol) prMap.set(r.lift, { vol: r.vol, at: r.at });
  }
  const order = ['Squat', 'Bench', 'Row', 'OHP'];
  const recent = Date.now() - 3 * 86400_000;
  const prLog = order.filter((l) => prMap.has(l)).map((lift) => {
    const p = prMap.get(lift)!;
    return {
      exercise: lift, prVolume: Math.round(p.vol), lastBeat: md(p.at),
      status: new Date(p.at).getTime() >= recent ? 'NEW' : '—',
    };
  });
  const tonnage = prLog.map((p) => ({ lift: p.exercise.toUpperCase(), value: p.prVolume }));

  // cardio
  const goalRow = db.prepare(
    "SELECT target_value AS target, unit FROM goals WHERE node='training' AND metric='distance_km' AND status='active' LIMIT 1",
  ).get() as { target: number; unit: string } | undefined;
  const cardio = db.prepare(
    'SELECT occurred_at AS at, distance_km AS km, pace_avg_sec_per_km AS pace, source FROM cardio_sessions ORDER BY occurred_at DESC LIMIT 8',
  ).all() as { at: string; km: number; pace?: number; source: string }[];
  const longest = cardio.reduce((m, r) => Math.max(m, r.km), 0);
  const cardioGoal = { metric: 'distance_km', target: goalRow?.target ?? 10, longest, unit: goalRow?.unit ?? 'km' };
  const cardioProgression = [...cardio].reverse().map((r) => ({ date: md(r.at), distance: r.km }));
  const recentRuns = cardio.map((r) => ({
    date: md(r.at), distance: `${r.km.toFixed(1)}km`, pace: paceStr(r.pace),
    source: r.source === 'strava' ? 'Strava' : r.source,
  }));

  // pharmacology
  const compounds = db.prepare('SELECT id, name, half_life_hours AS hl FROM compounds').all() as
    { id: number; name: string; hl: number }[];
  const regimen = (db.prepare(`
    SELECT c.name AS compound, a.dose_mg AS dose, a.route AS route
    FROM administrations a JOIN compounds c ON c.id = a.compound_id
    WHERE a.administered_at = (SELECT MAX(administered_at) FROM administrations a2 WHERE a2.compound_id = a.compound_id)
    GROUP BY a.compound_id ORDER BY c.id
  `).all() as { compound: string; dose: number; route: string }[])
    .map((r) => ({ compound: r.compound, dose: `${r.dose}mg/day`, route: r.route === 'oral' ? 'Oral' : r.route }));

  const administrations = (db.prepare(`
    SELECT a.administered_at AS at, c.name AS compound, a.dose_mg AS dose, a.route AS route
    FROM administrations a JOIN compounds c ON c.id = a.compound_id
    ORDER BY a.administered_at DESC LIMIT 6
  `).all() as { at: string; compound: string; dose: number; route: string }[])
    .map((r) => ({ date: md(r.at), compound: r.compound, dose: `${r.dose}mg`, route: r.route === 'oral' ? 'Oral' : r.route }));

  const titration = (db.prepare(`
    SELECT t.changed_at AS at, c.name AS compound, t.dose_before_mg AS b, t.dose_after_mg AS a2, t.notes AS notes
    FROM titration_log t JOIN compounds c ON c.id = t.compound_id ORDER BY t.changed_at DESC
  `).all() as { at: string; compound: string; b: number; a2: number; notes: string }[])
    .map((r) => ({ date: md(r.at), compound: r.compound, change: `${r.b}mg → ${r.a2}mg`, trigger: r.notes }));

  const labResults = (db.prepare(`
    SELECT marker, value, unit, range_low AS lo, range_high AS hi FROM lab_results
    WHERE panel_id = (SELECT id FROM lab_panels ORDER BY drawn_at DESC LIMIT 1) ORDER BY id
  `).all() as { marker: string; value: number; unit: string; lo: number; hi: number }[])
    .map((r) => ({
      marker: r.marker, value: `${r.value} ${r.unit}`.trim(), range: `${r.lo}–${r.hi}`,
      flagged: r.value < r.lo || r.value > r.hi,
    }));

  // estimated serum — Test Cyp, summed exponential decay over the last 7 days
  const testCyp = compounds.find((c) => /test/i.test(c.name)) ?? compounds[0];
  const serum7d = estimateSerum7d(testCyp?.id, (testCyp?.hl ?? 192) / 24);

  // nutrition
  const latestDay = (db.prepare('SELECT MAX(logged_on) AS d FROM nutrition_logs').get() as { d: string }).d;
  const totalsRow = db.prepare(
    'SELECT calories_kcal AS kcal, protein_g AS p, carbs_g AS c, fat_g AS f, fiber_g AS fb FROM nutrition_logs WHERE logged_on = ? AND meal IS NULL LIMIT 1',
  ).get(latestDay) as { kcal: number; p: number; c: number; f: number; fb: number } | undefined;
  const TARGET = { kcal: 2900, p: 200, c: 320, f: 90, fb: 30 };
  const d = (v: number, t: number) => (v - t >= 0 ? `+${Math.round(v - t)}` : `−${Math.round(t - v)}`);
  const dailyTotals = totalsRow ? [
    { nutrient: 'Calories', today: `${Math.round(totalsRow.kcal)} kcal`, target: `${TARGET.kcal} kcal`, delta: d(totalsRow.kcal, TARGET.kcal) },
    { nutrient: 'Protein', today: `${Math.round(totalsRow.p)}g`, target: `${TARGET.p}g`, delta: d(totalsRow.p, TARGET.p) },
    { nutrient: 'Carbs', today: `${Math.round(totalsRow.c)}g`, target: `${TARGET.c}g`, delta: d(totalsRow.c, TARGET.c) },
    { nutrient: 'Fat', today: `${Math.round(totalsRow.f)}g`, target: `${TARGET.f}g`, delta: d(totalsRow.f, TARGET.f) },
    { nutrient: 'Fiber', today: `${Math.round(totalsRow.fb)}g`, target: `${TARGET.fb}g`, delta: d(totalsRow.fb, TARGET.fb) },
  ] : [];

  const calories7d = (db.prepare(
    'SELECT logged_on AS day, calories_kcal AS kcal FROM nutrition_logs WHERE meal IS NULL ORDER BY logged_on DESC LIMIT 7',
  ).all() as { day: string; kcal: number }[]).reverse().map((r) => ({ day: weekday(r.day), kcal: Math.round(r.kcal) }));

  const micros = db.prepare(
    'SELECT nutrient, kind, amount, unit, target_amount AS tgt, rda_pct AS rda FROM micronutrients WHERE logged_on = (SELECT MAX(logged_on) FROM micronutrients) ORDER BY id',
  ).all() as { nutrient: string; kind: string; amount: number; unit: string; tgt: number; rda: number }[];
  const vitamins = micros.filter((m) => m.kind === 'vitamin').map((m) => ({
    nutrient: m.nutrient, amount: `${m.amount} ${m.unit}`, rda: m.rda != null ? `${Math.round(m.rda)}%` : '—',
    flagged: m.rda != null && m.rda < 50,
  }));
  const minerals = micros.filter((m) => m.kind !== 'vitamin').map((m) => {
    const overSodium = m.nutrient === 'Sodium' && m.tgt != null && m.amount > m.tgt;
    return {
      mineral: m.nutrient, amount: `${m.amount} ${m.unit}`,
      target: m.nutrient === 'Sodium' ? `<${m.tgt} ${m.unit}` : m.tgt != null ? `${m.tgt} ${m.unit}` : '—',
      flagged: overSodium,
    };
  });

  return {
    insights, recentSets, prLog, tonnage, cardioGoal, cardioProgression, recentRuns,
    regimen, administrations, titration, labResults, serum7d,
    dailyTotals, calories7d, vitamins, minerals,
    session: { id: 'SB-00', clock: '03:14:09' },
    syncMeta: getSyncMeta(),
    catalog: getCatalog(),
  };
}

function estimateSerum7d(compoundId: number | undefined, halfLifeDays: number) {
  const db = getDb();
  if (!compoundId) return [];
  const admins = db.prepare(
    'SELECT administered_at AS at, dose_mg AS dose FROM administrations WHERE compound_id = ?',
  ).all(compoundId) as { at: string; dose: number }[];
  if (admins.length === 0) return [];

  const anchor = admins.reduce((m, a) => Math.max(m, new Date(a.at).getTime()), 0);
  const out: { day: string; mg: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayMs = anchor - i * 86400_000;
    let mg = 0;
    for (const a of admins) {
      const elapsed = (dayMs - new Date(a.at).getTime()) / 86400_000;
      if (elapsed >= 0) mg += a.dose * Math.pow(0.5, elapsed / halfLifeDays);
    }
    out.push({ day: weekday(new Date(dayMs).toISOString()), mg: Math.round(mg) });
  }
  return out;
}

/* ---- connection / sync metadata ----------------------------------------- */

export function getSyncMeta(): SyncMeta {
  const db = getDb();
  const rows = db.prepare('SELECT source, status, detail, last_sync_at FROM connections').all() as
    { source: string; status: string; detail: string | null; last_sync_at: string | null }[];
  const connections: ConnectionState[] = rows.map((r) => ({
    source: r.source as SourceId, status: r.status as SourceStatus,
    detail: r.detail ?? undefined, lastSyncAt: r.last_sync_at ?? undefined,
  }));
  return { connections };
}

export function setConnection(source: SourceId, patch: Partial<Omit<ConnectionState, 'source'>> & { cursor?: string }) {
  const db = getDb();
  const cur = db.prepare('SELECT status, detail, last_sync_at, cursor FROM connections WHERE source = ?').get(source) as
    { status: string; detail: string | null; last_sync_at: string | null; cursor: string | null } | undefined;
  db.prepare(
    'INSERT OR REPLACE INTO connections(source, status, detail, last_sync_at, cursor) VALUES (?,?,?,?,?)',
  ).run(
    source,
    patch.status ?? cur?.status ?? 'disconnected',
    patch.detail ?? cur?.detail ?? null,
    patch.lastSyncAt ?? cur?.last_sync_at ?? null,
    patch.cursor ?? cur?.cursor ?? null,
  );
}

export function getCursor(source: SourceId): string | null {
  const r = getDb().prepare('SELECT cursor FROM connections WHERE source = ?').get(source) as { cursor: string | null } | undefined;
  return r?.cursor ?? null;
}
