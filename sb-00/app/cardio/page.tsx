'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from '../providers';

export default function Cardio() {
  const { cardioGoal, cardioProgression, recentRuns } = useSnapshot();

  const progressionRows = asciiBars(
    cardioProgression.map((c) => ({ label: c.date, value: c.distance, display: `${c.distance.toFixed(1)}km` })),
    20,
    cardioGoal.target,
  );
  const pct = Math.round((cardioGoal.longest / cardioGoal.target) * 100);

  const info = [{
    id: 99, at: 'Info', severity: 'info' as const, nodes: ['training' as const],
    body: 'Pace improving even as distance climbs — on track for the 10k build-up.',
  }];

  return (
    <div className="page">
      <HubFrame
        status={<>SOURCE: STRAVA · SYNCED 06:02</>}
        foot={<span>Next long run — due 06.20</span>}
        side={<Feed items={info} />}
      >
        <p className="synced-note">Synced from <span className="flag">Strava</span> — link it on the Connections screen. Runs import automatically; no manual entry here.</p>
        <div className="block">
          <p className="eyebrow">Progression — target {cardioGoal.target}km</p>
          <Ascii rows={progressionRows} />
          <div className="goalline">
            GOAL {cardioGoal.target.toFixed(1)}KM · LONGEST {cardioGoal.longest.toFixed(1)}KM · {pct}% THERE
          </div>
        </div>

        <div className="block">
          <p className="eyebrow">Recent runs</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Distance</th><th>Pace</th><th>Source</th></tr>
              {recentRuns.map((r, i) => (
                <tr key={i}><td>{r.date}</td><td>{r.distance}</td><td>{r.pace}</td><td>{r.source}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
