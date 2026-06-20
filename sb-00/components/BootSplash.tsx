'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Boot sequence — systeme brut × ghost in the shell. A diving glyph-rain field,
 * a decrypting title, HUD telemetry and the nodes mounting one by one before the
 * hub takes over. Shows once per app launch (sessionStorage), respects
 * reduced-motion. Stays monochrome — magenta means "flag", never decoration.
 *
 * The sequence does not finish until SB-Σ's launch briefing is ready: after the
 * nodes mount it holds in a "synthesizing" state until the backend signals the
 * review has resolved (ready or unavailable), so the hub opens with a full
 * review already waiting. A hard cap and click-to-skip keep it from ever hanging.
 */

const NODES = ['cardio', 'lifting', 'pharmacology', 'substrate', 'flags', 'connections', 'synthesizer'];
const GLYPHS = 'アカサタナハマヤラワ0123456789ABCDEF<>/\\[]{}=+*';
const TITLE = 'SYSTEME BRUT';
const SCRAMBLE = 'アカサ#%&/\\<>0189ABEF';
const SYNTH_CAP_MS = 45_000;   // never hold the boot longer than this
const rnd = (s: string) => s[Math.floor(Math.random() * s.length)];

export default function BootSplash() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(0);     // nodes mounted
  const [ready, setReady] = useState(false);
  const [synth, setSynth] = useState(false);   // base done, awaiting briefing
  const [title, setTitle] = useState('············');
  const [addr, setAddr] = useState('0x0000');
  const canvas = useRef<HTMLCanvasElement>(null);
  const accel = useRef(false);

  // Two gates must both close before the boot dismisses: the base animation and
  // the launch briefing. Kept in refs so async callbacks read current values.
  const baseDone = useRef(false);
  const reviewDone = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('sb-booted')) { setShow(false); return; }
    sessionStorage.setItem('sb-booted', '1');

    const dismiss = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      setFading(true);
      setTimeout(() => setShow(false), 560);
    };
    // Dismiss only once BOTH gates are closed.
    const tryDismiss = () => { if (baseDone.current && reviewDone.current) dismiss(); };
    const markBaseDone = () => { baseDone.current = true; setSynth(!reviewDone.current); tryDismiss(); };
    const markReviewDone = () => { reviewDone.current = true; setSynth(false); tryDismiss(); };

    // --- gate 2: the launch briefing ---------------------------------------
    // In a plain browser there's no agent, so don't wait. On desktop, hold until
    // the backend signals the review resolved — capped so we never hang.
    let offReview: (() => void) | undefined;
    const sb = window.sb;
    if (!sb) {
      reviewDone.current = true;
    } else {
      sb.getStartupReview().then((r) => { if (r.status !== 'pending') markReviewDone(); }).catch(() => markReviewDone());
      offReview = sb.onReviewReady((r) => { if (r.status !== 'pending') markReviewDone(); });
    }
    const cap = setTimeout(markReviewDone, SYNTH_CAP_MS);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setTitle(TITLE); setReady(true); setDone(NODES.length);
      const t = setTimeout(markBaseDone, 500);
      return () => { clearTimeout(t); clearTimeout(cap); offReview?.(); };
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    NODES.forEach((_, i) => timers.push(setTimeout(() => setDone(i + 1), 230 * (i + 1))));
    const bootMs = 230 * NODES.length;

    // title decrypt — resolves letter by letter
    let frame = 0;
    const decrypt = setInterval(() => {
      frame++;
      const locked = Math.floor((frame / 26) * TITLE.length);
      setTitle(TITLE.split('').map((ch, i) => (ch === ' ' ? ' ' : i < locked ? ch : rnd(SCRAMBLE))).join(''));
      if (locked >= TITLE.length) { clearInterval(decrypt); setTitle(TITLE); }
    }, 45);

    const hex = setInterval(() => setAddr('0x' + Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')), 90);

    timers.push(setTimeout(() => { accel.current = true; setReady(true); }, bootMs + 360));
    // Base animation complete — now the briefing gate decides when we open.
    timers.push(setTimeout(markBaseDone, bootMs + 900));

    // diving glyph-rain field
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let cols: number[] = [];
    const FONT = 14;
    const resize = () => {
      cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
      cols = Array(Math.ceil(cv.width / FONT)).fill(0).map(() => Math.random() * cv.height);
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = 'rgba(5,5,6,0.22)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = `${FONT}px monospace`;
      const speed = accel.current ? 46 : 16;
      for (let i = 0; i < cols.length; i++) {
        const x = i * FONT, y = cols[i];
        ctx.fillStyle = 'rgba(236,238,240,0.92)';            // bright head
        ctx.fillText(rnd(GLYPHS), x, y);
        ctx.fillStyle = 'rgba(134,136,140,0.30)';            // dim trail
        ctx.fillText(rnd(GLYPHS), x, y - FONT);
        cols[i] = y > cv.height + Math.random() * 240 ? 0 : y + speed;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      timers.forEach(clearTimeout); clearInterval(decrypt); clearInterval(hex);
      clearTimeout(cap); offReview?.();
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
    };
  }, []);

  if (!show) return null;

  // Once the nodes are mounted but the briefing isn't ready yet, the HUD shifts
  // to a "synthesizing" readout so the hold reads as intent, not a stall.
  const skip = () => { reviewDone.current = true; baseDone.current = true; setSynth(false); setFading(true); setTimeout(() => setShow(false), 560); };

  return (
    <div className={`boot${fading ? ' out' : ''}`} aria-hidden onClick={synth ? skip : undefined}>
      <canvas ref={canvas} className="boot-cv" />
      <div className="boot-scan" />
      <div className="boot-vig" />

      <div className="boot-hud th">SYS_BRUT // SB-00 · CORTEX_LINK</div>
      <div className="boot-hud tr">{ready ? 'SYS_ACTIVE' : 'SYS_STANDBY'} · {addr}</div>
      <div className="boot-hud bl">{synth ? 'SB-Σ // COMPILING BRIEFING' : `MOUNTING NODES · ${done}/${NODES.length}`}</div>
      <div className="boot-hud br">{synth ? 'STAND BY' : ready ? 'MOUNT_OK' : 'INJECTING…'}</div>

      <div className={`boot-reticle${synth ? ' synth' : ''}`}><span /><span /><i /></div>

      <ul className="boot-nodes">
        {NODES.map((n, i) => (
          <li key={n} className={i < done ? 'on' : ''}>
            <span className="bn-i">{String(i + 1).padStart(2, '0')}</span>
            <span className="bn-n">{n}</span>
            <span className="bn-s">{i < done ? 'OK' : '··'}</span>
          </li>
        ))}
      </ul>

      <div className="boot-center">
        <div className="boot-title">{title}</div>
        <div className="boot-sub">
          {synth ? 'SB-Σ · SYNTHESIZING LAUNCH BRIEFING' : ready ? 'INITIALIZATION SEQUENCE COMPLETE' : 'DECRYPTING BIOMETRIC CORE'}
        </div>
        <div className={`boot-bar${synth ? ' indet' : ''}`}>
          <i style={synth ? undefined : { width: `${Math.round((done / NODES.length) * 100)}%` }} />
        </div>
        {synth && <div className="boot-skip">CLICK TO SKIP</div>}
      </div>

      <style>{`
        .boot { position: fixed; inset: 0; z-index: 999; background: #050506; overflow: hidden;
          opacity: 1; transition: opacity .56s ease; --ink: #eceef0; --d: #86888c; }
        .boot.out { opacity: 0; pointer-events: none; }
        .boot-cv { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .5; }
        .boot-scan { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay;
          background: repeating-linear-gradient(to bottom, rgba(255,255,255,.04) 0 1px, transparent 1px 3px);
          animation: scan 7s linear infinite; }
        @keyframes scan { to { background-position: 0 600px; } }
        .boot-vig { position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,.7) 100%); }
        .boot-hud { position: absolute; font-family: var(--font-mono); font-size: 9px; letter-spacing: .22em;
          text-transform: uppercase; color: var(--d); }
        .boot-hud.th { top: 22px; left: 24px; } .boot-hud.tr { top: 22px; right: 24px; }
        .boot-hud.bl { bottom: 22px; left: 24px; } .boot-hud.br { bottom: 22px; right: 24px; color: var(--ink); }
        .boot-reticle { position: absolute; top: 50%; left: 50%; width: 320px; height: 320px;
          transform: translate(-50%,-50%); opacity: .25; transition: opacity .5s ease; }
        .boot-reticle.synth { opacity: .4; }
        .boot-reticle span { position: absolute; inset: 0; border: 1px solid rgba(236,238,240,.4); border-radius: 50%;
          animation: spin 16s linear infinite; }
        .boot-reticle.synth span { animation-duration: 5s; }
        .boot-reticle span:nth-child(2) { inset: 46px; border-style: dashed; animation-direction: reverse; animation-duration: 24s; }
        .boot-reticle.synth span:nth-child(2) { animation-duration: 8s; }
        .boot-reticle i { position: absolute; top: 50%; left: 50%; width: 1px; height: 360px; background: rgba(236,238,240,.18);
          transform: translate(-50%,-50%); box-shadow: 0 0 0 0 transparent; }
        .boot-reticle i::after { content: ''; position: absolute; top: 50%; left: 50%; width: 360px; height: 1px;
          background: rgba(236,238,240,.18); transform: translate(-50%,-50%); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .boot-nodes { position: absolute; top: 50%; left: 26px; transform: translateY(-50%); margin: 0; padding: 0;
          list-style: none; width: 210px; }
        .boot-nodes li { display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
          color: #181819; transition: color .3s ease, transform .3s ease; transform: translateX(-4px); }
        .boot-nodes li.on { color: var(--ink); transform: none; }
        .boot-nodes .bn-i { color: var(--d); font-size: 8px; } .boot-nodes li.on .bn-i { color: var(--ink); }
        .boot-nodes .bn-n { flex: 1; } .boot-nodes .bn-s { color: var(--d); }
        .boot-center { position: absolute; top: 47%; left: 50%; transform: translate(-50%,-50%); text-align: center; width: 460px; }
        .boot-title { font-family: var(--font-cap); font-weight: 700; font-size: 38px; letter-spacing: .12em;
          color: #fff; line-height: 1; text-shadow: 0 0 18px rgba(236,238,240,.18); }
        .boot-sub { font-family: var(--font-mono); font-size: 8px; letter-spacing: .42em; text-transform: uppercase;
          color: var(--d); margin-top: 12px; transition: color .4s ease; }
        .boot-bar { width: 240px; height: 1px; margin: 16px auto 0; background: rgba(236,238,240,.14); overflow: hidden; }
        .boot-bar i { display: block; height: 100%; background: var(--ink); transition: width .3s ease;
          box-shadow: 0 0 8px rgba(236,238,240,.6); }
        /* synthesizing: the bar sweeps as an indeterminate scanner */
        .boot-bar.indet i { width: 38%; animation: sweep 1.15s cubic-bezier(.5,0,.5,1) infinite; }
        @keyframes sweep { 0% { transform: translateX(-110%); } 100% { transform: translateX(370%); } }
        .boot-skip { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: .4em; text-transform: uppercase;
          color: var(--d); margin-top: 14px; opacity: .55; animation: skippulse 2.4s ease-in-out infinite; }
        @keyframes skippulse { 0%,100% { opacity: .25; } 50% { opacity: .7; } }
        @media (prefers-reduced-motion: reduce) {
          .boot-bar.indet i { animation: none; width: 100%; }
          .boot-skip { animation: none; }
        }
      `}</style>
    </div>
  );
}
