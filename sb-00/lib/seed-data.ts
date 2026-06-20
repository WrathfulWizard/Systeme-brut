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
  progress: (() => {
    const rows = [
      { metric: 'Bodyweight', value: '89.4 kg', prev: '90.6 kg', delta: '-1.2 kg', dir: 'down' as const, upGood: true },
      { metric: 'Body fat', value: '12.5 %', prev: '13.6 %', delta: '-1.1 %', dir: 'down' as const, upGood: false },
      { metric: 'Waist', value: '81.0 cm', prev: '82.5 cm', delta: '-1.5 cm', dir: 'down' as const, upGood: false },
      { metric: 'Tonnage', value: '46900 kg', prev: '45100 kg', delta: '+1800 kg', dir: 'up' as const, upGood: true },
      { metric: 'Protein', value: '212 g/d', prev: '205 g/d', delta: '+7 g/d', dir: 'up' as const, upGood: true },
      { metric: 'VO₂max', value: '52.4', prev: '51.1', delta: '+1.3', dir: 'up' as const, upGood: true },
      { metric: 'Resting HR', value: '48 bpm', prev: '50 bpm', delta: '-2 bpm', dir: 'down' as const, upGood: false },
    ];
    return { W: rows, M: rows, '3M': rows, '6M': rows, Y: rows };
  })(),
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
  cardioWeekly: [
    { date: '05.18', distance: 18.2 }, { date: '05.25', distance: 21.0 },
    { date: '06.01', distance: 22.6 }, { date: '06.08', distance: 24.7 },
  ],
  cardioMonthly: [
    { date: '03.01', distance: 64 }, { date: '04.01', distance: 78 },
    { date: '05.01', distance: 86 }, { date: '06.01', distance: 71 },
  ],
  cardioHealth: {
    vo2max: 52.4, restingHr: 48, hrv: 78, heartRate: 61,
    vo2Trend: [{ date: '04.01', value: 49.8 }, { date: '05.01', value: 51.1 }, { date: '06.01', value: 52.4 }],
    rhrTrend: [{ date: '04.01', value: 52 }, { date: '05.01', value: 50 }, { date: '06.01', value: 48 }],
    hrTrend: [{ date: '04.01', value: 64 }, { date: '05.01', value: 62 }, { date: '06.01', value: 61 }],
  },
  heartRate: {
    current: 61, resting: 48, updatedAt: '2026-06-20T07:00:00.000Z',
    hourly: [
      { label: '00:00', value: 53, min: 49, max: 58 }, { label: '01:00', value: 51, min: 48, max: 55 },
      { label: '02:00', value: 50, min: 47, max: 54 }, { label: '03:00', value: 49, min: 46, max: 53 },
      { label: '04:00', value: 50, min: 47, max: 55 }, { label: '05:00', value: 52, min: 48, max: 57 },
      { label: '06:00', value: 58, min: 51, max: 66 }, { label: '07:00', value: 64, min: 55, max: 78 },
      { label: '08:00', value: 72, min: 60, max: 96 }, { label: '09:00', value: 78, min: 62, max: 121 },
      { label: '10:00', value: 69, min: 58, max: 104 }, { label: '11:00', value: 66, min: 57, max: 88 },
      { label: '12:00', value: 71, min: 59, max: 99 }, { label: '13:00', value: 68, min: 58, max: 92 },
      { label: '14:00', value: 65, min: 56, max: 84 }, { label: '15:00', value: 67, min: 57, max: 90 },
      { label: '16:00', value: 74, min: 60, max: 112 }, { label: '17:00', value: 88, min: 64, max: 148 },
      { label: '18:00', value: 96, min: 68, max: 162 }, { label: '19:00', value: 79, min: 62, max: 118 },
      { label: '20:00', value: 68, min: 58, max: 86 }, { label: '21:00', value: 62, min: 55, max: 74 },
      { label: '22:00', value: 57, min: 52, max: 64 }, { label: '23:00', value: 54, min: 50, max: 60 },
    ],
    ranges: {
      W: [
        { label: '06.14', value: 64, min: 47, max: 154 }, { label: '06.15', value: 62, min: 46, max: 138 },
        { label: '06.16', value: 66, min: 48, max: 161 }, { label: '06.17', value: 63, min: 47, max: 142 },
        { label: '06.18', value: 61, min: 46, max: 133 }, { label: '06.19', value: 65, min: 48, max: 157 },
        { label: '06.20', value: 60, min: 45, max: 121 },
      ],
      M: Array.from({ length: 30 }, (_, i) => ({
        label: `0${5 + Math.floor((i + 22) / 31)}.${String(((i + 21) % 31) + 1).padStart(2, '0')}`,
        value: 60 + Math.round(6 * Math.sin(i / 3)), min: 45 + (i % 4), max: 130 + (i % 7) * 5,
      })),
      '3M': Array.from({ length: 13 }, (_, i) => ({ label: `0${4 + Math.floor(i / 5)}.0${(i % 5) + 1}`, value: 62 + Math.round(4 * Math.sin(i / 2)), min: 46, max: 140 + i })),
      '6M': Array.from({ length: 13 }, (_, i) => ({ label: `0${1 + Math.floor(i / 2)}.1${i % 2}`, value: 63 + Math.round(5 * Math.cos(i / 2)), min: 47, max: 145 })),
      Y: Array.from({ length: 12 }, (_, i) => ({ label: `25.${String(i + 7).padStart(2, '0')}`.replace('25.13', '26.01'), value: 64 + Math.round(4 * Math.sin(i)), min: 46, max: 150 })),
    },
  },
  gear: [
    { id: 1, name: 'Nike Vaporfly 3', kind: 'shoe', km: 214.6, retired: false, source: 'strava' },
    { id: 2, name: 'Hoka Clifton 9', kind: 'shoe', km: 488.2, retired: false, source: 'strava' },
    { id: 3, name: 'Canyon Endurace', kind: 'bike', km: 1240.0, retired: false, source: 'strava' },
  ],
  protocols: [
    { id: 1, compound: 'Testosterone Cyp', dose: '14mg daily', route: 'IM', doseMg: 14, route_raw: 'IM', since: '05.01', form: 'injectable' },
    { id: 2, compound: 'Anavar', dose: '20mg daily', route: 'Oral', doseMg: 20, route_raw: 'oral', since: '05.20', form: 'oral' },
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
  caloriesByWeek: [
    { day: '05.04', kcal: 2710 }, { day: '05.11', kcal: 2680 }, { day: '05.18', kcal: 2760 },
    { day: '05.25', kcal: 2820 }, { day: '06.01', kcal: 2790 }, { day: '06.08', kcal: 2860 },
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
    { mineral: 'Iron', amount: '14 mg', target: '8 mg', flagged: false },
    { mineral: 'Zinc', amount: '12 mg', target: '11 mg', flagged: false },
  ],
  essentialFats: [
    { mineral: 'Omega-3', amount: '1.2 g', target: '1.6 g', flagged: true },
    { mineral: 'Omega-6', amount: '14 g', target: '17 g', flagged: false },
    { mineral: 'Saturated fat', amount: '28 g', target: '—', flagged: false },
    { mineral: 'Cholesterol', amount: '410 mg', target: '—', flagged: false },
  ],
  bodyComposition: [
    { id: 1, date: '06.17', iso: '2026-06-17', weightKg: 89.4, bodyFatPct: 12.5, chestCm: 108, armCm: 41.5, thighCm: 62, waistCm: 81 },
    { id: 2, date: '06.10', iso: '2026-06-10', weightKg: 90.1, bodyFatPct: 13.1, chestCm: 108, armCm: 41.2, thighCm: 61.5, waistCm: 82 },
    { id: 3, date: '06.03', iso: '2026-06-03', weightKg: 90.6, bodyFatPct: 13.6, chestCm: 107, armCm: 41, thighCm: 61, waistCm: 82.5 },
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
