'use client';

import { useState } from 'react';
import type { SerumCompound } from '@/lib/types';

/**
 * Per-compound serum readout: click a compound to expand an SVG curve of its
 * estimated level over a selectable window (3d / 1w / 4w / 8w), plus a banner
 * stating whether it has reached steady state. Reads serumByCompound, which the
 * backend already computes over a 56-day window with a steady-state flag.
 */

const WINDOWS: { label: string; days: number }[] = [
  { label: '3D', days: 3 }, { label: '1W', days: 7 }, { label: '4W', days: 28 }, { label: '8W', days: 56 },
];

function Sparkline({ series, color }: { series: { day: string; mg: number }[]; color: string }) {
  const w = 460, h = 90, pad = 6;
  const pts = series.length ? series : [{ day: '', mg: 0 }];
  const max = Math.max(...pts.map((p) => p.mg), 1);
  const stepX = pts.length > 1 ? (w - pad * 2) / (pts.length - 1) : 0;
  const x = (i: number) => pad + i * stepX;
  const y = (mg: number) => h - pad - (mg / max) * (h - pad * 2);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.mg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 90, display: 'block' }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
      {pts.length > 0 && <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].mg)} r={2.6} fill={color} />}
    </svg>
  );
}

function Row({ c }: { c: SerumCompound }) {
  const [open, setOpen] = useState(false);
  const [win, setWin] = useState(7);
  const series = c.series.slice(-win);
  const plateauDays = Math.ceil(c.halfLifeDays * 4.3);
  return (
    <div className="srow-detail">
      <button className="srow-head" onClick={() => setOpen((v) => !v)}>
        <span className="dot" style={{ background: c.color }} />
        <span className="lbl">{c.label}</span>
        <span className="sub">{c.klass} · t½ {c.halfLifeDays}d{c.discontinued ? ' · clearing' : ''}</span>
        <span className="mg">{c.current}mg</span>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="srow-body">
          <div className="win-toggle">
            {WINDOWS.map((wn) => (
              <button key={wn.label} className={`wbtn${win === wn.days ? ' on' : ''}`} onClick={() => setWin(wn.days)}>{wn.label}</button>
            ))}
          </div>
          <Sparkline series={series} color={c.color} />
          <div className={`steady-banner${c.steadyState ? ' on' : ''}`}>
            {c.discontinued
              ? 'DISCONTINUED — still clearing from the system on this half-life.'
              : c.steadyState
                ? 'AT STEADY STATE — level is stable at this dose.'
                : `BUILDING — not yet at steady state (≈${plateauDays}d to plateau at t½ ${c.halfLifeDays}d).`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SerumDetail({ compounds }: { compounds: SerumCompound[] }) {
  if (!compounds.length) return <p className="synced-note">No active compounds to chart.</p>;
  return <div className="serum-detail">{compounds.map((c) => <Row key={c.key + c.label} c={c} />)}</div>;
}
