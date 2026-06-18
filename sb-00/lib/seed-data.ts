import type { Snapshot } from './types';

/**
 * The seed snapshot — the mockup numbers, mirroring supabase/seed.sql and the
 * desktop SQLite seed. Used for first paint (before live IPC data resolves) and
 * as the fallback when the UI runs in a plain browser with no desktop backend.
 */
export const seedSnapshot: Snapshot = {
  insights: [
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
  ],
  recentSets: [
    { id: 1, date: '06.17', exercise: 'Squat', set: 'RP', weight: '140kg', reps: '12·5·3', iso: '2026-06-17', setKind: 'rp', weightKg: 140, repsN: 20, rpReps: [12, 5, 3] },
    { id: 2, date: '06.17', exercise: 'Leg Press', set: 'Widow', weight: '300kg', reps: '17/20', iso: '2026-06-17', setKind: 'widowmaker', weightKg: 300, repsN: 17, targetReps: 20, missedTarget: true },
    { id: 3, date: '06.15', exercise: 'Chest', set: 'Stretch', weight: '20kg', reps: '60s', iso: '2026-06-15', setKind: 'stretch', weightKg: 20, repsN: 0, seconds: 60 },
    { id: 4, date: '06.15', exercise: 'Bench', set: 'Straight', weight: '100kg', reps: '6', iso: '2026-06-15', setKind: 'straight', weightKg: 100, repsN: 6 },
  ],
  prLog: [
    { exercise: 'Squat', prVolume: 8120, lastBeat: '06.17', status: 'NEW' },
    { exercise: 'Bench', prVolume: 6240, lastBeat: '06.10', status: '—' },
    { exercise: 'Row', prVolume: 7480, lastBeat: '06.12', status: '—' },
    { exercise: 'OHP', prVolume: 4310, lastBeat: '06.05', status: '—' },
  ],
  tonnage: [
    { lift: 'SQUAT', value: 8120 }, { lift: 'BENCH', value: 6240 },
    { lift: 'ROW', value: 7480 }, { lift: 'OHP', value: 4310 },
  ],
  trainingStatus: {
    weeksSinceDeload: 3, deloadDue: false,
    weeklyTonnage: [
      { week: '2026-21', volume: 41200 }, { week: '2026-22', volume: 43800 },
      { week: '2026-23', volume: 45100 }, { week: '2026-24', volume: 46900 },
    ],
  },
  cardioGoal: { metric: 'distance_km', target: 10, longest: 7.2, unit: 'km' },
  cardioProgression: [
    { date: '06.06', distance: 5.0 }, { date: '06.10', distance: 5.5 },
    { date: '06.13', distance: 6.0 }, { date: '06.16', distance: 7.2 },
  ],
  recentRuns: [
    { date: '06.16', distance: '7.2km', pace: '5:42/km', source: 'Strava', sport: 'run' },
    { date: '06.14', distance: '32.0km', pace: '28.4 km/h', source: 'Strava', sport: 'ride' },
    { date: '06.13', distance: '6.0km', pace: '5:55/km', source: 'Strava', sport: 'run' },
    { date: '06.11', distance: '1.5km', pace: '1:58/100m', source: 'Strava', sport: 'swim' },
  ],
  cardioBySport: [
    { sport: 'run', count: 4, distanceKm: 23.7 },
    { sport: 'ride', count: 1, distanceKm: 32.0 },
    { sport: 'swim', count: 1, distanceKm: 1.5 },
  ],
  gear: [
    { id: 1, name: 'Nike Vaporfly 3', kind: 'shoe', km: 214.6, retired: false, source: 'strava' },
    { id: 2, name: 'Hoka Clifton 9', kind: 'shoe', km: 488.2, retired: false, source: 'strava' },
    { id: 3, name: 'Canyon Endurace', kind: 'bike', km: 1240.0, retired: false, source: 'strava' },
  ],
  protocols: [
    { id: 1, compound: 'Testosterone Cyp', dose: '14mg daily', route: 'IM', doseMg: 14, route_raw: 'IM', since: '05.01' },
    { id: 2, compound: 'Anavar', dose: '20mg daily', route: 'Oral', doseMg: 20, route_raw: 'oral', since: '05.20' },
  ],
  administrations: [
    { id: 1, date: '06.17', compound: 'Testosterone Cyp', dose: '14mg', route: 'IM', iso: '2026-06-17', doseMg: 14, routeRaw: 'IM' },
    { id: 2, date: '06.17', compound: 'Anavar', dose: '20mg', route: 'Oral', iso: '2026-06-17', doseMg: 20, routeRaw: 'oral' },
    { id: 3, date: '06.16', compound: 'Testosterone Cyp', dose: '14mg', route: 'IM', iso: '2026-06-16', doseMg: 14, routeRaw: 'IM' },
    { id: 4, date: '06.16', compound: 'Anavar', dose: '20mg', route: 'Oral', iso: '2026-06-16', doseMg: 20, routeRaw: 'oral' },
  ],
  titration: [
    { id: 1, date: '06.12', compound: 'Testosterone Cyp', change: '11mg → 14mg', trigger: 'Trough low-normal, progressing per plan' },
    { id: 2, date: '05.20', compound: 'Anavar', change: '10mg → 20mg', trigger: 'No ALT rise at 4wk check' },
  ],
  labResults: [
    { marker: 'GGT', value: '42 U/L', range: '8–61', flagged: false },
    { marker: 'ALT', value: '68 U/L', range: '7–55', flagged: true },
    { marker: 'HDL', value: '31 mg/dL', range: '40–60', flagged: true },
    { marker: 'Hematocrit', value: '49%', range: '38–50', flagged: false },
    { marker: 'Cystatin C', value: '0.91 mg/L', range: '0.6–1.0', flagged: false },
  ],
  serum7d: [
    { day: 'MON', mg: 312 }, { day: 'TUE', mg: 286 }, { day: 'WED', mg: 264 },
    { day: 'THU', mg: 241 }, { day: 'FRI', mg: 219 }, { day: 'SAT', mg: 198 }, { day: 'SUN', mg: 180 },
  ],
  serumByCompound: [
    { key: 'test_enan', label: 'TEST E', klass: 'Testosterone', color: '#6fc6d6', character: 'steady',
      halfLifeDays: 4.5, current: 312, peak: 312, steadyState: true, discontinued: false, form: 'injectable',
      series: [{ day: 'Mon', mg: 240 }, { day: 'Wed', mg: 270 }, { day: 'Fri', mg: 295 }, { day: 'Sun', mg: 312 }] },
    { key: 'mast_e', label: 'MAST E', klass: 'Drostanolone', color: '#c89b3a', character: 'confident',
      halfLifeDays: 5, current: 188, peak: 188, steadyState: true, discontinued: false, form: 'injectable',
      series: [{ day: 'Mon', mg: 150 }, { day: 'Wed', mg: 168 }, { day: 'Fri', mg: 180 }, { day: 'Sun', mg: 188 }] },
    { key: 'deca', label: 'DECA', klass: 'Nandrolone', color: '#cf7a2e', character: 'saturated',
      halfLifeDays: 7, current: 240, peak: 240, steadyState: false, discontinued: false, form: 'injectable',
      series: [{ day: 'Mon', mg: 180 }, { day: 'Wed', mg: 205 }, { day: 'Fri', mg: 226 }, { day: 'Sun', mg: 240 }] },
    { key: 'tren_a', label: 'TREN A', klass: 'Trenbolone', color: '#d23123', character: 'oscillating',
      halfLifeDays: 1, current: 96, peak: 110, steadyState: true, discontinued: false, form: 'injectable',
      series: [{ day: 'Mon', mg: 88 }, { day: 'Wed', mg: 104 }, { day: 'Fri', mg: 92 }, { day: 'Sun', mg: 96 }] },
  ],
  dailyTotals: [
    { nutrient: 'Calories', today: '2840 kcal', target: '2900 kcal', delta: '−60' },
    { nutrient: 'Protein', today: '215g', target: '200g', delta: '+15' },
    { nutrient: 'Carbs', today: '310g', target: '320g', delta: '−10' },
    { nutrient: 'Fat', today: '88g', target: '90g', delta: '−2' },
    { nutrient: 'Fiber', today: '34g', target: '30g', delta: '+4' },
  ],
  calories7d: [
    { day: 'MON', kcal: 2640 }, { day: 'TUE', kcal: 2510 }, { day: 'WED', kcal: 2980 },
    { day: 'THU', kcal: 2860 }, { day: 'FRI', kcal: 3020 }, { day: 'SAT', kcal: 2750 }, { day: 'SUN', kcal: 2840 },
  ],
  vitamins: [
    { nutrient: 'Vitamin D', amount: '9.2 µg', rda: '46%', flagged: true },
    { nutrient: 'Vitamin B12', amount: '6.1 µg', rda: '254%', flagged: false },
    { nutrient: 'Vitamin C', amount: '64 mg', rda: '71%', flagged: false },
    { nutrient: 'Folate', amount: '280 µg', rda: '70%', flagged: false },
  ],
  minerals: [
    { mineral: 'Sodium', amount: '3850 mg', target: '<2300 mg', flagged: true },
    { mineral: 'Potassium', amount: '3100 mg', target: '3400 mg', flagged: false },
    { mineral: 'Magnesium', amount: '340 mg', target: '400 mg', flagged: false },
    { mineral: 'Calcium', amount: '980 mg', target: '1000 mg', flagged: false },
    { mineral: 'Chloride', amount: '2700 mg', target: '2300 mg', flagged: false },
  ],
  weightGoal: {
    current: 89.4, target: 86, unit: 'kg',
    trend: [{ day: '06.11', kg: 90.4 }, { day: '06.13', kg: 90.1 }, { day: '06.15', kg: 89.7 }, { day: '06.17', kg: 89.4 }],
  },
  session: { id: 'SB-00', clock: '03:14:09' },
  syncMeta: { connections: [
    { source: 'strava', status: 'disconnected' },
    { source: 'cronometer', status: 'disconnected' },
    { source: 'apple_health', status: 'disconnected' },
  ] },
  catalog: {
    exercises: ['Squat', 'Bench', 'Row', 'OHP'],
    compounds: ['Testosterone Cyp', 'Anavar'],
  },
};
