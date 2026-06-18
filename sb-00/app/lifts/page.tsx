'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from '../providers';

export default function Lifts() {
  const { insights, recentSets, prLog, tonnage } = useSnapshot();
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
          <p className="eyebrow">Recent sets</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Exercise</th><th>Set</th><th>Weight</th><th>Reps</th></tr>
              {recentSets.map((s, i) => (
                <tr key={i}>
                  <td>{s.date}</td><td>{s.exercise}</td><td>{s.set}</td><td>{s.weight}</td><td>{s.reps}</td>
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
