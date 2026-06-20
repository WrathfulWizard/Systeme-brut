'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { LiftLogForm } from '@/components/LogForms';
import { asciiBars } from '@/lib/ascii';
import { useSb } from '../providers';
import { useState } from 'react';
import type { SetRow, ProgressPeriod } from '@/lib/types';

const PERIODS: ProgressPeriod[] = ['W', 'M', '3M', '6M', 'Y'];
const PERIOD_LABEL: Record<ProgressPeriod, string> = { W: 'week', M: 'month', '3M': '3 months', '6M': '6 months', Y: 'year' };

export default function Lifts() {
  const { snapshot, deleteSet, isDesktop } = useSb();
  const { insights, recentSets, prLog, tonnage, trainingStatus, progress } = snapshot;
  const [editing, setEditing] = useState<SetRow | null>(null);
  const [period, setPeriod] = useState<ProgressPeriod>('M');
  const progressRows = progress[period] ?? [];
  const tonnageRows = asciiBars(tonnage.map((t) => ({ label: t.lift, value: t.value, display: `${t.value}kg` })));
  const trainingInfo = insights.filter((i) => i.nodes.includes('training'));
  const flagCount = insights.filter((i) => i.severity === 'flag').length;

  return (
    <div className="page">
      <HubFrame
        status={<>SYNC OK · 3 NODES · <span className="flag">{flagCount} OPEN FLAG{flagCount === 1 ? '' : 'S'}</span></>}
        foot={flagCount > 0
          ? <span className="flag">{flagCount} open flag{flagCount === 1 ? '' : 's'}</span>
          : <span>All clear</span>}
        side={<Feed items={trainingInfo} />}
      >
        {trainingStatus.deloadDue && (
          <div className="deload-banner">
            <span className="flag">DELOAD DUE</span> — {trainingStatus.weeksSinceDeload} weeks without a back-off. Drop volume ~40% this week.
          </div>
        )}

        <div className="block">
          <LiftLogForm key={editing?.id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
          <p className="eyebrow">Recent sets</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Movement</th><th>Set</th><th>Weight</th><th>Reps / hold</th>{isDesktop && <th />}</tr>
              {recentSets.map((s) => (
                <tr key={s.id} className={s.missedTarget ? 'flagrow' : editing?.id === s.id ? 'prrow' : undefined}>
                  <td>{s.date}</td><td>{s.exercise}</td><td>{s.set}</td><td>{s.weight}</td>
                  <td>{s.reps}{s.missedTarget && <span className="flag"> ⚠</span>}</td>
                  {isDesktop && (
                    <td className="rowact">
                      <button className="rowbtn" onClick={() => setEditing(s)}>edit</button>
                      <button className="rowbtn del" onClick={() => deleteSet(s.id)}>del</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">PR / logbook</p>
          <table>
            <tbody>
              <tr><th>Exercise</th><th>Current PR (vol)</th><th>Last beat</th><th>Status</th></tr>
              {prLog.map((p) => (
                <tr key={p.exercise} className={p.status === 'NEW' ? 'prrow' : undefined}>
                  <td>{p.exercise}</td><td>{p.prVolume}kg</td><td>{p.lastBeat}</td><td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Weekly tonnage — top lifts</p>
          <Ascii rows={tonnageRows} />
        </div>

        <div className="block">
          <div className="logbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="eyebrow" style={{ margin: 0 }}>Progress — this {PERIOD_LABEL[period]} vs last</p>
            <div className="win-toggle">
              {PERIODS.map((p) => (
                <button key={p} className={`wbtn${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <table>
            <tbody>
              <tr><th>Metric</th><th>Now</th><th>Prev</th><th>Δ</th></tr>
              {progressRows.map((r) => {
                const good = r.dir === 'flat' ? '' : (r.dir === 'up') === r.upGood ? 'pos' : 'neg';
                return (
                  <tr key={r.metric}>
                    <td>{r.metric}</td><td>{r.value}</td><td>{r.prev}</td>
                    <td className={`delta ${good}`}>{r.dir === 'up' ? '▲' : r.dir === 'down' ? '▼' : ''} {r.delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
