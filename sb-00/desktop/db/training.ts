import { getDb } from './index';

/**
 * Training analysis shared by the read path (snapshot) and the write path
 * (deload reminder on logging) — kept in its own module so neither queries.ts
 * nor mutations.ts has to import the other (avoids a cycle).
 */

export interface TrainingStatus {
  weeksSinceDeload: number;
  deloadDue: boolean;                              // ≥ 4 hard weeks without a back-off
  weeklyTonnage: { week: string; volume: number }[]; // last weeks, oldest→newest
}

/** ISO-ish year-week key, e.g. "2026-24", grouped from session dates. */
export function computeTrainingStatus(): TrainingStatus {
  const db = getDb();
  // Sum working volume (weight×reps) per calendar week. Stretches store reps 0,
  // so they naturally contribute nothing to tonnage.
  const rows = db.prepare(`
    SELECT strftime('%Y-%W', ts.occurred_at) AS wk,
           MIN(ts.occurred_at) AS first_day,
           SUM(s.weight_kg * s.reps) AS vol
    FROM sets s JOIN training_sessions ts ON ts.id = s.session_id
    GROUP BY wk ORDER BY first_day
  `).all() as { wk: string; first_day: string; vol: number }[];

  const weeklyTonnage = rows.map((r) => ({ week: r.wk, volume: Math.round(r.vol || 0) }));

  // A deload = a week whose volume drops to ≤55% of the trailing (≤3 wk) average.
  let weeksSinceDeload = 0;
  for (let i = 0; i < rows.length; i++) {
    const prior = rows.slice(Math.max(0, i - 3), i);
    const avg = prior.length ? prior.reduce((m, p) => m + p.vol, 0) / prior.length : 0;
    const isDeload = avg > 0 && rows[i].vol <= avg * 0.55;
    weeksSinceDeload = isDeload ? 0 : weeksSinceDeload + 1;
  }

  return { weeksSinceDeload, deloadDue: weeksSinceDeload >= 4, weeklyTonnage: weeklyTonnage.slice(-12) };
}
