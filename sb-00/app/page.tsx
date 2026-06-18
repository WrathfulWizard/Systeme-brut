'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import SerumLiquidRender from '@/components/SerumLiquidRender';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from './providers';

export default function Overview() {
  const { insights, regimen, labResults, serum7d, tonnage } = useSnapshot();

  const serumRows = asciiBars(serum7d.map((s) => ({ label: s.day, value: s.mg, display: `${s.mg}mg` })));
  const tonnageRows = asciiBars(tonnage.map((t) => ({ label: t.lift, value: t.value, display: `${t.value}kg` })));

  const peak = serum7d.length ? serum7d.reduce((m, s) => Math.max(m, s.mg), 1) : 1;
  const pick = (i: number) => serum7d[i] ?? serum7d[serum7d.length - 1] ?? { mg: 0 };
  const levels = [pick(0), pick(2), pick(4), pick(6)].map((s) => Math.round((s.mg / peak) * 100));
  const current = serum7d.length ? serum7d[serum7d.length - 1].mg : 0;

  const flagCount = insights.filter((i) => i.severity === 'flag').length;

  return (
    <div className="page">
      <HubFrame
        status={<>SYNC OK · 3 NODES · <span className="flag">{flagCount} OPEN FLAGS</span></>}
        foot={<span className="flag">Last flag — Sodium, today</span>}
        side={<Feed items={insights} showTime />}
      >
        <div className="block">
          <p className="eyebrow">Active regimen</p>
          <table>
            <tbody>
              <tr><th>Compound</th><th>Daily dose</th><th>Route</th></tr>
              {regimen.map((r) => (
                <tr key={r.compound}><td>{r.compound}</td><td>{r.dose}</td><td>{r.route}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Estimated serum — testosterone cyp, 7d</p>
          <div className="liquid-card">
            <span className="tag">Visual readout</span>
            <SerumLiquidRender levels={levels} />
            <div className="read">{current}<span className="v">mg, current</span></div>
          </div>
          <Ascii rows={serumRows} />
        </div>

        <div className="block">
          <p className="eyebrow">Weekly tonnage — top lifts</p>
          <Ascii rows={tonnageRows} />
        </div>

        <div className="block">
          <p className="eyebrow">Latest panel — lab results</p>
          <table>
            <tbody>
              <tr><th>Marker</th><th>Value</th><th>Range</th><th>Status</th></tr>
              {labResults.map((l) => (
                <tr key={l.marker} className={l.flagged ? 'flagrow' : undefined}>
                  <td>{l.marker}</td><td>{l.value}</td><td>{l.range}</td>
                  <td>{l.flagged ? 'FLAGGED' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
