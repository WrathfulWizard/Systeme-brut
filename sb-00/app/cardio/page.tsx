'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from '../providers';
import type { Sport } from '@/lib/types';

const SPORT_LABEL: Record<Sport, string> = { run: 'Run', ride: 'Ride', swim: 'Swim' };

export default function Cardio() {
  const { cardioGoal, cardioProgression, recentRuns, cardioBySport } = useSnapshot();

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
      <HubFrame foot={<span>Next long run — due 06.20</span>} side={<Feed items={info} />}>
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
          <p className="eyebrow">Run progression — target {cardioGoal.target}km</p>
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
      </HubFrame>
    </div>
  );
}
