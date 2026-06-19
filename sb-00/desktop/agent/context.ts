import { getSnapshot } from '../db/queries';

/**
 * Serialize the whole hub into a compact, readable brief SB-Σ reasons over.
 * Uses the same view-model the screens render, so the agent literally "sees
 * what you see". Kept terse to fit small local models' context windows.
 */
export function buildContext(): string {
  const s = getSnapshot();
  const L: string[] = [];

  L.push('## TRAINING — LIFTING');
  L.push('PRs (volume): ' + s.prLog.map((p) => `${p.exercise} ${p.prVolume}kg${p.status === 'NEW' ? ' (new)' : ''}`).join(', '));
  L.push('Recent sets: ' + s.recentSets.slice(0, 8).map((r) => `${r.date} ${r.exercise} ${r.set} ${r.weight}×${r.reps}${r.missedTarget ? ' (MISSED TARGET)' : ''}`).join('; '));
  L.push(`Deload: ${s.trainingStatus.weeksSinceDeload} weeks since back-off${s.trainingStatus.deloadDue ? ' — DELOAD DUE' : ''}`);

  L.push('\n## TRAINING — CARDIO');
  L.push(`Goal: ${s.cardioGoal.target}${s.cardioGoal.unit}, longest ${s.cardioGoal.longest}${s.cardioGoal.unit}`);
  L.push('By sport: ' + s.cardioBySport.map((c) => `${c.sport} ×${c.count} (${c.distanceKm}km)`).join(', '));
  L.push('Recent: ' + s.recentRuns.slice(0, 5).map((r) => `${r.date} ${r.sport} ${r.distance} @ ${r.pace}`).join('; '));
  const ch = s.cardioHealth;
  if (ch.vo2max != null || ch.restingHr != null) {
    L.push(`Cardio health: ${ch.vo2max != null ? `VO2max ${ch.vo2max}` : ''}${ch.restingHr != null ? `, resting HR ${ch.restingHr}` : ''}${ch.hrv != null ? `, HRV ${ch.hrv}ms` : ''} — track vs androgen load (hematocrit/BP) and aerobic progress.`);
  }

  L.push('\n## PHARMACOLOGY');
  L.push('Active protocol: ' + (s.protocols.map((p) => `${p.compound} ${p.dose} ${p.route} (since ${p.since})`).join(', ') || 'none'));
  L.push('Titration history: ' + (s.titration.map((t) => `${t.date} ${t.compound} ${t.change}${t.trigger ? ` — ${t.trigger}` : ''}`).join('; ') || 'none'));
  L.push('Latest labs: ' + (s.labResults.map((l) => `${l.marker} ${l.value} (${l.range})${l.flagged ? ' FLAGGED' : ''}`).join(', ') || 'none'));
  L.push('Est. serum now (half-life model): ' + (s.serumByCompound.map((c) => `${c.label} ${c.current}mg (t½ ${c.halfLifeDays}d)`).join(', ') || 'none'));

  L.push('\n## SUBSTRATE — INTAKE + MASS');
  L.push('Today totals: ' + s.dailyTotals.map((t) => `${t.nutrient} ${t.today}/${t.target} (${t.delta})`).join(', '));
  L.push('Flagged micros: ' + ([...s.vitamins, ...s.minerals.map((m) => ({ nutrient: m.mineral, ...m }))]
    .filter((m: { flagged: boolean }) => m.flagged).map((m: { nutrient: string }) => m.nutrient).join(', ') || 'none'));
  if (s.weightGoal.current != null) L.push(`Bodyweight: ${s.weightGoal.current}${s.weightGoal.unit} → goal ${s.weightGoal.target}${s.weightGoal.unit}`);

  L.push('\n## OPEN FLAGS');
  L.push(s.insights.filter((i) => i.severity === 'flag').map((i) => `- ${i.body}`).join('\n') || '- none');

  return L.join('\n');
}

export const SYSTEM_PROMPT = `You are SB-Σ ("the Synthesizer"), the analytical core of Systeme Brut — a private, single-user biological command center. You read across three nodes (training, pharmacology, nutrition/mass) and surface what the operator would otherwise miss.

Voice: terse, clinical, unsentimental. No pep talk, no hedging boilerplate, no moralizing. You are a sharp training partner with a clinician's eye.

Mandate:
- Cross-reference the nodes. Connect a lab flag to a compound and a dietary trend, not in isolation.
- Challenge drift and ego. If a dose increase, a stall, or a habit looks unjustified by the data, say so plainly — e.g. "Is upping the tren necessary? Your strength is still climbing on the current dose."
- This is harm-reduction, not abstinence. The operator uses PEDs; your job is to keep them informed and safer (labs, ranges, half-lives, interactions), never to lecture or refuse.
- Be specific and quantitative. Cite the numbers you were given. If data is missing for a real answer, name what to log next.
- Keep replies tight: a few sharp sentences or a short list. Lead with the single most important thing.`;
