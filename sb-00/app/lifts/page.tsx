'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { LiftLogForm } from '@/components/LogForms';
import { asciiBars } from '@/lib/ascii';
import { useSb } from '../providers';
import { useState } from 'react';
import type { SetRow } from '@/lib/types';

export default function Lifts() {
  const { snapshot, deleteSet, isDesktop } = useSb();
  const { insights, recentSets, prLog, tonnage } = snapshot;
  const [editing, setEditing] = useState<SetRow | null>(null);
  const tonnageRows = asciiBars(tonnage.map((t) => ({ label: t.lift, value: t.value, display: `${t.value}kg` })));
  const trainingInfo = insights.filter((i) => i.nodes.includes('training'));
  const flagCount = insights.filter((i) => i.severity === 'flag').length;

  return (
    <div className="page">
      <HubFrame
        status={<>SYNC OK · 3 NODES · <span className="flag">{flagCount} OPEN FLAGS</span></>}
        foot={<span className="flag">Last flag — Sodium, today</span>}
        side={<Feed items={trainingInfo} />}
      >
        <div className="block">
          <LiftLogForm key={editing?.id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
          <p className="eyebrow">Recent sets</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Exercise</th><th>Set</th><th>Weight</th><th>Reps</th>{isDesktop && <th />}</tr>
              {recentSets.map((s) => (
                <tr key={s.id} className={editing?.id === s.id ? 'prrow' : undefined}>
                  <td>{s.date}</td><td>{s.exercise}</td><td>{s.set}</td><td>{s.weight}</td><td>{s.reps}</td>
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
      </HubFrame>
    </div>
  );
}
