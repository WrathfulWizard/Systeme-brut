'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Boot sequence — systeme brut × ghost in the shell. A diving glyph-rain field,
 * a decrypting title, HUD telemetry and the nodes mounting one by one before the
 * hub takes over. Shows once per app launch (sessionStorage), respects
 * reduced-motion. Stays monochrome — magenta means "flag", never decoration.
 */

const NODES = ['cardio', 'lifting', 'pharmacology', 'substrate', 'flags', 'connections', 'synthesizer'];
const GLYPHS = 'アカサタナハマヤラワ0123456789ABCDEF<>/\\[]{}=+*';
const TITLE = 'SYSTEME BRUT';
const SCRAMBLE = 'アカサ#%&/\\<>0189ABEF';
const rnd = (s: string) => s[Math.floor(Math.random() * s.length)];

export default function BootSplash() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(0);   // nodes mounted
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('············');
  const [addr, setAddr] = useState('0x0000');
  const canvas = useRef<HTMLCanvasElement>(null);
  const accel = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('sb-booted')) { setShow(false); return; }
    sessionStorage.setItem('sb-booted', '1');

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dismiss = () => { setFading(true); setTimeout(() => setShow(false), 560); };
    if (reduce) { setTitle(TITLE); setReady(true); const t = setTimeout(dismiss, 500); return () => clearTimeout(t); }

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
    timers.push(setTimeout(dismiss, bootMs + 1500));

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
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={`boot${fading ? ' out' : ''}`} aria-hidden>
      <canvas ref={canvas} className="boot-cv" />
      <div className="boot-scan" />
      <div className="boot-vig" />

      <div className="boot-hud th">SYS_BRUT // SB-00 · CORTEX_LINK</div>
      <div className="boot-hud tr">{ready ? 'SYS_ACTIVE' : 'SYS_STANDBY'} · {addr}</div>
      <div className="boot-hud bl">MOUNTING NODES · {done}/{NODES.length}</div>
      <div className="boot-hud br">{ready ? 'MOUNT_OK' : 'INJECTING…'}</div>

      <div className="boot-reticle"><span /><span /><i /></div>

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
        <div className="boot-sub">{ready ? 'INITIALIZATION SEQUENCE COMPLETE' : 'DECRYPTING BIOMETRIC CORE'}</div>
        <div className="boot-bar"><i style={{ width: `${Math.round((done / NODES.length) * 100)}%` }} /></div>
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
          transform: translate(-50%,-50%); opacity: .25; }
        .boot-reticle span { position: absolute; inset: 0; border: 1px solid rgba(236,238,240,.4); border-radius: 50%;
          animation: spin 16s linear infinite; }
        .boot-reticle span:nth-child(2) { inset: 46px; border-style: dashed; animation-direction: reverse; animation-duration: 24s; }
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
          color: var(--d); margin-top: 12px; }
        .boot-bar { width: 240px; height: 1px; margin: 16px auto 0; background: rgba(236,238,240,.14); }
        .boot-bar i { display: block; height: 100%; background: var(--ink); transition: width .3s ease;
          box-shadow: 0 0 8px rgba(236,238,240,.6); }
      `}</style>
    </div>
  );
}
