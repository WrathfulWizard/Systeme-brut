'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Boot sequence — translated from the VARIANT_01 startup mockup (intent, not
 * markup): a receding-portal field accelerating inward, the nodes mounting one
 * by one, then an INITIALIZATION badge before the hub takes over. Shows once per
 * app launch (sessionStorage), respects reduced-motion, and never uses magenta
 * — that colour means "flag" everywhere else.
 */

const NODES = ['cardio', 'lifting', 'pharmacology', 'substrate', 'flags', 'connections', 'synthesizer'];

export default function BootSplash() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(0); // how many nodes have mounted
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const accel = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('sb-booted')) { setShow(false); return; }
    sessionStorage.setItem('sb-booted', '1');

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dismiss = () => { setFading(true); setTimeout(() => setShow(false), 520); };
    if (reduce) { const t = setTimeout(dismiss, 400); return () => clearTimeout(t); }

    const timers: ReturnType<typeof setTimeout>[] = [];
    NODES.forEach((_, i) => timers.push(setTimeout(() => setDone(i + 1), 260 * (i + 1))));
    timers.push(setTimeout(() => { accel.current = true; setReady(true); }, 260 * NODES.length + 320));
    timers.push(setTimeout(dismiss, 260 * NODES.length + 1400));

    // receding-portal field
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0, focal = 220;
    const rings = Array.from({ length: 16 }, (_, i) => ({ z: i * 32 + 12 }));
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const cx = cv.width / 2, cy = cv.height / 2, v = accel.current ? 9 : 1.4;
      if (accel.current) focal += 0.8;
      for (const r of rings) {
        r.z -= v; if (r.z <= 2) r.z = 500;
        const p = focal / r.z;
        ctx.strokeStyle = `rgba(236,238,240,${Math.min(0.16, p * 0.12)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(cx, cy, 210 * p, 0, Math.PI * 2); ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  if (!show) return null;

  return (
    <div className={`boot${fading ? ' out' : ''}`} aria-hidden>
      <canvas ref={canvas} className="boot-cv" />
      <div className="boot-head"><span>SYS_BRUT // SB-00</span><span>{ready ? 'SYS_ACTIVE' : 'SYS_STANDBY'}</span></div>
      <ul className="boot-nodes">
        {NODES.map((n, i) => (
          <li key={n} className={i < done ? 'on' : ''}><span>{n}</span><span>{i < done ? 'OK' : '·'}</span></li>
        ))}
      </ul>
      {ready && (
        <div className="boot-badge">
          <div className="b-title">SYSTEME BRUT</div>
          <div className="b-sub">INITIALIZATION SEQUENCE SUCCESSFUL</div>
        </div>
      )}
      <style>{`
        .boot { position: fixed; inset: 0; z-index: 999; background: #050505; overflow: hidden;
          opacity: 1; transition: opacity .5s steps(3); }
        .boot.out { opacity: 0; pointer-events: none; }
        .boot-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
        .boot-head, .boot-nodes li { font-family: var(--font-mono); font-size: 9px;
          letter-spacing: .15em; text-transform: uppercase; }
        .boot-head { position: absolute; top: 22px; left: 24px; right: 24px;
          display: flex; justify-content: space-between; color: var(--dim);
          border-bottom: 1px solid var(--line-soft); padding-bottom: 8px; }
        .boot-nodes { position: absolute; top: 64px; left: 24px; margin: 0; padding: 0;
          list-style: none; width: 220px; }
        .boot-nodes li { display: flex; justify-content: space-between; margin-bottom: 6px;
          color: #1c1c1e; transition: color .3s; }
        .boot-nodes li.on { color: var(--text); }
        .boot-badge { position: absolute; top: 47%; left: 50%; transform: translate(-50%, -50%);
          text-align: center; }
        .b-title { color: var(--text); font-family: var(--font-cap); font-weight: 700;
          font-size: 30px; letter-spacing: .04em; line-height: 1; }
        .b-sub { color: var(--dim); font-family: var(--font-mono); font-size: 8px;
          letter-spacing: .28em; margin-top: 8px; }
      `}</style>
    </div>
  );
}
