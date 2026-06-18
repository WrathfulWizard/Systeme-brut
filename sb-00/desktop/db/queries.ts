import { getDb } from './index';
import { getCatalog } from './mutations';
import { getStravaApp } from '../ingest/secrets';
import type {
  Snapshot, Insight, NodeGroup, SyncMeta, ConnectionState, SourceId, SourceStatus,
} from '../../lib/types';

const stravaConfigured = () =>
  !!getStravaApp()?.clientId || !!process.env.STRAVA_CLIENT_ID;

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
const hms = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
// pace is sport-relative: run = min/km, swim = min/100m, ride = km/h
const paceStr = (secPerKm?: number, sport = 'run') => {
  if (!secPerKm) return '—';
  if (sport === 'ride') return `${(3600 / secPerKm).toFixed(1)} km/h`;
  if (sport === 'swim') { const per100 = secPerKm / 10; return `${Math.floor(per100 / 60)}:${String(Math.round(per100 % 60)).padStart(2, '0')}/100m`; }
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}/km`;
};

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

  // recent sets (latest few), formatted + raw for edit
  const recentSets = (db.prepare(`
    SELECT s.id AS id, ts.occurred_at AS at, e.name AS exercise, s.set_kind AS kind, s.weight_kg AS w, s.reps AS reps
    FROM sets s JOIN training_sessions ts ON ts.id = s.session_id JOIN exercises e ON e.id = s.exercise_id
    ORDER BY ts.occurred_at DESC, s.ordinal ASC LIMIT 6
  `).all() as { id: number; at: string; exercise: string; kind: string; w: number; reps: number }[])
    .map((r) => ({
      id: r.id, date: md(r.at), exercise: r.exercise,
      set: r.kind === 'rp1' ? 'RP1' : r.kind === 'rp_burst' ? 'RP burst' : 'Straight',
      weight: `${r.w}kg`, reps: String(r.reps),
      iso: r.at.slice(0, 10), setKind: (r.kind as 'straight' | 'rp1' | 'rp_burst') ?? 'straight',
      weightKg: r.w, repsN: r.reps,
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
    "SELECT occurred_at AS at, distance_km AS km, pace_avg_sec_per_km AS pace, duration_sec AS dur, COALESCE(sport,'run') AS sport, source FROM cardio_sessions ORDER BY occurred_at DESC LIMIT 8",
  ).all() as { at: string; km: number; pace?: number; dur?: number; sport: string; source: string }[];
  const longest = cardio.reduce((m, r) => Math.max(m, r.km), 0);
  const cardioGoal = { metric: 'distance_km', target: goalRow?.target ?? 10, longest, unit: goalRow?.unit ?? 'km' };
  const cardioProgression = [...cardio].reverse().map((r) => ({ date: md(r.at), distance: r.km }));
  const recentRuns = cardio.map((r) => ({
    date: md(r.at), distance: `${r.km.toFixed(1)}km`, pace: paceStr(r.pace, r.sport),
    source: r.source === 'strava' ? 'Strava' : r.source, sport: (r.sport ?? 'run') as 'run' | 'ride' | 'swim',
    duration: r.dur ? hms(r.dur) : undefined,
  }));
  const cardioBySport = (db.prepare(
    "SELECT COALESCE(sport,'run') AS sport, COUNT(*) AS n, COALESCE(SUM(distance_km),0) AS km FROM cardio_sessions GROUP BY COALESCE(sport,'run')",
  ).all() as { sport: string; n: number; km: number }[])
    .map((r) => ({ sport: r.sport as 'run' | 'ride' | 'swim', count: r.n, distanceKm: Math.round(r.km * 10) / 10 }));

  // pharmacology — continuous protocols
  const compounds = db.prepare('SELECT id, name, half_life_hours AS hl FROM compounds').all() as
    { id: number; name: string; hl: number }[];
  const protocols = (db.prepare(`
    SELECT p.id AS id, c.name AS compound, p.daily_dose_mg AS dose, p.route AS route, p.started_at AS since
    FROM protocols p JOIN compounds c ON c.id = p.compound_id
    WHERE p.active = 1 ORDER BY c.id
  `).all() as { id: number; compound: string; dose: number; route: string; since: string }[])
    .map((r) => ({
      id: r.id, compound: r.compound, dose: `${r.dose}mg daily`,
      route: r.route === 'oral' ? 'Oral' : r.route, doseMg: r.dose, route_raw: r.route, since: md(r.since),
    }));

  const administrations = (db.prepare(`
    SELECT a.id AS id, a.administered_at AS at, c.name AS compound, a.dose_mg AS dose, a.route AS route
    FROM administrations a JOIN compounds c ON c.id = a.compound_id
    ORDER BY a.administered_at DESC LIMIT 6
  `).all() as { id: number; at: string; compound: string; dose: number; route: string }[])
    .map((r) => ({
      id: r.id, date: md(r.at), compound: r.compound, dose: `${r.dose}mg`,
      route: r.route === 'oral' ? 'Oral' : r.route,
      iso: r.at.slice(0, 10), doseMg: r.dose, routeRaw: r.route,
    }));

  const titration = (db.prepare(`
    SELECT t.id AS id, t.changed_at AS at, c.name AS compound, t.dose_before_mg AS b, t.dose_after_mg AS a2, t.notes AS notes
    FROM titration_log t JOIN compounds c ON c.id = t.compound_id ORDER BY t.changed_at DESC
  `).all() as { id: number; at: string; compound: string; b: number; a2: number; notes: string }[])
    .map((r) => ({ id: r.id, date: md(r.at), compound: r.compound, change: `${r.b}mg → ${r.a2}mg`, trigger: r.notes }));

  const latestPanel = db.prepare('SELECT id FROM lab_panels ORDER BY drawn_at DESC LIMIT 1').get() as { id: number } | undefined;
  const labResults = (db.prepare(`
    SELECT marker, value, unit, range_low AS lo, range_high AS hi FROM lab_results
    WHERE panel_id = ? ORDER BY id
  `).all(latestPanel?.id ?? -1) as { marker: string; value: number; unit: string; lo: number; hi: number }[])
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

  // bodyweight goal + trend
  const wGoal = db.prepare("SELECT target_value AS target, unit FROM goals WHERE metric='body_mass' AND status='active' LIMIT 1").get() as { target: number; unit: string } | undefined;
  const wRows = (db.prepare("SELECT measured_at AS at, value AS kg FROM wearable_readings WHERE metric='body_mass' ORDER BY measured_at DESC LIMIT 10").all() as { at: string; kg: number }[]);
  const weightGoal = {
    current: wRows[0]?.kg,
    target: wGoal?.target ?? 0,
    unit: wGoal?.unit ?? 'kg',
    trend: [...wRows].reverse().map((r) => ({ day: md(r.at), kg: r.kg })),
  };

  return {
    insights, recentSets, prLog, tonnage, cardioGoal, cardioProgression, recentRuns, cardioBySport,
    protocols, administrations, titration, labResults, serum7d,
    dailyTotals, calories7d, vitamins, minerals, weightGoal,
    session: { id: 'SB-00', clock: '03:14:09' },
    syncMeta: getSyncMeta(),
    catalog: getCatalog(),
    labPanelId: latestPanel?.id,
  };
}

/**
 * Estimate serum from the continuous protocol: reconstruct the daily dose for
 * each day (protocol start dose, stepped by each titration), then sum the
 * exponential decay of every day's dose. Falls back to legacy administrations
 * if no protocol exists yet.
 */
function estimateSerum7d(compoundId: number | undefined, halfLifeDays: number) {
  const db = getDb();
  if (!compoundId) return [];

  const proto = db.prepare(
    'SELECT daily_dose_mg AS dose, started_at AS since FROM protocols WHERE compound_id = ? AND active = 1 ORDER BY started_at LIMIT 1',
  ).get(compoundId) as { dose: number; since: string } | undefined;

  const dayMsOf = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00').getTime();
  let timeline: { t: number; dose: number }[] = [];

  if (proto) {
    const tits = db.prepare(
      'SELECT changed_at AS at, dose_before_mg AS before, dose_after_mg AS after FROM titration_log WHERE compound_id = ? ORDER BY changed_at',
    ).all(compoundId) as { at: string; before: number; after: number }[];
    const initial = tits.length ? (tits[0].before ?? proto.dose) : proto.dose;
    timeline.push({ t: dayMsOf(proto.since), dose: initial });
    for (const tt of tits) timeline.push({ t: dayMsOf(tt.at), dose: tt.after });
  } else {
    const admins = db.prepare(
      'SELECT administered_at AS at, dose_mg AS dose FROM administrations WHERE compound_id = ?',
    ).all(compoundId) as { at: string; dose: number }[];
    if (admins.length === 0) return [];
    // legacy: discrete doses
    const anchor = admins.reduce((m, a) => Math.max(m, dayMsOf(a.at)), 0);
    const out: { day: string; mg: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayMs = anchor - i * 86400_000;
      let mg = 0;
      for (const a of admins) { const e = (dayMs - dayMsOf(a.at)) / 86400_000; if (e >= 0) mg += a.dose * Math.pow(0.5, e / halfLifeDays); }
      out.push({ day: weekday(new Date(dayMs).toISOString()), mg: Math.round(mg) });
    }
    return out;
  }

  timeline = timeline.sort((a, b) => a.t - b.t);
  const doseOnDay = (t: number) => {
    let dose = 0;
    for (const p of timeline) { if (p.t <= t) dose = p.dose; else break; }
    return dose;
  };

  const start = timeline[0].t;
  const todayMs = dayMsOf(new Date().toISOString());
  const anchor = Math.max(todayMs, timeline[timeline.length - 1].t);

  const out: { day: string; mg: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const D = anchor - i * 86400_000;
    let mg = 0;
    for (let d = start; d <= D; d += 86400_000) {
      const dose = doseOnDay(d);
      if (dose > 0) mg += dose * Math.pow(0.5, (D - d) / 86400_000 / halfLifeDays);
    }
    out.push({ day: weekday(new Date(D).toISOString()), mg: Math.round(mg) });
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
    configured: r.source === 'strava' ? stravaConfigured() : undefined,
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
