'use client';

import type { HeartRatePoint } from '@/lib/types';

/**
 * Vertical bar readout — systeme brut × ghost in the shell. Monospace, monochrome
 * (no magenta: this is data, not a flag), responsive. Each column is the bucket
 * average; a faint whisker behind it spans min→max so the daily range reads at a
 * glance. Bars fill the width, so a week (7) and a year (12) both look right.
 */
export default function VBars({
  points, unit = 'bpm', height = 150, band = true,
}: { points: HeartRatePoint[]; unit?: string; height?: number; band?: boolean }) {
  if (!points.length) {
    return <p className="synced-note" style={{ margin: '6px 0 0' }}>No data in this window yet.</p>;
  }

  const lows = points.map((p) => p.min ?? p.value);
  const highs = points.map((p) => p.max ?? p.value);
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;
  // thin the x labels so they never collide (aim for ~8 visible)
  const step = Math.ceil(points.length / 8);
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);

  return (
    <div className="vbars" style={{ ['--h' as string]: `${height}px` }}>
      <div className="vbars-scale" aria-hidden>
        <span>{Math.round(hi)}</span><span>{Math.round((hi + lo) / 2)}</span><span>{Math.round(lo)}</span>
      </div>
      <div className="vbars-plot">
        {points.map((p, i) => (
          <div className="vbar" key={i} title={`${p.label} · ${p.value} ${unit}${p.min != null ? ` (${p.min}–${p.max})` : ''}`}>
            <div className="vbar-col">
              {band && p.min != null && p.max != null && (
                <i className="vbar-band" style={{ bottom: `${pct(p.min)}%`, height: `${pct(p.max) - pct(p.min)}%` }} />
              )}
              <i className={`vbar-fill${p === peak ? ' peak' : ''}`} style={{ height: `${Math.max(pct(p.value), 1.5)}%` }} />
              <i className="vbar-dot" style={{ bottom: `${pct(p.value)}%` }} />
            </div>
            <span className="vbar-x">{i % step === 0 ? p.label : ''}</span>
          </div>
        ))}
      </div>

      <style>{`
        .vbars { display: grid; grid-template-columns: 30px 1fr; gap: 8px; margin-top: 6px; }
        .vbars-scale { display: flex; flex-direction: column; justify-content: space-between; height: var(--h);
          font-family: var(--font-mono); font-size: 8.5px; color: var(--dim); text-align: right; padding-bottom: 16px; }
        .vbars-plot { display: flex; align-items: flex-end; gap: 2px; height: var(--h); }
        .vbar { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; height: 100%; }
        .vbar-col { position: relative; width: 100%; max-width: 26px; flex: 1; min-height: 0;
          border-bottom: 1px solid var(--line-soft); }
        .vbar-band { position: absolute; left: 50%; transform: translateX(-50%); width: 1px;
          background: rgba(235,235,240,0.16); }
        .vbar-fill { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 58%; max-width: 12px;
          background: linear-gradient(to top, rgba(235,235,240,0.10), rgba(235,235,240,0.42));
          transition: height .5s cubic-bezier(.22,.61,.36,1); }
        .vbar-fill.peak { background: linear-gradient(to top, rgba(235,235,240,0.22), rgba(255,255,255,0.85)); }
        .vbar-dot { position: absolute; left: 50%; width: 3px; height: 3px; margin-left: -1.5px; margin-bottom: -1.5px;
          background: var(--text); border-radius: 3px; opacity: .9; }
        .vbar:hover .vbar-fill { background: linear-gradient(to top, rgba(235,235,240,0.3), #fff); }
        .vbar-x { font-family: var(--font-mono); font-size: 8px; letter-spacing: .02em; color: var(--dim);
          margin-top: 5px; height: 11px; white-space: nowrap; transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) { .vbar-fill { transition: none; } }
      `}</style>
    </div>
  );
}
