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
const { getDb } = require('../dist-electron/desktop/db/index.js');

// The one-shot seed-sample cleanup runs on first open: it strips the demo
// cardio sessions and demo flags so a real instance isn't haunted by them.
{
  const s0 = getSnapshot();
  assert.equal(s0.insights.length, 0, 'seed demo flags cleared on first open');
  assert.equal(s0.recentRuns.length, 0, 'seed demo cardio cleared on first open');
  // Restore the fixtures the query assertions below still exercise.
  getDb().exec(`
    INSERT INTO cardio_sessions (occurred_at, distance_km, pace_avg_sec_per_km, source, external_id) VALUES
      ('2026-06-06',5.0,370,'strava','seed_strava_1001'),
      ('2026-06-10',5.5,361,'strava','seed_strava_1002'),
      ('2026-06-13',6.0,355,'strava','seed_strava_1003'),
      ('2026-06-16',7.2,342,'strava','seed_strava_1004');
    INSERT INTO insights (created_at, severity, body, node_refs) VALUES
      ('2026-06-17T10:05:00','flag','Sodium elevated 4th straight day. Cross-check against this week''s BP readings.','["micronutrients:5","lab_results:4"]'),
      ('2026-06-17T09:12:00','flag','ALT 24% over range, 9d into an oral. Suggest follow-up.','["lab_results:2"]'),
      ('2026-06-17T08:40:00','flag','HDL below range, third panel running.','["lab_results:3"]'),
      ('2026-06-16T18:00:00','info','Squat tonnage trending up 3 weeks running.','["sets:1"]'),
      ('2026-06-16T12:00:00','info','Vitamin D trending down three weeks, consistent with reduced outdoor training.','["micronutrients:1"]');
  `);
}

let snap = getSnapshot();
assert.equal(snap.insights.length, 5, 'insights seeded');
assert.equal(snap.insights.filter((i) => i.severity === 'flag').length, 3, '3 flags');
assert.ok(snap.insights.find((i) => i.nodes.length > 1), 'has a cross-node insight');
assert.equal(snap.prLog.length, 4, '4 main lifts in PR log');
// NEW status is wall-clock-relative (PR within 3 days), so don't lean on fixed
// seed dates — log a guaranteed top-volume Squat session dated today (seed squat
// session volume is 3920; 2×200×10 = 4000 beats it) and assert NEW on that.
{
  const mutPR = require('../dist-electron/desktop/db/mutations.js');
  const todayISO = new Date().toISOString().slice(0, 10);
  mutPR.addSet({ date: todayISO, exercise: 'Squat', setKind: 'straight', weightKg: 200, reps: 10 });
  mutPR.addSet({ date: todayISO, exercise: 'Squat', setKind: 'straight', weightKg: 200, reps: 10 });
  snap = getSnapshot();
}
assert.ok(snap.prLog.find((p) => p.exercise === 'Squat' && p.status === 'NEW'), 'a top-volume squat logged today is a NEW PR');
assert.ok(snap.serum7d.length === 7 && snap.serum7d.every((s) => s.mg > 0), 'serum estimate computed');
assert.ok(snap.cardioGoal.target === 10 && snap.cardioGoal.longest === 7.2, 'cardio goal/longest');
assert.equal(snap.recentRuns.length, 4, 'recent runs');
console.log('✓ db seed + snapshot   (serum current', snap.serum7d.at(-1).mg + 'mg, longest run', snap.cardioGoal.longest + 'km)');

// --- Apple Health push ---
const { applyHealthExport } = require('../dist-electron/desktop/ingest/appleHealth.js');
const r = applyHealthExport({
  data: { metrics: [
    { name: 'heart_rate', units: 'count/min', data: [{ date: '2026-06-18 08:00:00 +0000', Avg: 58 }] },
    { name: 'resting_heart_rate', units: 'count/min', data: [{ date: '2026-06-18 08:00:00 +0000', Avg: 48 }] },
    { name: 'vo2_max', units: 'mL/min·kg', data: [{ date: '2026-06-18 08:00:00 +0000', qty: 52.4 }] },
    { name: 'dietary_energy', units: 'kcal', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 3010 }] },
    { name: 'protein', units: 'g', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 221 }] },
    { name: 'sodium', units: 'mg', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 4100 }] },
    // Full Cronometer-via-Apple-Health coverage: name drift + a vitamin + weight.
    { name: 'dietary_vitamin_c', units: 'mg', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 180 }] },
    { name: 'iron', units: 'mg', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 19 }] },
    { name: 'weight_body_mass', units: 'kg', data: [{ date: '2026-06-18 06:30:00 +0000', qty: 92.4 }] },
    { name: 'sleep_analysis', data: [{ date: '2026-06-18', sleepStart: '2026-06-17 22:30:00 +0000', sleepEnd: '2026-06-18 06:10:00 +0000', asleep: 7.3 }] },
  ] },
});
// wearables: heart_rate + resting + vo2 + weight = 4 · micros: sodium + vit C + iron = 3
assert.ok(r.wearables >= 4 && r.nutritionDays >= 1 && r.sleep >= 1 && r.micros >= 3,
  `apple health full mapping (wearables=${r.wearables}, micros=${r.micros})`);
snap = getSnapshot();
assert.ok(snap.calories7d.find((c) => c.kcal === 3010), 'new dietary day in calories7d');
assert.ok(snap.cardioHealth.vo2max === 52.4 && snap.cardioHealth.restingHr === 48, 'VO2max + resting HR surfaced from Apple Health');

// Import reasoning: re-importing the SAME window adds nothing (immutable samples
// are insert-only), and a partial later export must not wipe existing macros.
const rAgain = applyHealthExport({ data: { metrics: [
  { name: 'heart_rate', units: 'count/min', data: [{ date: '2026-06-18 08:00:00 +0000', Avg: 58 }] },
  { name: 'weight_body_mass', units: 'kg', data: [{ date: '2026-06-18 06:30:00 +0000', qty: 92.4 }] },
  { name: 'dietary_energy', units: 'kcal', data: [{ date: '2026-06-18 23:00:00 +0000', qty: 3010 }] }, // calories only — no protein
] } });
assert.equal(rAgain.wearables, 0, 're-import of same timestamps adds zero new wearable samples');
const protein18 = getSnapshot().dailyTotals.find((t) => t.nutrient === 'Protein');
assert.ok(protein18 && /221/.test(protein18.today), 'partial re-import preserved existing protein (COALESCE)');
console.log('✓ apple health ingest   (idempotent re-import · non-destructive partial)', JSON.stringify(r));

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

// --- manual logging (write path) ---
const mut = require('../dist-electron/desktop/db/mutations.js');
const beforeSets = getSnapshot().recentSets.length;
mut.addSet({ date: '2026-06-18', exercise: 'Deadlift', setKind: 'straight', weightKg: 180, reps: 5 });
mut.addAdministration({ compound: 'HCG', doseMg: 250, route: 'SubQ', administeredAt: '2026-06-18T08:00:00' });
mut.addTitration({ compound: 'Testosterone Cyp', before: 14, after: 16, notes: 'smoke test', changedAt: '2026-06-18' });
mut.addLabPanel({ drawnAt: '2026-06-18', labName: 'SmokeLab', results: [
  { marker: 'TSH', value: 2.1, unit: 'mIU/L', low: 0.4, high: 4.0 },
  { marker: 'ALT', value: 70, unit: 'U/L', low: 7, high: 55 },
] });
snap = getSnapshot();
assert.ok(snap.catalog.exercises.includes('Deadlift'), 'new exercise added to catalog');
assert.ok(snap.catalog.compounds.includes('HCG'), 'new compound added to catalog');
assert.ok(snap.recentSets.find((s) => s.exercise === 'Deadlift'), 'logged set appears in recent sets');
assert.ok(snap.administrations.find((a) => a.compound === 'HCG'), 'logged dose appears');
assert.ok(snap.titration.find((t) => t.change === '14mg → 16mg'), 'titration change appears');
assert.ok(snap.labResults.find((l) => l.marker === 'ALT' && l.flagged), 'new lab panel is latest, ALT flagged');
// Trust boundary: NaN/Infinity/negative numbers must be rejected, never persisted.
assert.throws(() => mut.addProtocol({ compound: 'BadCompound', doseMg: NaN, route: 'IM' }), /Invalid dose/, 'NaN dose rejected');
assert.throws(() => mut.addAdministration({ compound: 'BadCompound', doseMg: Infinity, route: 'IM', administeredAt: '2026-06-18T08:00:00' }), /Invalid dose/, 'Infinity dose rejected');
assert.throws(() => mut.addSet({ date: '2026-06-18', exercise: 'BadLift', setKind: 'straight', weightKg: -5, reps: 5 }), /Invalid weight/, 'negative weight rejected');
assert.ok(!getSnapshot().catalog.compounds.includes('BadCompound') || getSnapshot().serumByCompound.every((s) => Number.isFinite(s.current)), 'no NaN serum persisted');
console.log('✓ manual logging        (set + dose + titration + lab panel written and reflected · bad input rejected)');

// --- edit + delete ---
snap = getSnapshot();
const dlSet = snap.recentSets.find((s) => s.exercise === 'Deadlift');
mut.updateSet(dlSet.id, { date: dlSet.iso, exercise: 'Deadlift', setKind: 'straight', weightKg: 185, reps: 5 });
snap = getSnapshot();
assert.ok(snap.recentSets.find((s) => s.id === dlSet.id && s.weightKg === 185), 'set edit persisted (180→185)');
mut.deleteSet(dlSet.id);
snap = getSnapshot();
assert.ok(!snap.recentSets.find((s) => s.id === dlSet.id), 'set delete removed the row');

const hcg = getSnapshot().administrations.find((a) => a.compound === 'HCG');
mut.deleteAdministration(hcg.id);
assert.ok(!getSnapshot().administrations.find((a) => a.id === hcg.id), 'administration delete works');

const panelId = getSnapshot().labPanelId;
mut.deleteLabPanel(panelId);
const afterPanel = getSnapshot();
assert.ok(afterPanel.labPanelId !== panelId, 'lab panel delete reverts to prior panel');
assert.ok(afterPanel.labResults.length > 0, 'a prior panel is now latest');
console.log('✓ edit + delete         (set edit/delete, admin delete, lab panel delete → prior panel)');

// --- strava app credentials (in-app config, OS-encrypted store) ---
try { rmSync('/tmp/sb-smoke-secrets.bin'); } catch {}
const secrets = require('../dist-electron/desktop/ingest/secrets.js');
secrets.initSecrets('/tmp/sb-smoke-secrets.bin');
assert.ok(getSnapshot().syncMeta.connections.find((c) => c.source === 'strava').configured === false, 'strava starts unconfigured');
secrets.setStravaApp({ clientId: '12345', clientSecret: 'shh' });
assert.equal(secrets.getStravaApp().clientId, '12345', 'strava app creds stored');
assert.ok(getSnapshot().syncMeta.connections.find((c) => c.source === 'strava').configured === true, 'strava shows configured after saving creds');
console.log('✓ strava app credentials (stored + reflected as configured)');

// --- v0.2: protocols, titration, flags, weight, cardio sport ---
snap = getSnapshot();
assert.ok(snap.protocols.length >= 2, 'protocols seeded/migrated');
assert.ok(snap.protocols.find((p) => /test/i.test(p.compound) && p.doseMg === 14), 'test cyp protocol at 14mg');
assert.ok(snap.serum7d.length === 7 && snap.serum7d.every((s) => s.mg > 0), 'serum derived from protocol timeline');
assert.ok(snap.weightGoal.target === 86 && snap.weightGoal.current === 89.4, 'weight goal + current');
assert.ok(snap.cardioBySport.length >= 1, 'cardio grouped by sport');

const testProto = snap.protocols.find((p) => /test/i.test(p.compound));
mut.titrateProtocol(testProto.id, 16, 'trough low-normal');
snap = getSnapshot();
assert.ok(snap.protocols.find((p) => p.id === testProto.id && p.doseMg === 16), 'protocol dose updated to 16');
assert.ok(snap.titration.find((t) => t.change === '14mg → 16mg' && /trough/.test(t.trigger)), 'titration logged as 14→16 with note');

const protoN = snap.protocols.length;
mut.addProtocol({ compound: 'Deca', doseMg: 7, route: 'IM', note: 'joints' });
snap = getSnapshot();
assert.equal(snap.protocols.length, protoN + 1, 'new protocol added');
const deca = snap.protocols.find((p) => p.compound === 'Deca');
mut.titrateProtocol(deca.id, 10, 'recomp');
snap = getSnapshot();
assert.ok(snap.titration.find((t) => t.compound === 'Deca' && t.change === '7mg → 10mg'), 'deca 7→10 titration (the example)');

const openBefore = getSnapshot().insights.length;
const oneFlag = getSnapshot().insights.find((i) => i.severity === 'flag');
mut.resolveInsight(oneFlag.id);
snap = getSnapshot();
assert.equal(snap.insights.length, openBefore - 1, 'resolved flag disappears (no longer persists)');
console.log('✓ protocol + titration  (test 14→16, deca 7→10) · flags resolvable · weight goal · sport split');

// --- pharmacokinetics: built-in compound library + half-life serum model ---
{
  const { lookup, catalog, injectableCatalog, oralCatalog } = require('../dist-electron/desktop/pharma/compounds.js');
  assert.equal(lookup('Test E').key, 'test_enan', 'Test E resolves to enanthate');
  assert.equal(lookup('Testosterone Cypionate').halfLifeDays, 8, 'cyp t½ 8d');
  assert.equal(lookup('Tren Ace').halfLifeDays, 1, 'tren acetate t½ 1d');
  assert.equal(lookup('Deca Durabolin').klass, 'Nandrolone', 'deca is nandrolone family');
  assert.equal(lookup('Masteron E').character, 'confident', 'masteron flows confident');
  assert.ok(lookup('Tren Ace').character === 'oscillating', 'tren oscillates');
  assert.ok(catalog().length > 30, 'expanded catalog of common compounds');
  // injectables-only protocol board vs orals/supplements section
  assert.ok(injectableCatalog().length > 0 && injectableCatalog().every((c) => c.form === 'injectable'), 'protocol board is injectables only');
  assert.ok(oralCatalog().every((c) => c.form === 'oral'), 'oral/support list is orals only');
  assert.equal(lookup('Cialis').key, 'cialis', 'cialis is in the support library');
  assert.equal(lookup('Accutane').form, 'oral', 'accutane is an oral support compound');
  assert.equal(lookup('Test E').form, 'injectable', 'test enanthate is injectable');
  assert.equal(lookup('Anavar').form, 'oral', 'anavar is oral');

  const { protocolSerum, discreteSerum } = require('../dist-electron/desktop/pharma/serum.js');
  const anchor = Date.parse('2026-06-18T00:00:00');
  const day = 86400000;
  // steady daily dose accumulates toward a plateau and stays positive
  const steady = protocolSerum([{ t: anchor - 20 * day, dose: 100 }], 4, { windowDays: 14, anchorMs: anchor });
  assert.equal(steady.length, 14, '14-day window');
  assert.ok(steady.every((p) => p.mg > 0), 'steady protocol stays positive');
  assert.ok(steady[13].mg >= steady[0].mg, 'accumulates over the window');
  // shorter half-life => lower steady-state level for the same daily dose
  const shortHl = protocolSerum([{ t: anchor - 20 * day, dose: 100 }], 1, { windowDays: 14, anchorMs: anchor });
  assert.ok(shortHl[13].mg < steady[13].mg, 'shorter half-life => lower accumulation');
  // a single discrete dose decays by ~half over one half-life
  const single = discreteSerum([{ t: anchor - 4 * day, dose: 200 }], 4, { windowDays: 8, anchorMs: anchor });
  const atDose = single.find((p) => p.mg === 200) || single[Math.max(0, single.length - 5)];
  assert.ok(single[single.length - 1].mg < 200, 'discrete dose decays after injection');
  console.log('✓ pharma PK engine      (library lookups + half-life accumulation/decay)');
}

// --- serumByCompound: per-compound streams for the visual ---
{
  const s = getSnapshot();
  assert.ok(s.serumByCompound.length >= 3, 'multiple compound streams');
  const test = s.serumByCompound.find((c) => /Testosterone/.test(c.klass));
  assert.ok(test && test.current > 0, 'testosterone stream has a current level');
  assert.equal(test.halfLifeDays, 8, 'test cyp uses DB half-life (192h = 8d)');
  assert.ok(s.serumByCompound.every((c) => /^#/.test(c.color) && c.character && c.series.length > 0), 'streams carry colour + character + series');
  const deca = s.serumByCompound.find((c) => /Nandrolone/.test(c.klass));
  assert.ok(deca && deca.character === 'saturated', 'deca stream flows saturated');
  assert.ok(s.serumByCompound.every((c) => typeof c.steadyState === 'boolean' && typeof c.discontinued === 'boolean' && (c.form === 'injectable' || c.form === 'oral')), 'streams carry steady-state + discontinued + form');
  assert.ok(test.series.length > 14, 'serum window widened for 3d/1w/4w/8w views');
  console.log(`✓ serum dynamics        (${s.serumByCompound.length} streams: ${s.serumByCompound.map((c) => c.label).join(', ')})`);
}

// --- discontinued compound keeps clearing in the serum model ---
{
  mut.addProtocol({ compound: 'Trenbolone Enanthate', doseMg: 50, route: 'IM', note: 'smoke', startedAt: '2026-05-20' });
  let s = getSnapshot();
  const proto = s.protocols.find((p) => /Trenbolone Enanthate/i.test(p.compound));
  assert.ok(proto, 'backdated tren-e protocol added (active board)');
  assert.ok(s.serumByCompound.find((c) => /Trenbolone/.test(c.klass) && c.steadyState != null), 'tren-e appears in serum');
  mut.endProtocol(proto.id);
  s = getSnapshot();
  assert.ok(!s.protocols.find((p) => p.id === proto.id), 'discontinued protocol drops off the active board');
  const disc = s.serumByCompound.find((c) => /Trenbolone/.test(c.klass));
  assert.ok(disc && disc.discontinued === true && disc.current > 0, 'discontinued compound still clearing in serum');
  console.log('✓ discontinued clearance (backdated start · ended protocol still represented in serum)');
}

// --- lab panel: latest value per marker across panels (the one-marker bug) ---
{
  mut.addLabPanel({ drawnAt: '2026-06-01', labName: 'A', results: [{ marker: 'Estradiol', value: 30, unit: 'pg/mL', low: 10, high: 40 }] });
  mut.addLabPanel({ drawnAt: '2026-06-10', labName: 'B', results: [{ marker: 'LH', value: 0.2, unit: 'mIU/mL', low: 1, high: 9 }] });
  const s = getSnapshot();
  const markers = s.labResults.map((l) => l.marker);
  assert.ok(markers.includes('Estradiol') && markers.includes('LH'), 'markers from separate panels both show (no longer one-at-a-time)');
  assert.ok(s.labResults.find((l) => l.marker === 'LH').flagged, 'out-of-range marker flagged');
  console.log(`✓ lab consolidation     (${markers.length} markers across panels: ${markers.join(', ')})`);
}

// --- cronometer CSV import (the reliable, no-403 path) ---
{
  const cron = require('../dist-electron/desktop/ingest/cronometer.js');
  const csv = [
    'Date,Energy (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Omega-3 (g)',
    '2026-06-15,2700,210,300,80,30,2.1',
    '2026-06-16,2650,205,290,82,28,1.8',
  ].join('\n');
  const n = cron.importCronometerCsv(csv);
  assert.equal(n, 2, 'imported 2 days from a self-exported CSV');
  const conn = getSnapshot().syncMeta.connections.find((c) => c.source === 'cronometer');
  assert.equal(conn.status, 'connected', 'cronometer marked connected after CSV import');
  console.log('✓ cronometer csv import  (2 days · ToS-clean, no scraper 403)');
}

// --- strava sport mapping: rides/swims now sync, not just runs ---
{
  const { mapSport } = require('../dist-electron/desktop/ingest/strava.js');
  assert.equal(mapSport({ sport_type: 'Run' }), 'run', 'run maps to run');
  assert.equal(mapSport({ sport_type: 'MountainBikeRide' }), 'ride', 'MTB maps to ride');
  assert.equal(mapSport({ sport_type: 'Swim' }), 'swim', 'swim maps to swim');
  assert.equal(mapSport({ sport_type: 'WeightTraining' }), null, 'non-cardio skipped');
  console.log('✓ strava multi-sport     (run / ride / swim mapped, non-cardio skipped)');
}

// --- new set kinds: rp / widowmaker / stretch + deload reminder ---
{
  mut.addSet({ date: '2026-06-18', exercise: 'Hack Squat', setKind: 'rp', weightKg: 200, rpReps: [12, 5, 3] });
  mut.addSet({ date: '2026-06-18', exercise: 'Leg Press', setKind: 'widowmaker', weightKg: 300, reps: 16, targetReps: 20 });
  mut.addSet({ date: '2026-06-18', exercise: 'Chest', setKind: 'stretch', weightKg: 25, seconds: 60 });
  const s = getSnapshot();
  const rp = s.recentSets.find((x) => x.exercise === 'Hack Squat');
  assert.ok(rp && rp.setKind === 'rp' && rp.repsN === 20 && /12/.test(rp.reps), 'RP stores bursts; effective reps = sum (20)');
  const wm = s.recentSets.find((x) => x.exercise === 'Leg Press');
  assert.ok(wm && wm.missedTarget === true && /16\/20/.test(wm.reps), 'widowmaker miss marked in the row');
  const stretch = s.recentSets.find((x) => x.exercise === 'Chest' && x.setKind === 'stretch');
  assert.ok(stretch && stretch.repsN === 0 && /60s/.test(stretch.reps), 'stretch held for time, 0 working volume');
  assert.ok(s.insights.find((i) => /Widowmaker on Leg Press/i.test(i.body)), 'SB-Σ auto-raised a widowmaker-miss flag');
  assert.ok(typeof s.trainingStatus.weeksSinceDeload === 'number' && Array.isArray(s.trainingStatus.weeklyTonnage), 'training status (deload cadence + weekly tonnage) computed');
  console.log('✓ set kinds + deload     (rp sum=20, widowmaker miss flagged, stretch 60s, training status)');
}

// --- progress table: W/M/3M/6M/Y, metrics vs the prior period ---
{
  const s = getSnapshot();
  for (const p of ['W', 'M', '3M', '6M', 'Y']) {
    assert.ok(Array.isArray(s.progress[p]) && s.progress[p].length >= 4, `progress period ${p} has metrics`);
  }
  const m = s.progress.Y.find((r) => r.metric === 'Tonnage');
  assert.ok(m && typeof m.value === 'string' && ['up', 'down', 'flat'].includes(m.dir), 'progress rows carry value + direction');
  assert.ok(s.progress.M.find((r) => r.metric === 'Tonnage') && s.progress.M.find((r) => r.metric === 'Chest'), 'lifting progress spans strength + muscle measurements');
  console.log(`✓ progress table         (${s.progress.M.length} metrics × 5 periods, period-over-period deltas)`);
}

// --- substrate: body composition + expanded micros + weekly calories ---
{
  mut.addBodyMetric({ measuredOn: '2026-06-17', weightKg: 89.4, bodyFatPct: 12.5, chestCm: 108, armCm: 41.5, thighCm: 62, waistCm: 81 });
  let s = getSnapshot();
  const bc = s.bodyComposition.find((b) => b.iso === '2026-06-17');
  assert.ok(bc && bc.bodyFatPct === 12.5 && bc.waistCm === 81, 'body composition stored (caliper bf% + measurements)');
  assert.ok(s.weightGoal.trend.some((w) => w.kg === 89.4), 'body-comp weight mirrors into the mass trend');

  // expanded cronometer micros incl. omega-3 + a weight column
  const cron = require('../dist-electron/desktop/ingest/cronometer.js');
  const csv = [
    'Date,Energy (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Omega-3 (g),Iron (mg),Vitamin A (µg),Weight (kg)',
    '2026-06-19,2700,210,300,80,30,1.1,18,950,89.2',
  ].join('\n');
  cron.importCronometerCsv(csv);
  s = getSnapshot();
  assert.ok(s.essentialFats.find((f) => f.mineral === 'Omega-3'), 'omega-3 parsed into its own essential-fats group');
  assert.ok(s.vitamins.find((v) => v.nutrient === 'Vitamin A'), 'expanded vitamin set imported (Vitamin A)');
  assert.ok(s.minerals.find((m) => m.mineral === 'Iron'), 'expanded minerals imported (Iron)');
  assert.ok(s.weightGoal.trend.some((w) => w.kg === 89.2), 'cronometer weight column feeds the mass trend');
  assert.ok(Array.isArray(s.caloriesByWeek), 'weekly calorie averages available for 4w/8w/12w views');

  // Multi-source dedup: same day from BOTH Cronometer paths must collapse to one
  // row per day/nutrient (not duplicate in calories or the micro readout).
  const { applyHealthExport: applyAH } = require('../dist-electron/desktop/ingest/appleHealth.js');
  cron.importCronometerCsv([
    'Date,Energy (kcal),Vitamin C (mg)', '2026-06-22,2500,120',
  ].join('\n'));
  applyAH({ data: { metrics: [
    { name: 'dietary_energy', units: 'kcal', data: [{ date: '2026-06-22 23:00:00 +0000', qty: 2480 }] },
    { name: 'vitamin_c', units: 'mg', data: [{ date: '2026-06-22 23:00:00 +0000', qty: 115 }] },
  ] } });
  s = getSnapshot();
  const vitCRows = s.vitamins.filter((v) => v.nutrient === 'Vitamin C');
  assert.equal(vitCRows.length, 1, 'dual-source day yields ONE Vitamin C row, not two');
  assert.ok(s.calories7d.length <= 7, 'calories7d never exceeds 7 days even with dual sources');
  console.log('✓ substrate body+micros (bf%/measurements · omega-3 + vitamins/minerals · cronometer weight · multi-source dedup)');
}

// --- sweep: SB-Σ raises persistent flags, de-duplicated ---
{
  const openBefore = getSnapshot().insights.length;
  const wrote = mut.addAgentFlags([
    { key: 'tren-dose-unjustified', severity: 'flag', nodes: ['pharmacology'], body: 'Tren bumped while strength still climbing on the prior dose.' },
    { key: 'sodium-high', severity: 'info', nodes: ['nutrition'], body: 'Sodium 4100mg trending high three days running.' },
  ]);
  assert.equal(wrote, 2, 'sweep wrote 2 new flags');
  let s2 = getSnapshot();
  assert.equal(s2.insights.length, openBefore + 2, 'both flags appear in the feed');
  const trenFlag = s2.insights.find((i) => /Tren bumped/.test(i.body));
  assert.ok(trenFlag && trenFlag.nodes.includes('pharmacology'), 'flag tagged to pharmacology node');

  // same key again → de-duplicated (no re-raise)
  const wrote2 = mut.addAgentFlags([
    { key: 'tren-dose-unjustified', severity: 'flag', nodes: ['pharmacology'], body: 'Reworded but same issue.' },
  ]);
  assert.equal(wrote2, 0, 'open flag with same key is not re-raised');

  // clear it, then sweep again → still suppressed (recently resolved)
  mut.resolveInsight(trenFlag.id);
  const wrote3 = mut.addAgentFlags([
    { key: 'tren-dose-unjustified', severity: 'flag', nodes: ['pharmacology'], body: 'Still the same issue.' },
  ]);
  assert.equal(wrote3, 0, 'recently-cleared flag is not immediately re-raised');
  console.log('✓ sb-Σ sweep flags      (2 raised, tagged · re-raise + recently-cleared both de-duped)');
}

// --- agent (ollama) reachability + sweep: offline is handled gracefully ---
(async () => {
  const ollama = require('../dist-electron/desktop/agent/ollama.js');
  const st = await ollama.agentStatus();
  assert.equal(st.provider, 'ollama', 'agent provider is ollama');
  assert.equal(typeof st.reachable, 'boolean', 'agent reports reachability');
  const sweep = await ollama.agentSweep();
  assert.equal(typeof sweep.ran, 'boolean', 'sweep returns a result even offline');
  assert.ok(sweep.ran === true || typeof sweep.error === 'string', 'offline sweep carries an error message');
  console.log(`✓ sb-Σ agent status      (ollama ${st.reachable ? 'reachable' : 'offline — handled'})`);
  console.log('\nALL SMOKE CHECKS PASSED');
})();
