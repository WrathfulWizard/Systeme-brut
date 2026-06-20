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

/** Normalize a metric name so HAE naming drift can't break the mapping:
 *  "dietary_vitamin_c" / "vitamin_c" / "Vitamin C" all collapse to "vitaminc". */
const norm = (s: string) => s.toLowerCase().replace(/^dietary_/, '').replace(/[^a-z0-9]/g, '');

// Macronutrients (normalized name → daily-log column). Cronometer Gold writes
// these into Apple Health, so the diet rides the same pipe as wearables.
const MACRO: Record<string, 'kcal' | 'p' | 'c' | 'f' | 'fb'> = {
  energy: 'kcal', activeenergydietary: 'kcal', calories: 'kcal',
  protein: 'p',
  carbohydrates: 'c', carbs: 'c', netcarbs: 'c',
  totalfat: 'f', fattotal: 'f', fat: 'f',
  fiber: 'fb',
};

// Bodyweight (Cronometer/scale → Apple Health). Drives the Substrate weight trend.
const WEIGHT_NAMES = new Set(['bodymass', 'weightbodymass', 'weight']);

// Full micronutrient set — normalized name → (nutrient, kind, unit, target).
// Labels mirror the Cronometer CSV path exactly so the two sources merge in the
// Substrate readout instead of showing duplicates.
const DIETARY_MICRO: Record<string, [string, string, string, number | null]> = {
  sodium: ['Sodium', 'electrolyte', 'mg', 2300],
  potassium: ['Potassium', 'electrolyte', 'mg', 3400],
  magnesium: ['Magnesium', 'mineral', 'mg', 400],
  calcium: ['Calcium', 'mineral', 'mg', 1000],
  iron: ['Iron', 'mineral', 'mg', 8],
  zinc: ['Zinc', 'mineral', 'mg', 11],
  phosphorus: ['Phosphorus', 'mineral', 'mg', 700],
  selenium: ['Selenium', 'mineral', 'µg', 55],
  copper: ['Copper', 'mineral', 'mg', 0.9],
  manganese: ['Manganese', 'mineral', 'mg', 2.3],
  vitamina: ['Vitamin A', 'vitamin', 'µg', 900],
  vitaminc: ['Vitamin C', 'vitamin', 'mg', 90],
  vitamind: ['Vitamin D', 'vitamin', 'IU', 600],
  vitamine: ['Vitamin E', 'vitamin', 'mg', 15],
  vitamink: ['Vitamin K', 'vitamin', 'µg', 120],
  thiamin: ['Thiamin (B1)', 'vitamin', 'mg', 1.2],
  riboflavin: ['Riboflavin (B2)', 'vitamin', 'mg', 1.3],
  niacin: ['Niacin (B3)', 'vitamin', 'mg', 16],
  vitaminb6: ['Vitamin B6', 'vitamin', 'mg', 1.7],
  vitaminb12: ['Vitamin B12', 'vitamin', 'µg', 2.4],
  folate: ['Folate', 'vitamin', 'µg', 400],
  saturatedfat: ['Saturated fat', 'fat', 'g', null],
  cholesterol: ['Cholesterol', 'fat', 'mg', null],
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

  // Import reasoning: a wearable reading is an IMMUTABLE point sample keyed by
  // its timestamp, so re-importing the trailing days (the hourly Health Auto
  // Export window) must only ADD genuinely-new samples, never rewrite existing
  // ones — INSERT OR IGNORE, and we count only the rows that were actually new.
  const upWear = db.prepare(`
    INSERT INTO wearable_readings (measured_at, metric, value, unit, device_source)
    VALUES (@at, @metric, @value, @unit, @src)
    ON CONFLICT(measured_at, metric, device_source) DO NOTHING
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
  const upBody = db.prepare(`
    INSERT INTO body_metrics (measured_on, weight_kg) VALUES (@d, @w)
    ON CONFLICT(measured_on) DO UPDATE SET weight_kg=COALESCE(excluded.weight_kg, weight_kg)
  `);

  const tx = db.transaction(() => {
    for (const m of metrics) {
      if (!m.name || !Array.isArray(m.data)) continue;
      const raw = m.name.toLowerCase();
      const n = norm(m.name);

      if (WEARABLE_METRICS[raw]) {
        for (const p of m.data) {
          const v = val(p); if (v == null) continue;
          const r = upWear.run({ at: iso(p.date), metric: WEARABLE_METRICS[raw], value: v, unit: m.units ?? null, src: source });
          if (r.changes > 0) res.wearables++;   // only count newly-added samples
        }
      } else if (raw === 'sleep_analysis') {
        for (const p of m.data) {
          if (!p.sleepStart || !p.sleepEnd) continue;
          const min = Math.round((p.asleep ?? 0) * 60) ||
            Math.round((new Date(iso(p.sleepEnd)).getTime() - new Date(iso(p.sleepStart)).getTime()) / 60000);
          upSleep.run({ s: iso(p.sleepStart), e: iso(p.sleepEnd), min, src: source });
          res.sleep++;
        }
      } else if (WEIGHT_NAMES.has(n)) {
        // Bodyweight from Cronometer/scale → drives the Substrate weight trend,
        // which is kg throughout — convert if the export reports pounds.
        const toKg = /lb|pound/i.test(m.units ?? '') ? 0.453592 : 1;
        for (const p of m.data) { const v0 = val(p); if (v0 == null) continue;
          const v = Math.round(v0 * toKg * 100) / 100;
          const r = upWear.run({ at: iso(p.date), metric: 'body_mass', value: v, unit: 'kg', src: source });
          upBody.run({ d: day(p.date), w: v });
          if (r.changes > 0) res.wearables++;   // only count newly-added samples
        }
      } else if (MACRO[n]) {
        const key = MACRO[n];
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          const k = day(p.date); dietaryDaily.set(k, { ...dietaryDaily.get(k), [key]: v }); }
      } else if (DIETARY_MICRO[n]) {
        const [nutrient, kind, unit, tgt] = DIETARY_MICRO[n];
        for (const p of m.data) { const v = val(p); if (v == null) continue;
          upMicro.run({ d: day(p.date), n: nutrient, kind, amt: v, unit,
            tgt, rda: tgt && kind !== 'electrolyte' && kind !== 'fat' ? Math.round((v / tgt) * 100) : null });
          res.micros++;
        }
      }
    }

    if (dietaryDaily.size) {
      // COALESCE so a later PARTIAL export (e.g. Apple Health synced calories but
      // not protein this hour) fills gaps instead of nulling out data already
      // logged for that day — additive, never destructive.
      const upLog = db.prepare(`
        INSERT INTO nutrition_logs (logged_on, meal, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)
        VALUES (@d, NULL, @kcal, @p, @c, @f, @fb, 'cronometer_via_apple_health')
        ON CONFLICT(logged_on, meal, source) DO UPDATE SET
          calories_kcal=COALESCE(excluded.calories_kcal, calories_kcal),
          protein_g=COALESCE(excluded.protein_g, protein_g),
          carbs_g=COALESCE(excluded.carbs_g, carbs_g),
          fat_g=COALESCE(excluded.fat_g, fat_g),
          fiber_g=COALESCE(excluded.fiber_g, fiber_g)
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
