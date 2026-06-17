/**
 * Systeme Brut — SB-00 data layer.
 *
 * For now this is a static module that mirrors supabase/seed.sql so the hub
 * renders real numbers before the live ingestion paths (Apple Health / Strava
 * webhooks → Supabase) are wired. When Supabase is connected, swap these
 * exports for queries against the v2 schema; the shapes are intentionally
 * close to the tables/views they come from.
 */

export type Severity = 'info' | 'flag';
export type NodeGroup = 'training' | 'pharmacology' | 'nutrition';

export interface Insight {
  id: number;
  at: string;          // 'HH:MM' or 'Yday' style label for the feed
  severity: Severity;
  body: string;
  nodes: NodeGroup[];  // derived from node_refs via node_of()
}

export const insights: Insight[] = [
  { id: 1, at: '10:05', severity: 'flag', nodes: ['nutrition', 'pharmacology'],
    body: "Sodium elevated 4th straight day. Cross-check against this week's BP readings." },
  { id: 2, at: '09:12', severity: 'flag', nodes: ['pharmacology'],
    body: 'ALT 24% over range, 9d into an oral. Suggest follow-up.' },
  { id: 3, at: '08:40', severity: 'flag', nodes: ['pharmacology'],
    body: 'HDL below range, third panel running.' },
  { id: 4, at: 'Yday', severity: 'info', nodes: ['training'],
    body: 'Squat tonnage trending up 3 weeks running.' },
  { id: 5, at: 'Yday', severity: 'info', nodes: ['nutrition'],
    body: 'Vitamin D trending down three weeks, consistent with reduced outdoor training.' },
];

export const isCrossNode = (i: Insight) => i.nodes.length > 1;
export const openFlags = () => insights.filter((i) => i.severity === 'flag');

/* ---- Node A: Iron & Asphalt --------------------------------------------- */

export const recentSets = [
  { date: '06.17', exercise: 'Squat', set: 'RP1',      weight: '140kg', reps: '5' },
  { date: '06.17', exercise: 'Squat', set: 'RP burst', weight: '140kg', reps: '3+2' },
  { date: '06.15', exercise: 'Bench', set: 'RP1',      weight: '100kg', reps: '6' },
  { date: '06.15', exercise: 'Bench', set: 'RP burst', weight: '100kg', reps: '3+2' },
];

export const prLog = [
  { exercise: 'Squat', prVolume: 8120, lastBeat: '06.17', status: 'NEW' },
  { exercise: 'Bench', prVolume: 6240, lastBeat: '06.10', status: '—' },
  { exercise: 'Row',   prVolume: 7480, lastBeat: '06.12', status: '—' },
  { exercise: 'OHP',   prVolume: 4310, lastBeat: '06.05', status: '—' },
];

export const tonnage = [
  { lift: 'SQUAT', value: 8120 },
  { lift: 'BENCH', value: 6240 },
  { lift: 'ROW',   value: 7480 },
  { lift: 'OHP',   value: 4310 },
];

export const cardioGoal = { metric: 'distance_km', target: 10, longest: 7.2, unit: 'km' };

export const cardioProgression = [
  { date: '06.06', distance: 5.0 },
  { date: '06.10', distance: 5.5 },
  { date: '06.13', distance: 6.0 },
  { date: '06.16', distance: 7.2 },
];

export const recentRuns = [
  { date: '06.16', distance: '7.2km', pace: '5:42/km', source: 'Strava' },
  { date: '06.13', distance: '6.0km', pace: '5:55/km', source: 'Strava' },
  { date: '06.10', distance: '5.5km', pace: '6:01/km', source: 'Strava' },
  { date: '06.06', distance: '5.0km', pace: '6:10/km', source: 'Strava' },
];

/* ---- Node B: Clinical Pharmacology -------------------------------------- */

export const regimen = [
  { compound: 'Testosterone Cyp', dose: '~14mg/day (micro)', route: 'IM' },
  { compound: 'Anavar',           dose: '20mg/day',          route: 'Oral' },
];

export const administrations = [
  { date: '06.17', compound: 'Testosterone Cyp', dose: '14mg', route: 'IM' },
  { date: '06.17', compound: 'Anavar',           dose: '20mg', route: 'Oral' },
  { date: '06.16', compound: 'Testosterone Cyp', dose: '14mg', route: 'IM' },
  { date: '06.16', compound: 'Anavar',           dose: '20mg', route: 'Oral' },
];

export const titration = [
  { date: '06.12', compound: 'Testosterone Cyp', change: '11mg → 14mg', trigger: 'Trough low-normal, progressing per plan' },
  { date: '05.20', compound: 'Anavar',           change: '10mg → 20mg', trigger: 'No ALT rise at 4wk check' },
];

export interface LabResult {
  marker: string; value: string; range: string; flagged: boolean;
}

export const labResults: LabResult[] = [
  { marker: 'GGT',        value: '42 U/L',   range: '8–61',  flagged: false },
  { marker: 'ALT',        value: '68 U/L',   range: '7–55',  flagged: true },
  { marker: 'HDL',        value: '31 mg/dL', range: '40–60', flagged: true },
  { marker: 'Hematocrit', value: '49%',      range: '38–50', flagged: false },
  { marker: 'Cystatin C', value: '0.91 mg/L', range: '0.6–1.0', flagged: false },
];

// Estimated serum — testosterone cyp decay, last 7d (materialized-view stand-in).
export const serum7d = [
  { day: 'MON', mg: 312 }, { day: 'TUE', mg: 286 }, { day: 'WED', mg: 264 },
  { day: 'THU', mg: 241 }, { day: 'FRI', mg: 219 }, { day: 'SAT', mg: 198 },
  { day: 'SUN', mg: 180 },
];

/* ---- Node C: Nutrition & Telemetry -------------------------------------- */

export const dailyTotals = [
  { nutrient: 'Calories', today: '2840 kcal', target: '2900 kcal', delta: '−60' },
  { nutrient: 'Protein',  today: '215g',      target: '200g',      delta: '+15' },
  { nutrient: 'Carbs',    today: '310g',      target: '320g',      delta: '−10' },
  { nutrient: 'Fat',      today: '88g',       target: '90g',       delta: '−2'  },
  { nutrient: 'Fiber',    today: '34g',       target: '30g',       delta: '+4'  },
];

export const calories7d = [
  { day: 'MON', kcal: 2640 }, { day: 'TUE', kcal: 2510 }, { day: 'WED', kcal: 2980 },
  { day: 'THU', kcal: 2860 }, { day: 'FRI', kcal: 3020 }, { day: 'SAT', kcal: 2750 },
  { day: 'SUN', kcal: 2840 },
];

export const vitamins = [
  { nutrient: 'Vitamin D',   amount: '9.2 µg', rda: '46%',  flagged: true },
  { nutrient: 'Vitamin B12', amount: '6.1 µg', rda: '254%', flagged: false },
  { nutrient: 'Vitamin C',   amount: '64 mg',  rda: '71%',  flagged: false },
  { nutrient: 'Folate',      amount: '280 µg', rda: '70%',  flagged: false },
];

export const minerals = [
  { mineral: 'Sodium',    amount: '3850 mg', target: '<2300 mg', flagged: true },
  { mineral: 'Potassium', amount: '3100 mg', target: '3400 mg',  flagged: false },
  { mineral: 'Magnesium', amount: '340 mg',  target: '400 mg',   flagged: false },
  { mineral: 'Calcium',   amount: '980 mg',  target: '1000 mg',  flagged: false },
  { mineral: 'Chloride',  amount: '2700 mg', target: '2300 mg',  flagged: false },
];

/* ---- session chrome ----------------------------------------------------- */
export const session = { id: 'SB-00', clock: '03:14:09' };
