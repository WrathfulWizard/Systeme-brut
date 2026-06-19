import { getDb } from './index';
import { getCatalog } from './mutations';
import { computeTrainingStatus } from './training';
import { getStravaApp } from '../ingest/secrets';
import { lookup } from '../pharma/compounds';
import { protocolSerum, discreteSerum } from '../pharma/serum';
import type {
  Snapshot, Insight, NodeGroup, SyncMeta, ConnectionState, SourceId, SourceStatus, SerumCompound, SetKind,
} from '../../lib/types';

/** Normalize stored set kinds (incl. legacy rp1/rp_burst) to the current set. */
function mapSetKind(kind: string): SetKind {
  if (kind === 'rp' || kind === 'widowmaker' || kind === 'stretch' || kind === 'straight') return kind;
  if (kind === 'rp1' || kind === 'rp_burst') return 'rp';
  return 'straight';
}

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
    SELECT s.id AS id, ts.occurred_at AS at, e.name AS exercise, s.set_kind AS kind,
           s.weight_kg AS w, s.reps AS reps, s.rp_reps AS rpReps, s.seconds AS seconds, s.target_reps AS target
    FROM sets s JOIN training_sessions ts ON ts.id = s.session_id JOIN exercises e ON e.id = s.exercise_id
    ORDER BY ts.occurred_at DESC, s.ordinal ASC LIMIT 8
  `).all() as { id: number; at: string; exercise: string; kind: string; w: number; reps: number; rpReps: string | null; seconds: number | null; target: number | null }[])
    .map((r) => {
      const rp = r.rpReps ? (JSON.parse(r.rpReps) as number[]) : undefined;
      const kind = mapSetKind(r.kind);
      const missedTarget = kind === 'widowmaker' && r.target != null && r.reps < r.target;
      const setLabel = kind === 'rp' ? 'RP' : kind === 'widowmaker' ? 'Widow' : kind === 'stretch' ? 'Stretch'
        : r.kind === 'rp1' ? 'RP1' : r.kind === 'rp_burst' ? 'RP burst' : 'Straight';
      const repsDisplay = kind === 'rp' && rp?.length ? rp.join('·')
        : kind === 'stretch' ? `${r.seconds ?? 0}s`
        : kind === 'widowmaker' && r.target != null ? `${r.reps}/${r.target}`
        : String(r.reps);
      return {
        id: r.id, date: md(r.at), exercise: r.exercise, set: setLabel,
        weight: `${r.w}kg`, reps: repsDisplay,
        iso: r.at.slice(0, 10), setKind: kind, weightKg: r.w, repsN: r.reps,
        rpReps: rp, seconds: r.seconds ?? undefined, targetReps: r.target ?? undefined, missedTarget,
      };
    });

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

  // Cardio progression aggregated for the week/month/3mo/6mo/year toggle.
  const cardioWeekly = (db.prepare(`
    SELECT MIN(occurred_at) AS first_day, SUM(distance_km) AS km
    FROM cardio_sessions GROUP BY strftime('%Y-%W', occurred_at) ORDER BY first_day DESC LIMIT 52
  `).all() as { first_day: string; km: number }[]).reverse().map((r) => ({ date: md(r.first_day), distance: Math.round(r.km * 10) / 10 }));
  const cardioMonthly = (db.prepare(`
    SELECT MIN(occurred_at) AS first_day, SUM(distance_km) AS km
    FROM cardio_sessions GROUP BY strftime('%Y-%m', occurred_at) ORDER BY first_day DESC LIMIT 12
  `).all() as { first_day: string; km: number }[]).reverse().map((r) => ({ date: md(r.first_day), distance: Math.round(r.km * 10) / 10 }));

  // Cardiovascular health from Apple Health: VO2max + resting HR + HRV.
  const wearLatest = (metric: string): number | undefined => {
    const r = db.prepare("SELECT value FROM wearable_readings WHERE metric = ? ORDER BY measured_at DESC LIMIT 1").get(metric) as { value: number } | undefined;
    return r?.value;
  };
  const wearTrend = (metric: string) => (db.prepare(
    "SELECT measured_at AS at, value FROM wearable_readings WHERE metric = ? ORDER BY measured_at DESC LIMIT 24",
  ).all(metric) as { at: string; value: number }[]).reverse().map((r) => ({ date: md(r.at), value: Math.round(r.value * 10) / 10 }));
  const cardioHealth = {
    vo2max: wearLatest('vo2_max'),
    restingHr: wearLatest('resting_heart_rate'),
    hrv: wearLatest('hrv'),
    vo2Trend: wearTrend('vo2_max'),
    rhrTrend: wearTrend('resting_heart_rate'),
  };

  // Running shoes / bikes + mileage. Strava reports cumulative metres on the gear
  // itself; fall back to summing sessions tagged with this gear id.
  const gear = (db.prepare(`
    SELECT g.id AS id, g.name AS name, g.kind AS kind, g.retired AS retired, g.source AS source,
           g.external_id AS ext, g.distance_m AS dist
    FROM gear g ORDER BY g.retired ASC, g.distance_m DESC
  `).all() as { id: number; name: string; kind: string; retired: number; source: string; ext: string | null; dist: number }[])
    .map((g) => {
      const summed = g.ext
        ? (db.prepare('SELECT COALESCE(SUM(distance_km),0) AS km FROM cardio_sessions WHERE gear_id = ?').get(g.ext) as { km: number }).km
        : 0;
      const km = Math.max(g.dist / 1000, summed);
      return { id: g.id, name: g.name, kind: (g.kind === 'bike' ? 'bike' : 'shoe') as 'shoe' | 'bike', km: Math.round(km * 10) / 10, retired: !!g.retired, source: g.source };
    });

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

  const latestPanel = db.prepare('SELECT id FROM lab_panels ORDER BY drawn_at DESC, id DESC LIMIT 1').get() as { id: number } | undefined;
  // Show the MOST RECENT reading for EACH marker across all panels — so logging
  // markers across separate panels/days still surfaces them all, not just the
  // single latest panel (the old behaviour showed one marker at a time).
  const labResults = (db.prepare(`
    SELECT lr.marker AS marker, lr.value AS value, lr.unit AS unit,
           lr.range_low AS lo, lr.range_high AS hi, lp.drawn_at AS at
    FROM lab_results lr
    JOIN lab_panels lp ON lp.id = lr.panel_id
    JOIN (
      SELECT lr2.marker AS marker, MAX(lp2.drawn_at) AS maxd
      FROM lab_results lr2 JOIN lab_panels lp2 ON lp2.id = lr2.panel_id
      GROUP BY lr2.marker
    ) latest ON latest.marker = lr.marker AND latest.maxd = lp.drawn_at
    GROUP BY lr.marker ORDER BY lr.marker
  `).all() as { marker: string; value: number; unit: string; lo: number; hi: number; at: string }[])
    .map((r) => ({
      marker: r.marker, value: `${r.value} ${r.unit ?? ''}`.trim(),
      range: r.lo != null && r.hi != null ? `${r.lo}–${r.hi}` : '—',
      flagged: (r.lo != null && r.value < r.lo) || (r.hi != null && r.value > r.hi),
      at: md(r.at),
    }));

  // estimated serum per active compound (half-life model) — drives the visual
  const serumByCompound = buildSerumByCompound();
  // back-compat 7d series for the ASCII bars: the testosterone stream (or first)
  const primarySerum = serumByCompound.find((s) => /test/i.test(s.klass)) ?? serumByCompound[0];
  const serum7d = primarySerum ? primarySerum.series.slice(-7) : [];

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

  // Weekly calorie averages for the 4w / 8w / 12w views (oldest→newest, last 12).
  const caloriesByWeek = (db.prepare(`
    SELECT strftime('%Y-%W', logged_on) AS wk, MIN(logged_on) AS first_day, AVG(calories_kcal) AS kcal
    FROM nutrition_logs WHERE meal IS NULL AND calories_kcal IS NOT NULL
    GROUP BY wk ORDER BY first_day DESC LIMIT 12
  `).all() as { wk: string; first_day: string; kcal: number }[])
    .reverse().map((r) => ({ day: md(r.first_day), kcal: Math.round(r.kcal) }));

  // body composition (caliper bf% + tape measurements), newest first
  const bodyComposition = (db.prepare(`
    SELECT id, measured_on AS at, weight_kg AS w, body_fat_pct AS bf,
           chest_cm AS ch, arm_cm AS ar, thigh_cm AS th, waist_cm AS wa
    FROM body_metrics ORDER BY measured_on DESC LIMIT 24
  `).all() as { id: number; at: string; w: number | null; bf: number | null; ch: number | null; ar: number | null; th: number | null; wa: number | null }[])
    .map((r) => ({
      id: r.id, date: md(r.at), iso: r.at.slice(0, 10),
      weightKg: r.w ?? undefined, bodyFatPct: r.bf ?? undefined,
      chestCm: r.ch ?? undefined, armCm: r.ar ?? undefined, thighCm: r.th ?? undefined, waistCm: r.wa ?? undefined,
    }));

  const micros = db.prepare(
    'SELECT nutrient, kind, amount, unit, target_amount AS tgt, rda_pct AS rda FROM micronutrients WHERE logged_on = (SELECT MAX(logged_on) FROM micronutrients) ORDER BY id',
  ).all() as { nutrient: string; kind: string; amount: number; unit: string; tgt: number; rda: number }[];
  const vitamins = micros.filter((m) => m.kind === 'vitamin').map((m) => ({
    nutrient: m.nutrient, amount: `${m.amount} ${m.unit}`, rda: m.rda != null ? `${Math.round(m.rda)}%` : '—',
    flagged: m.rda != null && m.rda < 50,
  }));
  const minerals = micros.filter((m) => m.kind === 'mineral' || m.kind === 'electrolyte').map((m) => {
    const overSodium = m.nutrient === 'Sodium' && m.tgt != null && m.amount > m.tgt;
    const lowTrace = m.rda != null && m.rda < 50;
    return {
      mineral: m.nutrient, amount: `${m.amount} ${m.unit}`,
      target: m.nutrient === 'Sodium' ? `<${m.tgt} ${m.unit}` : m.tgt != null ? `${m.tgt} ${m.unit}` : '—',
      flagged: overSodium || lowTrace,
    };
  });
  // Essential fats (omega-3/6 etc.) get their own readout — omega-3 low is flagged.
  const essentialFats = micros.filter((m) => m.kind === 'fat').map((m) => ({
    mineral: m.nutrient, amount: `${m.amount} ${m.unit}`,
    target: m.tgt != null ? `${m.tgt} ${m.unit}` : '—',
    flagged: m.nutrient === 'Omega-3' && m.tgt != null && m.amount < m.tgt,
  }));

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
    insights, recentSets, prLog, tonnage, trainingStatus: computeTrainingStatus(),
    cardioGoal, cardioProgression, recentRuns, cardioBySport, cardioWeekly, cardioMonthly, cardioHealth, gear,
    protocols, administrations, titration, labResults, serum7d, serumByCompound,
    dailyTotals, calories7d, caloriesByWeek, vitamins, minerals, essentialFats, bodyComposition, weightGoal,
    session: { id: 'SB-00', clock: '03:14:09' },
    syncMeta: getSyncMeta(),
    catalog: getCatalog(),
    labPanelId: latestPanel?.id,
  };
}

/**
 * Estimate serum for every active compound over a 14-day window. Each active
 * protocol is reconstructed into a standing-dose timeline (start dose stepped
 * by each titration), then the half-life PK model integrates it. A compound
 * with administrations but no protocol falls back to the discrete-dose model.
 * Half-life and the stream's colour/character come from the built-in library
 * (the DB's half_life_hours wins when it's set).
 */
const SERUM_WINDOW_DAYS = 56; // 8 weeks — enough for the per-compound 3d/1w/4w/8w views

function buildSerumByCompound(): SerumCompound[] {
  const db = getDb();
  const dayMsOf = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00').getTime();

  // Active AND recently-ended protocols: a discontinued compound keeps clearing,
  // so it should still appear (decaying) until serum is negligible.
  const protos = db.prepare(`
    SELECT p.id AS id, p.compound_id AS cid, c.name AS name, c.half_life_hours AS hl,
           p.daily_dose_mg AS dose, p.started_at AS since, p.active AS active, p.ended_at AS ended
    FROM protocols p JOIN compounds c ON c.id = p.compound_id
    ORDER BY c.id
  `).all() as { id: number; cid: number; name: string; hl: number | null; dose: number; since: string; active: number; ended: string | null }[];

  const out: SerumCompound[] = [];

  for (const p of protos) {
    const info = lookup(p.name);
    const halfLifeDays = p.hl && p.hl > 0 ? p.hl / 24 : info.halfLifeDays;

    const tits = db.prepare(
      'SELECT changed_at AS at, dose_before_mg AS before, dose_after_mg AS after FROM titration_log WHERE compound_id = ? ORDER BY changed_at',
    ).all(p.cid) as { at: string; before: number; after: number }[];

    const initial = tits.length ? (tits[0].before ?? p.dose) : p.dose;
    const steps = [{ t: dayMsOf(p.since), dose: initial }, ...tits.map((t) => ({ t: dayMsOf(t.at), dose: t.after }))];
    // A discontinued protocol stops dosing at ended_at → append a zero step.
    const discontinued = p.active === 0;
    if (discontinued && p.ended) steps.push({ t: dayMsOf(p.ended), dose: 0 });
    const series = protocolSerum(steps, halfLifeDays, { windowDays: SERUM_WINDOW_DAYS });
    if (series.length === 0) continue;
    const current = series[series.length - 1].mg;
    // Drop a discontinued compound once it's effectively cleared (≤1mg or <2% peak).
    const peak = series.reduce((m, s) => Math.max(m, s.mg), 0);
    if (discontinued && (current <= 1 || current < peak * 0.02)) continue;

    // Steady state ≈ 4.3 half-lives of continuous dosing (~95% of plateau).
    const daysRunning = (Date.now() - dayMsOf(p.since)) / 86_400_000;
    const steadyState = !discontinued && daysRunning >= halfLifeDays * 4.3;

    out.push({
      key: info.key, label: info.shortLabel, klass: info.klass, color: info.color,
      character: info.character, halfLifeDays: Math.round(halfLifeDays * 10) / 10,
      current, peak, series, steadyState, discontinued, form: info.form,
    });
  }

  // Compounds dosed only via the discrete administrations log (no protocol).
  const loose = db.prepare(`
    SELECT a.compound_id AS cid, c.name AS name, c.half_life_hours AS hl
    FROM administrations a JOIN compounds c ON c.id = a.compound_id
    WHERE a.compound_id NOT IN (SELECT compound_id FROM protocols)
    GROUP BY a.compound_id
  `).all() as { cid: number; name: string; hl: number | null }[];

  for (const l of loose) {
    const info = lookup(l.name);
    const halfLifeDays = l.hl && l.hl > 0 ? l.hl / 24 : info.halfLifeDays;
    const admins = db.prepare(
      'SELECT administered_at AS at, dose_mg AS dose FROM administrations WHERE compound_id = ?',
    ).all(l.cid) as { at: string; dose: number }[];
    const series = discreteSerum(admins.map((a) => ({ t: dayMsOf(a.at), dose: a.dose })), halfLifeDays, { windowDays: SERUM_WINDOW_DAYS });
    if (series.length === 0 || series.every((s) => s.mg === 0)) continue;
    out.push({
      key: info.key, label: info.shortLabel, klass: info.klass, color: info.color,
      character: info.character, halfLifeDays: Math.round(halfLifeDays * 10) / 10,
      current: series[series.length - 1].mg, peak: series.reduce((m, s) => Math.max(m, s.mg), 0),
      series, steadyState: false, discontinued: false, form: info.form,
    });
  }

  return out.sort((a, b) => b.current - a.current);
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
