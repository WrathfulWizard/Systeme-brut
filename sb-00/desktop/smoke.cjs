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
console.log('✓ manual logging        (set + dose + titration + lab panel written and reflected)');

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

// --- agent (ollama) reachability: offline is handled gracefully ---
(async () => {
  const ollama = require('../dist-electron/desktop/agent/ollama.js');
  const st = await ollama.agentStatus();
  assert.equal(st.provider, 'ollama', 'agent provider is ollama');
  assert.equal(typeof st.reachable, 'boolean', 'agent reports reachability');
  console.log(`✓ sb-Σ agent status      (ollama ${st.reachable ? 'reachable' : 'offline — handled'})`);
  console.log('\nALL SMOKE CHECKS PASSED');
})();
