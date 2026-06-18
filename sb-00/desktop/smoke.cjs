/* Backend smoke test (plain Node). Stubs `electron` so the ingest modules load
   outside Electron, then exercises: DB seed, snapshot query, Apple Health push
   parsing, and Cronometer CSV parsing. Run: node desktop/smoke.cjs */
const Module = require('module');
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === 'electron') return { safeStorage: { isEncryptionAvailable: () => false } };
  return orig.call(this, req, ...a);
};

const assert = require('node:assert');
const { rmSync } = require('node:fs');
const DB = '/tmp/sb-smoke.db';
for (const ext of ['', '-wal', '-shm']) { try { rmSync(DB + ext); } catch {} }

const { openDb } = require('../dist-electron/desktop/db/index.js');
openDb(DB);
const { getSnapshot } = require('../dist-electron/desktop/db/queries.js');

let snap = getSnapshot();
assert.equal(snap.insights.length, 5, 'insights seeded');
assert.equal(snap.insights.filter((i) => i.severity === 'flag').length, 3, '3 flags');
assert.ok(snap.insights.find((i) => i.nodes.length > 1), 'has a cross-node insight');
assert.equal(snap.prLog.length, 4, '4 main lifts in PR log');
assert.ok(snap.prLog.find((p) => p.exercise === 'Squat' && p.status === 'NEW'), 'squat is a new PR');
assert.ok(snap.serum7d.length === 7 && snap.serum7d.every((s) => s.mg > 0), 'serum estimate computed');
assert.ok(snap.cardioGoal.target === 10 && snap.cardioGoal.longest === 7.2, 'cardio goal/longest');
assert.equal(snap.recentRuns.length, 4, 'recent runs');
console.log('✓ db seed + snapshot   (serum current', snap.serum7d.at(-1).mg + 'mg, longest run', snap.cardioGoal.longest + 'km)');

// --- Apple Health push ---
const { applyHealthExport } = require('../dist-electron/desktop/ingest/appleHealth.js');
const r = applyHealthExport({
  data: { metrics: [
    { name: 'heart_rate', units: 'count/min', data: [{ date: '2026-06-18 08:00:00 +0000', Avg: 58 }] },
    { name: 'dietary_energy', units: 'kcal', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 3010 }] },
    { name: 'protein', units: 'g', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 221 }] },
    { name: 'sodium', units: 'mg', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 4100 }] },
    { name: 'sleep_analysis', data: [{ date: '2026-06-18', sleepStart: '2026-06-17 22:30:00 +0000', sleepEnd: '2026-06-18 06:10:00 +0000', asleep: 7.3 }] },
  ] },
});
assert.ok(r.wearables >= 1 && r.nutritionDays >= 1 && r.sleep >= 1 && r.micros >= 1, 'apple health applied');
snap = getSnapshot();
assert.ok(snap.calories7d.find((c) => c.kcal === 3010), 'new dietary day in calories7d');
console.log('✓ apple health ingest  ', JSON.stringify(r));

// --- Cronometer CSV ---
const cron = require('../dist-electron/desktop/ingest/cronometer.js');
const csv = [
  'Date,Energy (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Sodium (mg),Vitamin D (IU),B12 (Cobalamin) (µg)',
  '2026-06-18,2790,208,295,84,29,3600,250,5.4',
  '2026-06-19,2655,199,288,80,33,2900,410,6.0',
].join('\n');
const days = cron.parseDailyNutrition(csv);
assert.equal(days.length, 2, 'parsed 2 cronometer days');
assert.equal(days[0].calories, 2790, 'cronometer calories parsed');
assert.equal(days[1].vitaminD, 410, 'cronometer vit D parsed');
const n = cron.writeDailyNutrition(days);
assert.equal(n, 2, 'wrote 2 cronometer days');
console.log('✓ cronometer csv parse + write  (2 days, source cronometer_direct)');

console.log('\nALL SMOKE CHECKS PASSED');
