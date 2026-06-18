'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from './Nav';
import { useSb } from '@/app/providers';
import { APP_VERSION } from '@/lib/version';

const SOURCE_LABEL: Record<string, string> = { strava: 'STRAVA', cronometer: 'CRONO', apple_health: 'HEALTH' };

interface HubFrameProps {
  status?: ReactNode;        // optional override; corners carry the live readouts
  foot?: ReactNode;
  side?: ReactNode;
  children: ReactNode;
}

/**
 * The SB-00 master-hub chrome. The four corners are functional:
 *  ↖ brand · ↗ live sync status + open-flag count (clickable)
 *  ↙ local time/date + build · ↘ running + weight goal progress
 */
export default function HubFrame({ foot, side, children }: HubFrameProps) {
  const { snapshot, sync } = useSb();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ↗ sync status across the three real sources
  const sources = sync.connections.filter((c) => c.source !== undefined);
  const offline = sources.filter((c) => c.status !== 'connected');
  const allOk = sources.length > 0 && offline.length === 0;
  const flags = snapshot.insights.filter((i) => i.severity === 'flag').length;

  // ↘ goal progress
  const { cardioGoal, weightGoal } = snapshot;
  const runPct = cardioGoal.target ? Math.min(100, Math.round((cardioGoal.longest / cardioGoal.target) * 100)) : 0;
  const wPct = (() => {
    if (weightGoal.current == null || !weightGoal.trend.length) return 0;
    const start = weightGoal.trend[0].kg;
    const span = start - weightGoal.target;
    if (Math.abs(span) < 0.01) return 100;
    return Math.max(0, Math.min(100, Math.round(((start - weightGoal.current) / span) * 100)));
  })();

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="hub frame">
      <span className="crn tl" /><span className="crn tr" /><span className="crn bl" /><span className="crn br" />

      {/* ↗ live sync + flags */}
      <div className="cnr tr">
        {allOk ? <span className="ok">SYNC OK</span> : <span className="bad">SYNC: {offline.map((c) => SOURCE_LABEL[c.source] ?? c.source).join(' ')} OFF</span>}
        <br />
        <Link href="/flags" className={`flagchip${flags === 0 ? ' zero' : ''}`}>{flags} {flags === 1 ? 'FLAG' : 'FLAGS'} OPEN</Link>
      </div>

      <div className="id-row">
        <b>SYSTEME BRUT // SB-00</b>
      </div>

      <div className={`hub-body${side ? '' : ' no-side'}`}>
        <Nav />
        <div>{children}</div>
        {side && (
          <div className="side">
            <p className="eyebrow">SB-Σ — quick feed</p>
            {side}
          </div>
        )}
      </div>

      {/* ↙ local time/date + build */}
      <div className="cnr bl">
        <b>{time}</b> · {date}<br />
        SB-00 {APP_VERSION}
      </div>

      {/* ↘ goals */}
      <div className="cnr br">
        RUN <b>{cardioGoal.longest.toFixed(1)}/{cardioGoal.target}{cardioGoal.unit}</b>
        <span className="bar-mini"><i style={{ width: `${runPct}%` }} /></span> {runPct}%
        <br />
        MASS <b>{weightGoal.current != null ? `${weightGoal.current}→${weightGoal.target}${weightGoal.unit}` : `goal ${weightGoal.target}${weightGoal.unit}`}</b>
        <span className="bar-mini"><i style={{ width: `${wPct}%` }} /></span> {wPct}%
      </div>

      {foot && <div className="foot"><span /><span>{foot}</span></div>}
    </div>
  );
}
