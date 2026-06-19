import { getDb } from './index';
import type { ProgressPeriod, ProgressRow } from '../../lib/types';

/**
 * Progress analytics — for each period (week → year) compare the most recent
 * window to the window immediately before it, across as many bodybuilding
 * parameters as we track. Powers the togglable progress table.
 */

const PERIOD_DAYS: Record<ProgressPeriod, number> = { W: 7, M: 30, '3M': 90, '6M': 180, Y: 365 };
const PERIODS: ProgressPeriod[] = ['W', 'M', '3M', '6M', 'Y'];

interface MetricDef {
  metric: string; unit: string; dp: number;
  // up in value is "good" (green) — false for fat/waist/resting-HR where down is good
  upGood: boolean;
  sql: string; // SELECT ... AS v ... WHERE <dateCol> >= ? AND <dateCol> < ?
}

const METRICS: MetricDef[] = [
  { metric: 'Bodyweight', unit: 'kg', dp: 1, upGood: true, sql: "SELECT AVG(value) AS v FROM wearable_readings WHERE metric='body_mass' AND substr(measured_at,1,10) >= ? AND substr(measured_at,1,10) < ?" },
  { metric: 'Body fat', unit: '%', dp: 1, upGood: false, sql: "SELECT AVG(body_fat_pct) AS v FROM body_metrics WHERE measured_on >= ? AND measured_on < ?" },
  { metric: 'Waist', unit: 'cm', dp: 1, upGood: false, sql: "SELECT AVG(waist_cm) AS v FROM body_metrics WHERE measured_on >= ? AND measured_on < ?" },
  { metric: 'Chest', unit: 'cm', dp: 1, upGood: true, sql: "SELECT AVG(chest_cm) AS v FROM body_metrics WHERE measured_on >= ? AND measured_on < ?" },
  { metric: 'Arm', unit: 'cm', dp: 1, upGood: true, sql: "SELECT AVG(arm_cm) AS v FROM body_metrics WHERE measured_on >= ? AND measured_on < ?" },
  { metric: 'Thigh', unit: 'cm', dp: 1, upGood: true, sql: "SELECT AVG(thigh_cm) AS v FROM body_metrics WHERE measured_on >= ? AND measured_on < ?" },
  { metric: 'Tonnage', unit: 'kg', dp: 0, upGood: true, sql: "SELECT SUM(s.weight_kg*s.reps) AS v FROM sets s JOIN training_sessions ts ON ts.id=s.session_id WHERE substr(ts.occurred_at,1,10) >= ? AND substr(ts.occurred_at,1,10) < ?" },
  { metric: 'Sessions', unit: '', dp: 0, upGood: true, sql: "SELECT COUNT(*) AS v FROM training_sessions WHERE substr(occurred_at,1,10) >= ? AND substr(occurred_at,1,10) < ?" },
  { metric: 'Calories', unit: 'kcal/d', dp: 0, upGood: true, sql: "SELECT AVG(calories_kcal) AS v FROM nutrition_logs WHERE meal IS NULL AND logged_on >= ? AND logged_on < ?" },
  { metric: 'Protein', unit: 'g/d', dp: 0, upGood: true, sql: "SELECT AVG(protein_g) AS v FROM nutrition_logs WHERE meal IS NULL AND logged_on >= ? AND logged_on < ?" },
  { metric: 'Cardio', unit: 'km', dp: 1, upGood: true, sql: "SELECT SUM(distance_km) AS v FROM cardio_sessions WHERE substr(occurred_at,1,10) >= ? AND substr(occurred_at,1,10) < ?" },
  { metric: 'VO₂max', unit: '', dp: 1, upGood: true, sql: "SELECT AVG(value) AS v FROM wearable_readings WHERE metric='vo2_max' AND substr(measured_at,1,10) >= ? AND substr(measured_at,1,10) < ?" },
  { metric: 'Resting HR', unit: 'bpm', dp: 0, upGood: false, sql: "SELECT AVG(value) AS v FROM wearable_readings WHERE metric='resting_heart_rate' AND substr(measured_at,1,10) >= ? AND substr(measured_at,1,10) < ?" },
];

const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function computeProgress(): Record<ProgressPeriod, ProgressRow[]> {
  const db = getDb();
  const now = Date.now();
  const out = {} as Record<ProgressPeriod, ProgressRow[]>;

  for (const period of PERIODS) {
    const days = PERIOD_DAYS[period];
    const end = dayStr(now);
    const curStart = dayStr(now - days * 86_400_000);
    const prevStart = dayStr(now - 2 * days * 86_400_000);

    out[period] = METRICS.map((m) => {
      const stmt = db.prepare(m.sql);
      const cur = (stmt.get(curStart, end) as { v: number | null }).v;
      const prev = (stmt.get(prevStart, curStart) as { v: number | null }).v;
      const fmt = (n: number | null) => (n == null ? '—' : `${n.toFixed(m.dp)}${m.unit ? ` ${m.unit}` : ''}`);
      let delta = '—';
      let dir: 'up' | 'down' | 'flat' = 'flat';
      if (cur != null && prev != null) {
        const diff = cur - prev;
        const r = Number(diff.toFixed(m.dp));
        dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
        delta = `${r > 0 ? '+' : ''}${r}${m.unit ? ` ${m.unit}` : ''}`;
      }
      return { metric: m.metric, value: fmt(cur), prev: fmt(prev), delta, dir, upGood: m.upGood };
    });
  }
  return out;
}
