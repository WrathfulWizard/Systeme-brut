/**
 * Pharmacokinetics: estimate serum level over time from a dosing history and a
 * compound's half-life. First-order elimination, superposition of every dose.
 *
 * Two entry points:
 *  - protocolSerum: a CONTINUOUS daily protocol (a step-function of daily dose,
 *    changed by titrations) — integrates the standing daily dose each day.
 *  - discreteSerum: a list of discrete injections/administrations.
 *
 * "Level" is in mg notionally present in the system (relative units, good for
 * trend + accumulation shape, not an absolute blood concentration).
 */

const DAY = 86_400_000;

export interface SerumPoint { day: string; mg: number; }

/** A standing-dose change: from time `t` (ms), the daily dose becomes `dose`. */
export interface DoseStep { t: number; dose: number; }

const weekday = (ms: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ms).getDay()];
const decay = (elapsedDays: number, halfLifeDays: number) => Math.pow(0.5, elapsedDays / Math.max(halfLifeDays, 0.05));

/**
 * Serum from a continuous protocol. `steps` is the sorted standing-daily-dose
 * timeline; we sum each past day's standing dose decayed to the sample day.
 */
export function protocolSerum(steps: DoseStep[], halfLifeDays: number, opts: { windowDays?: number; anchorMs?: number } = {}): SerumPoint[] {
  if (steps.length === 0) return [];
  const windowDays = opts.windowDays ?? 14;
  const sorted = [...steps].sort((a, b) => a.t - b.t);
  const start = floorDay(sorted[0].t);
  const todayDay = floorDay(opts.anchorMs ?? Date.now());
  const anchor = Math.max(todayDay, floorDay(sorted[sorted.length - 1].t));

  const doseOnDay = (t: number) => {
    let dose = 0;
    for (const s of sorted) { if (s.t <= t) dose = s.dose; else break; }
    return dose;
  };

  const out: SerumPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const D = anchor - i * DAY;
    let mg = 0;
    for (let d = start; d <= D; d += DAY) {
      const dose = doseOnDay(d);
      if (dose > 0) mg += dose * decay((D - d) / DAY, halfLifeDays);
    }
    out.push({ day: weekday(D), mg: Math.round(mg) });
  }
  return out;
}

/** Serum from discrete doses (legacy administrations log). */
export function discreteSerum(doses: { t: number; dose: number }[], halfLifeDays: number, opts: { windowDays?: number; anchorMs?: number } = {}): SerumPoint[] {
  if (doses.length === 0) return [];
  const windowDays = opts.windowDays ?? 14;
  const anchor = floorDay(opts.anchorMs ?? doses.reduce((m, a) => Math.max(m, a.t), 0));
  const out: SerumPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const D = anchor - i * DAY;
    let mg = 0;
    for (const a of doses) {
      const e = (D - floorDay(a.t)) / DAY;
      if (e >= 0) mg += a.dose * decay(e, halfLifeDays);
    }
    out.push({ day: weekday(D), mg: Math.round(mg) });
  }
  return out;
}

function floorDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
