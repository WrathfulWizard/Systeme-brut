import { getDb } from '../db/index';
import { setConnection } from '../db/queries';

/**
 * Apple Health ingestion — push, not pull.
 *
 * Apple exposes no server API; HealthKit data lives on the iPhone. The
 * sanctioned path is a phone-side bridge — the "Health Auto Export" app (or an
 * Apple Shortcut) — that POSTs a JSON payload to the local receiver on a
 * schedule. This module parses that payload.
 *
 * Cronometer rides this same pipeline: it syncs macros into Apple Health, so
 * dietary metrics arriving here are tagged source 'cronometer_via_apple_health'.
 *
 * Parsing is pure and unit-tested; the receiver (receiver.ts) hands raw bodies
 * to applyHealthExport().
 */

interface HAEPoint { date: string; qty?: number; Avg?: number; value?: number;
  asleep?: number; sleepStart?: string; sleepEnd?: string; source?: string; }
interface HAEMetric { name: string; units?: string; data: HAEPoint[]; }
interface HAEBody { data?: { metrics?: HAEMetric[] }; metrics?: HAEMetric[]; }

const WEARABLE_METRICS: Record<string, string> = {
  heart_rate: 'heart_rate',
  resting_heart_rate: 'resting_heart_rate',
  heart_rate_variability: 'hrv',
  blood_pressure_systolic: 'bp_systolic',
  blood_pressure_diastolic: 'bp_diastolic',
  respiratory_rate: 'respiratory_rate',
  blood_oxygen_saturation: 'spo2',
  step_count: 'steps',
  active_energy: 'active_energy',
  vo2_max: 'vo2_max',
};

// Apple Health dietary metric → micronutrient (nutrient, kind, unit, target)
const DIETARY_MICRO: Record<string, [string, string, string, number | null]> = {
  sodium: ['Sodium', 'electrolyte', 'mg', 2300],
  potassium: ['Potassium', 'electrolyte', 'mg', 3400],
  magnesium: ['Magnesium', 'mineral', 'mg', 400],
  calcium: ['Calcium', 'mineral', 'mg', 1000],
  vitamin_c: ['Vitamin C', 'vitamin', 'mg', 90],
  vitamin_d: ['Vitamin D', 'vitamin', 'IU', 600],
  vitamin_b12: ['Vitamin B12', 'vitamin', 'µg', 2.4],
  folate: ['Folate', 'vitamin', 'µg', 400],
};

/** Parse Health Auto Export dates: "YYYY-MM-DD HH:mm:ss +0000" or "YYYY-MM-DD". */
function parseDate(s: string): Date {
  let t = s.trim().replace(' ', 'T').replace(/\s*([+-]\d{2}):?(\d{2})$/, '$1:$2');
  let d = new Date(t);
  if (Number.isNaN(d.getTime())) d = new Date(s);
  return d;
}
const day = (s: string) => { const d = parseDate(s); return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10); };
const iso = (s: string) => { const d = parseDate(s); return Number.isNaN(d.getTime()) ? s : d.toISOString(); };
const val = (p: HAEPoint) => p.qty ?? p.Avg ?? p.value;

export interface ApplyResult { wearables: number; sleep: number; nutritionDays: number; micros: number; }

export function applyHealthExport(body: HAEBody, source = 'apple_health'): ApplyResult {
  const metrics = body.data?.metrics ?? body.metrics ?? [];
  const db = getDb();
  const res: ApplyResult = { wearables: 0, sleep: 0, nutritionDays: 0, micros: 0 };

  const upWear = db.prepare(`
    INSERT INTO wearable_readings (measured_at, metric, value, unit, device_source)
    VALUES (@at, @metric, @value, @unit, @src)
    ON CONFLICT(measured_at, metric, device_source) DO UPDATE SET value=excluded.value
  `);
  const upSleep = db.prepare(`
    INSERT INTO sleep_sessions (started_at, ended_at, duration_min, device_source)
    VALUES (@s, @e, @min, @src)
    ON CONFLICT(started_at, device_source) DO UPDATE SET ended_at=excluded.ended_at, duration_min=excluded.duration_min
  `);
  const dietaryDaily = new Map<string, { kcal?: number; p?: number; c?: number; f?: number; fb?: number }>();
  const upMicro = db.prepare(`
    INSERT INTO micronutrients (logged_on, nutrient, kind, amount, unit, target_amount, rda_pct, source)
    VALUES (@d, @n, @kind, @amt, @unit, @tgt, @rda, 'cronometer_via_apple_health')
    ON CONFLICT(logged_on, nutrient, source) DO UPDATE SET amount=excluded.amount, rda_pct=excluded.rda_pct
  `);

  const tx = db.transaction(() => {
    for (const m of metrics) {
      const name = m.name?.toLowerCase();
      if (!name || !Array.isArray(m.data)) continue;

      if (WEARABLE_METRICS[name]) {
        for (const p of m.data) {
          const v = val(p); if (v == null) continue;
          upWear.run({ at: iso(p.date), metric: WEARABLE_METRICS[name], value: v, unit: m.units ?? null, src: source });
          res.wearables++;
        }
      } else if (name === 'sleep_analysis') {
        for (const p of m.data) {
          if (!p.sleepStart || !p.sleepEnd) continue;
          const min = Math.round((p.asleep ?? 0) * 60) ||
            Math.round((new Date(iso(p.sleepEnd)).getTime() - new Date(iso(p.sleepStart)).getTime()) / 60000);
          upSleep.run({ s: iso(p.sleepStart), e: iso(p.sleepEnd), min, src: source });
          res.sleep++;
        }
      } else if (name === 'dietary_energy' || name === 'active_energy_dietary') {
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          const k = day(p.date); dietaryDaily.set(k, { ...dietaryDaily.get(k), kcal: v }); }
      } else if (name === 'protein') {
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          const k = day(p.date); dietaryDaily.set(k, { ...dietaryDaily.get(k), p: v }); }
      } else if (name === 'carbohydrates') {
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          const k = day(p.date); dietaryDaily.set(k, { ...dietaryDaily.get(k), c: v }); }
      } else if (name === 'total_fat' || name === 'fat_total') {
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          const k = day(p.date); dietaryDaily.set(k, { ...dietaryDaily.get(k), f: v }); }
      } else if (name === 'fiber' || name === 'dietary_fiber') {
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          const k = day(p.date); dietaryDaily.set(k, { ...dietaryDaily.get(k), fb: v }); }
      } else if (DIETARY_MICRO[name]) {
        const [nutrient, kind, unit, tgt] = DIETARY_MICRO[name];
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          upMicro.run({ d: day(p.date), n: nutrient, kind, amt: v, unit,
            tgt, rda: tgt && kind === 'vitamin' ? Math.round((v / tgt) * 100) : null });
          res.micros++;
        }
      }
    }

    if (dietaryDaily.size) {
      const upLog = db.prepare(`
        INSERT INTO nutrition_logs (logged_on, meal, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)
        VALUES (@d, NULL, @kcal, @p, @c, @f, @fb, 'cronometer_via_apple_health')
        ON CONFLICT(logged_on, meal, source) DO UPDATE SET
          calories_kcal=excluded.calories_kcal, protein_g=excluded.protein_g, carbs_g=excluded.carbs_g,
          fat_g=excluded.fat_g, fiber_g=excluded.fiber_g
      `);
      for (const [d, v] of dietaryDaily) {
        upLog.run({ d, kcal: v.kcal ?? null, p: v.p ?? null, c: v.c ?? null, f: v.f ?? null, fb: v.fb ?? null });
        res.nutritionDays++;
      }
    }
  });
  tx();

  setConnection('apple_health', { status: 'connected', detail: 'Receiving pushes', lastSyncAt: new Date().toISOString() });
  return res;
}
