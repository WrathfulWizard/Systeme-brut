'use client';

import { useState } from 'react';
import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import VBars from '@/components/VBars';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from '../providers';
import type { Sport, CardioPoint, ProgressPeriod } from '@/lib/types';

const RANGE_LABEL: Record<ProgressPeriod, string> = { W: 'Week', M: 'Month', '3M': '3 Months', '6M': '6 Months', Y: 'Year' };

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
  const hr = useSnapshot().heartRate;
  const [hrView, setHrView] = useState<'24H' | ProgressPeriod>('24H');
  const hrSeries = hrView === '24H' ? hr.hourly : hr.ranges[hrView];
  const hrAsOf = hr.updatedAt ? new Date(hr.updatedAt) : null;

  return (
    <div className="page">
      <HubFrame foot={<span>Longest {cardioGoal.longest}{cardioGoal.unit} · goal {cardioGoal.target}{cardioGoal.unit}</span>}>
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

        {/* ---- HEART — the cardiovascular command readout -------------------- */}
        <div className="block heart-block">
          <div className="heart-head">
            <p className="eyebrow" style={{ margin: 0 }}>Heart</p>
            <div className="hr-toggle">
              {(['24H', 'W', 'M', '3M', '6M', 'Y'] as const).map((k) => (
                <button key={k} className={`wbtn${hrView === k ? ' on' : ''}`} onClick={() => setHrView(k)}>{k}</button>
              ))}
            </div>
          </div>

          {(hr.current != null || hr.resting != null || ch.vo2max != null || ch.hrv != null || hrSeries.length > 0) ? (
            <>
              <div className="hr-stats">
                {hr.current != null && <div className="hr-stat"><b>{Math.round(hr.current)}</b><span>bpm now</span></div>}
                {hr.resting != null && <div className="hr-stat"><b>{Math.round(hr.resting)}</b><span>resting</span></div>}
                {ch.hrv != null && <div className="hr-stat"><b>{ch.hrv}</b><span>HRV ms</span></div>}
                {ch.vo2max != null && <div className="hr-stat"><b>{ch.vo2max}</b><span>VO₂max</span></div>}
                {hrAsOf && <div className="hr-asof">as of {hrAsOf.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>

              {/* Improvement signal: a falling resting HR means cardio fitness is improving. */}
              {(hr.restingDelta != null || hr.avgDelta != null) && (
                <div className="hr-trendline">
                  {hr.restingDelta != null && hr.restingDelta !== 0 && (
                    <span className={`delta ${hr.restingDelta < 0 ? 'pos' : 'neg'}`}>
                      {hr.restingDelta < 0 ? '▼' : '▲'} {Math.abs(hr.restingDelta)} bpm resting
                    </span>
                  )}
                  {hr.avgDelta != null && hr.avgDelta !== 0 && (
                    <span className={`delta ${hr.avgDelta < 0 ? 'pos' : 'neg'}`}>
                      {hr.avgDelta < 0 ? '▼' : '▲'} {Math.abs(hr.avgDelta)} bpm avg
                    </span>
                  )}
                  <span className="hr-trend-note">
                    over {hr.deltaWindowDays ?? 30}d{hr.restingDelta != null && hr.restingDelta < 0 ? ' · fitness trending up' : hr.restingDelta != null && hr.restingDelta > 0 ? ' · resting HR climbing' : ''}
                  </span>
                </div>
              )}

              <p className="eyebrow hr-cap">
                {hrView === '24H' ? 'Heart rate · last 24 hours (hourly avg · min–max band)' : `Heart rate · ${RANGE_LABEL[hrView]} (avg · min–max band)`}
              </p>
              <VBars points={hrSeries} unit="bpm" height={hrView === '24H' ? 150 : 138} />

              {/* Running heart rate — cross-referenced to each session's time window. */}
              {hr.runs.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p className="eyebrow hr-cap">Running heart rate · HR logged during each session</p>
                  <table>
                    <tbody>
                      <tr><th>Date</th><th>Sport</th><th>Dist</th><th>Time</th><th>Avg HR</th><th>Max HR</th></tr>
                      {hr.runs.map((r, i) => (
                        <tr key={i}>
                          <td>{r.date}</td><td>{SPORT_LABEL[r.sport]}</td><td>{r.distance}</td>
                          <td>{r.durationMin}m</td>
                          <td>{r.avgHr != null ? `${r.avgHr} bpm` : <span style={{ color: 'var(--dim)' }}>no HR</span>}</td>
                          <td>{r.maxHr != null ? `${r.maxHr} bpm` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Daily HR log — the raw daily readings, newest first. */}
              {hr.dailyLog.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p className="eyebrow hr-cap">Daily log · resting + range per day</p>
                  <table>
                    <tbody>
                      <tr><th>Date</th><th>Resting</th><th>Avg</th><th>Min</th><th>Max</th></tr>
                      {hr.dailyLog.map((d, i) => (
                        <tr key={i}>
                          <td>{d.date}</td>
                          <td>{d.resting != null ? `${d.resting}` : '—'}</td>
                          <td>{d.avg}</td><td>{d.min}</td><td>{d.max}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hrView !== '24H' && ch.vo2Trend.length > 1 && (
                <>
                  <p className="eyebrow" style={{ fontSize: 10, marginTop: 20 }}>VO₂max trend</p>
                  <Ascii rows={asciiBars(ch.vo2Trend.map((v) => ({ label: v.date, value: v.value, display: String(v.value) })), 20)} />
                </>
              )}
            </>
          ) : <p className="synced-note">No heart data yet — push Apple Health (Health Auto Export → the endpoint on Connections). Select Heart Rate, Resting Heart Rate, HRV or VO₂max.</p>}

          <style>{`
            .heart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
            .hr-toggle { display: flex; gap: 5px; }
            .hr-toggle .wbtn { padding: 3px 8px; }
            .hr-stats { display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap; margin-bottom: 10px; }
            .hr-stat { display: flex; flex-direction: column; line-height: 1; font-family: var(--font-mono); }
            .hr-stat b { font-size: 26px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
            .hr-stat span { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin-top: 5px; }
            .hr-asof { margin-left: auto; align-self: flex-end; font-family: var(--font-mono); font-size: 9px; color: var(--dim); letter-spacing: 0.04em; }
            .hr-cap { font-size: 10px; margin: 0 0 2px; }
            .hr-trendline { display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; margin-bottom: 16px;
              font-family: var(--font-mono); font-size: 11.5px; }
            .hr-trendline .delta { font-weight: 700; letter-spacing: 0.02em; }
            .hr-trend-note { color: var(--dim); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
          `}</style>
        </div>
      </HubFrame>
    </div>
  );
}
