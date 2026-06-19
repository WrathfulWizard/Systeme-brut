'use client';

import { useState } from 'react';
import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from '../providers';
import type { Sport, CardioPoint } from '@/lib/types';

const SPORT_LABEL: Record<Sport, string> = { run: 'Run', ride: 'Ride', swim: 'Swim' };
// Shoes worn past ~700–800 km lose midsole rebound — flag the high-mileage ones.
const SHOE_RETIRE_KM = 750;

type PeriodKey = 'W' | 'M' | '3M' | '6M' | 'Y';

export default function Cardio() {
  const { cardioGoal, cardioProgression, recentRuns, cardioBySport, cardioWeekly, cardioMonthly, cardioHealth, gear } = useSnapshot();
  const shoes = gear.filter((g) => g.kind === 'shoe');
  const [period, setPeriod] = useState<PeriodKey>('W');

  // W = recent sessions; M/3M = weekly totals; 6M/Y = monthly totals.
  const periodSeries: Record<PeriodKey, CardioPoint[]> = {
    W: cardioProgression,
    M: cardioWeekly.slice(-4),
    '3M': cardioWeekly.slice(-13),
    '6M': cardioMonthly.slice(-6),
    Y: cardioMonthly.slice(-12),
  };
  const series = periodSeries[period];
  const progressionRows = asciiBars(
    series.map((c) => ({ label: c.date, value: c.distance, display: `${c.distance.toFixed(1)}km` })),
    20,
    period === 'W' ? cardioGoal.target : undefined,
  );
  const pct = Math.round((cardioGoal.longest / cardioGoal.target) * 100);
  const PERIODS: PeriodKey[] = ['W', 'M', '3M', '6M', 'Y'];
  const ch = cardioHealth;

  return (
    <div className="page">
      <HubFrame foot={<span>Next long run — due 06.20</span>}>
        <p className="synced-note">Synced from <span className="flag">Strava</span> — runs, rides and swims import automatically. Link it on Connections; no manual entry here.</p>

        <div className="block">
          <p className="eyebrow">By sport</p>
          <table>
            <tbody>
              <tr><th>Sport</th><th>Sessions</th><th>Distance</th></tr>
              {cardioBySport.map((c) => (
                <tr key={c.sport}><td>{SPORT_LABEL[c.sport]}</td><td>{c.count}</td><td>{c.distanceKm.toFixed(1)} km</td></tr>
              ))}
              {cardioBySport.length === 0 && <tr><td colSpan={3}>No sessions yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="block">
          <div className="logbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="eyebrow" style={{ margin: 0 }}>Distance — {period === 'W' ? 'recent sessions' : period === 'M' || period === '3M' ? 'weekly totals' : 'monthly totals'}</p>
            <div className="win-toggle">
              {PERIODS.map((p) => (
                <button key={p} className={`wbtn${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <Ascii rows={progressionRows} />
          <div className="goalline">
            GOAL {cardioGoal.target.toFixed(1)}KM · LONGEST {cardioGoal.longest.toFixed(1)}KM · {pct}% THERE
          </div>
        </div>

        <div className="block">
          <p className="eyebrow">Cardio health — VO₂max · resting HR</p>
          {(ch.vo2max != null || ch.restingHr != null || ch.hrv != null) ? (
            <>
              <div className="bodycomp-now">
                {ch.vo2max != null && <span><b>{ch.vo2max}</b> VO₂max</span>}
                {ch.restingHr != null && <span><b>{ch.restingHr}</b> resting HR</span>}
                {ch.hrv != null && <span><b>{ch.hrv}</b> HRV ms</span>}
              </div>
              {ch.vo2Trend.length > 1 && (
                <>
                  <p className="eyebrow" style={{ fontSize: 10 }}>VO₂max trend</p>
                  <Ascii rows={asciiBars(ch.vo2Trend.map((v) => ({ label: v.date, value: v.value, display: String(v.value) })), 20)} />
                </>
              )}
            </>
          ) : <p className="synced-note">No VO₂max / resting-HR yet — push Apple Health (Health Auto Export → the endpoint on Connections).</p>}
        </div>

        <div className="block">
          <p className="eyebrow">Recent sessions</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Sport</th><th>Distance</th><th>Pace / speed</th><th>Source</th></tr>
              {recentRuns.map((r, i) => (
                <tr key={i}><td>{r.date}</td><td>{SPORT_LABEL[r.sport]}</td><td>{r.distance}</td><td>{r.pace}</td><td>{r.source}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Footwear — mileage</p>
          <table>
            <tbody>
              <tr><th>Shoe</th><th>Distance</th><th>Status</th></tr>
              {shoes.map((s) => {
                const worn = s.retired || s.km >= SHOE_RETIRE_KM;
                return (
                  <tr key={s.id} className={worn ? 'flagrow' : undefined}>
                    <td>{s.name}</td><td>{s.km.toFixed(1)} km</td>
                    <td>{s.retired ? 'RETIRED' : worn ? <span className="flag">REPLACE SOON</span> : 'Active'}</td>
                  </tr>
                );
              })}
              {shoes.length === 0 && <tr><td colSpan={3}>No shoes yet — Strava gear with mileage appears here once a run with assigned gear syncs.</td></tr>}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
