'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Boot sequence — systeme brut × ghost in the shell. A perspective tunnel of
 * concentric rings diving toward the viewer, a cortex-link brain wireframe, the
 * nodes mounting one by one, and a final warp once SB-Σ's launch briefing is
 * ready. Subtle, monochrome (magenta means "flag", never decoration), big depth.
 *
 * The sequence does not finish until the briefing resolves: after the nodes
 * mount it holds in a "compiling" cruise until the backend signals ready, then
 * warps out. A hard cap and click-to-skip keep it from ever hanging. Shows once
 * per launch (sessionStorage); respects reduced-motion.
 */

const NODES = ['cardio', 'lifting', 'pharmacology', 'substrate', 'flags', 'connections', 'synthesizer'];
const TITLE = 'SYSTEME BRUT';
const SCRAMBLE = 'アカサ#%&/\\<>0189ABEF';
const SYNTH_CAP_MS = 45_000;
const rnd = (s: string) => s[Math.floor(Math.random() * s.length)];

export default function BootSplash() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(0);
  const [ready, setReady] = useState(false);
  const [synth, setSynth] = useState(false);
  const [warp, setWarp] = useState(false);
  const [title, setTitle] = useState('············');
  const [addr, setAddr] = useState('0x000000');
  const [vz, setVz] = useState('0.20');
  const canvas = useRef<HTMLCanvasElement>(null);
  const brain = useRef<HTMLCanvasElement>(null);
  const speed = useRef(0.55);
  const focal = useRef(220);
  const loaded = useRef(false);

  const baseDone = useRef(false);
  const reviewDone = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('sb-booted')) { setShow(false); return; }
    sessionStorage.setItem('sb-booted', '1');

    const hide = () => { setFading(true); setTimeout(() => setShow(false), 620); };
    const doWarp = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      setSynth(false); setWarp(true); setReady(true);
      loaded.current = true;
      setTimeout(hide, 1050);     // let the warp blow through, then fade
    };
    const tryWarp = () => { if (baseDone.current && reviewDone.current) doWarp(); };
    const markBaseDone = () => { baseDone.current = true; setSynth(!reviewDone.current); tryWarp(); };
    const markReviewDone = () => { reviewDone.current = true; setSynth(false); tryWarp(); };

    // gate 2 — the launch briefing
    let offReview: (() => void) | undefined;
    const sb = window.sb;
    if (!sb) reviewDone.current = true;
    else {
      sb.getStartupReview().then((r) => { if (r.status !== 'pending') markReviewDone(); }).catch(() => markReviewDone());
      offReview = sb.onReviewReady((r) => { if (r.status !== 'pending') markReviewDone(); });
    }
    const cap = setTimeout(markReviewDone, SYNTH_CAP_MS);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      // Motion-sensitive users shouldn't sit on a static splash waiting on the
      // briefing — release immediately; the review still seeds the hub when ready.
      reviewDone.current = true;
      setTitle(TITLE); setReady(true); setDone(NODES.length);
      const t = setTimeout(markBaseDone, 500);
      return () => { clearTimeout(t); clearTimeout(cap); offReview?.(); };
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    NODES.forEach((_, i) => timers.push(setTimeout(() => setDone(i + 1), 250 * (i + 1))));
    const bootMs = 250 * NODES.length;

    let frame = 0;
    const decrypt = setInterval(() => {
      frame++;
      const locked = Math.floor((frame / 26) * TITLE.length);
      setTitle(TITLE.split('').map((ch, i) => (ch === ' ' ? ' ' : i < locked ? ch : rnd(SCRAMBLE))).join(''));
      if (locked >= TITLE.length) { clearInterval(decrypt); setTitle(TITLE); }
    }, 45);
    const hex = setInterval(() => setAddr('0x' + Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')), 90);

    timers.push(setTimeout(() => { loaded.current = true; setReady(true); }, bootMs + 200));
    timers.push(setTimeout(markBaseDone, bootMs + 700));

    /* ---- perspective tunnel + cortex brain (canvas) --------------------- */
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const bc = brain.current!;
    const bx = bc.getContext('2d')!;
    let rings: { z: number }[] = [];
    let stars: { a: number; r: number; z: number }[] = [];
    let rot = 0, bRot = 0, raf = 0, tick = 0;

    const resize = () => {
      cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
      bc.width = bc.offsetWidth; bc.height = bc.offsetHeight;
      rings = Array.from({ length: 22 }, (_, i) => ({ z: 20 + i * 26 }));
      stars = Array.from({ length: 70 }, () => ({ a: Math.random() * Math.PI * 2, r: 60 + Math.random() * 220, z: Math.random() * 520 }));
    };
    resize();
    window.addEventListener('resize', resize);

    const drawBrain = () => {
      bx.clearRect(0, 0, bc.width, bc.height);
      bx.fillStyle = loaded.current ? 'rgba(236,238,240,0.9)' : 'rgba(120,122,126,0.6)';
      bRot += 0.012;
      const cx = bc.width / 2, cy = bc.height / 2;
      for (let i = 0; i < 84; i++) {
        const a = (i / 84) * Math.PI * 2 + bRot;
        const r = 16 + Math.sin(a * 5) * 2.4;
        let x = cx + Math.cos(a) * r * 1.5, y = cy + Math.sin(a) * r;
        if (Math.abs(Math.sin(a)) < 0.18) x += Math.cos(a) > 0 ? 1 : -1;   // central fissure
        bx.fillRect(x, y, 1, 1);
      }
    };

    const draw = () => {
      const cx = cv.width / 2, cy = cv.height / 2;
      // warp ramp
      if (warpRef.current) { speed.current += 0.9; focal.current += 6; }
      else if (loaded.current) { speed.current += (1.5 - speed.current) * 0.03; }
      const sp = speed.current;
      if ((tick++ & 7) === 0) setVzRef.current(sp.toFixed(2));   // ~8fps readout, not every frame

      ctx.fillStyle = warpRef.current ? 'rgba(5,5,6,0.30)' : 'rgba(5,5,6,0.34)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      rot += 0.0016 + sp * 0.0006;

      // streak starfield — faint motion lines toward the vanishing point
      for (const s of stars) {
        s.z -= sp * 1.6; if (s.z <= 1) { s.z = 520; s.a = Math.random() * Math.PI * 2; s.r = 60 + Math.random() * 220; }
        const p = focal.current / s.z, p2 = focal.current / (s.z + sp * 1.6);
        const x = cx + Math.cos(s.a + rot) * s.r * p, y = cy + Math.sin(s.a + rot) * s.r * p;
        const x2 = cx + Math.cos(s.a + rot) * s.r * p2, y2 = cy + Math.sin(s.a + rot) * s.r * p2;
        ctx.strokeStyle = `rgba(236,238,240,${Math.min(0.5, p * 0.5)})`;
        ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
      }

      // concentric rings — the tunnel
      for (const ring of rings) {
        ring.z -= sp; if (ring.z <= 4) ring.z += 22 * 26;
        const p = focal.current / ring.z;
        const r = 210 * p;
        if (r < 2 || r > Math.max(cv.width, cv.height)) continue;
        const fade = Math.min(1, ring.z / 80) * Math.min(1, (560 - ring.z) / 360);
        ctx.strokeStyle = `rgba(236,238,240,${(loaded.current ? 0.16 : 0.1) * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        // a few rotating radial ticks make the spin legible
        if (ring.z < 220) {
          for (let k = 0; k < 6; k++) {
            const a = rot * 2 + (k / 6) * Math.PI * 2;
            ctx.strokeStyle = `rgba(236,238,240,${0.12 * fade})`;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.stroke();
          }
        }
      }

      if (warpRef.current) {   // bloom toward white as we punch through
        ctx.fillStyle = `rgba(236,238,240,${Math.min(0.5, (speed.current - 2) * 0.02)})`;
        ctx.fillRect(0, 0, cv.width, cv.height);
      }

      drawBrain();
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      timers.forEach(clearTimeout); clearInterval(decrypt); clearInterval(hex);
      clearTimeout(cap); offReview?.();
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
    };
  }, []);

  // refs the rAF loop reads (state would be stale inside the closure)
  const warpRef = useRef(false); warpRef.current = warp;
  const setVzRef = useRef(setVz); setVzRef.current = setVz;

  if (!show) return null;

  const skip = () => {
    if (dismissed.current) return;
    dismissed.current = true; reviewDone.current = true; baseDone.current = true;
    setSynth(false); setWarp(true); loaded.current = true;
    setTimeout(() => { setFading(true); setTimeout(() => setShow(false), 620); }, 700);
  };

  return (
    <div className={`boot${fading ? ' out' : ''}${warp ? ' warp' : ''}`} aria-hidden onClick={synth ? skip : undefined}>
      <canvas ref={canvas} className="boot-cv" />
      <div className="boot-vig" />

      <div className="boot-hud th">SYS_BRUT // SB-00 · CORTEX_LINK</div>
      <div className="boot-hud tr">{warp ? 'WARP' : ready ? 'SYS_ACTIVE' : 'SYS_STANDBY'} · {addr}</div>

      <ul className="boot-nodes">
        {NODES.map((n, i) => (
          <li key={n} className={i < done ? 'on' : ''}>
            <span className="bn-i">{String(i + 1).padStart(2, '0')}</span>
            <span className="bn-n">{n}</span>
            <span className="bn-s">{i < done ? 'OK' : '··'}</span>
          </li>
        ))}
      </ul>

      <div className="boot-comm">
        <div className="cm-l">[ CORTEX_LINK ]</div>
        <canvas ref={brain} className="boot-brain" />
        <div className="cm-t">{warp ? 'MOUNT_OK' : synth ? `SB-Σ · COMPILING` : ready ? 'MOUNT_OK' : `INJ_${NODES[Math.min(done, NODES.length - 1)]}`}</div>
      </div>

      <div className="boot-center">
        <div className="boot-title">{title}</div>
        <div className="boot-sub">
          {warp ? 'INITIALIZATION SEQUENCE COMPLETE'
            : synth ? 'SB-Σ · SYNTHESIZING LAUNCH BRIEFING'
            : ready ? 'CORE ONLINE · STAND BY'
            : 'DECRYPTING BIOMETRIC CORE'}
        </div>
        <div className={`boot-bar${synth ? ' indet' : ''}`}>
          <i style={synth || warp ? undefined : { width: `${Math.round((done / NODES.length) * 100)}%` }} />
        </div>
        {synth && <div className="boot-skip">CLICK TO SKIP</div>}
      </div>

      <div className="boot-hud bl">V_Z: {vz}</div>
      <div className="boot-hud br">MOUNTING · {done}/{NODES.length}</div>

      <style>{`
        .boot { position: fixed; inset: 0; z-index: 999; background: #050506; overflow: hidden;
          opacity: 1; transition: opacity .62s ease; --ink: #eceef0; --d: #86888c; }
        .boot.out { opacity: 0; pointer-events: none; }
        .boot-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
        .boot-vig { position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(125% 95% at 50% 48%, transparent 52%, rgba(0,0,0,.72) 100%); }
        .boot-hud { position: absolute; font-family: var(--font-mono); font-size: 9px; letter-spacing: .22em;
          text-transform: uppercase; color: var(--d); z-index: 2; }
        .boot-hud.th { top: 22px; left: 24px; } .boot-hud.tr { top: 22px; right: 24px; }
        .boot-hud.bl { bottom: 22px; left: 24px; color: var(--ink); } .boot-hud.br { bottom: 22px; right: 24px; }
        .boot-nodes { position: absolute; top: 50%; left: 26px; transform: translateY(-50%); margin: 0; padding: 0;
          list-style: none; width: 210px; z-index: 2; }
        .boot-nodes li { display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
          color: #1b1b1c; transition: color .3s ease, transform .3s ease; transform: translateX(-4px); }
        .boot-nodes li.on { color: var(--ink); transform: none; }
        .boot-nodes .bn-i { color: var(--d); font-size: 8px; } .boot-nodes li.on .bn-i { color: var(--ink); }
        .boot-nodes .bn-n { flex: 1; } .boot-nodes .bn-s { color: var(--d); }
        .boot-comm { position: absolute; right: 26px; bottom: 64px; width: 184px; z-index: 2;
          border-left: 1px solid #161618; padding-left: 14px; }
        .boot-comm .cm-l { color: #2a2a2c; font-size: 7px; letter-spacing: .2em; }
        .boot-brain { width: 100%; height: 62px; display: block; margin: 6px 0; }
        .boot-comm .cm-t { color: var(--d); font-size: 7px; letter-spacing: .18em; }
        .boot-center { position: absolute; top: 47%; left: 50%; transform: translate(-50%,-50%); text-align: center; width: 460px; z-index: 2; }
        .boot-title { font-family: var(--font-cap); font-weight: 700; font-size: 40px; letter-spacing: .12em;
          color: #fff; line-height: 1; text-shadow: 0 0 22px rgba(236,238,240,.22); transition: letter-spacing .6s ease, text-shadow .6s ease; }
        .boot.warp .boot-title { letter-spacing: .26em; text-shadow: 0 0 40px rgba(236,238,240,.6); }
        .boot-sub { font-family: var(--font-mono); font-size: 8px; letter-spacing: .42em; text-transform: uppercase;
          color: var(--d); margin-top: 13px; transition: color .4s ease; }
        .boot.warp .boot-sub { color: var(--ink); }
        .boot-bar { width: 240px; height: 1px; margin: 16px auto 0; background: rgba(236,238,240,.14); overflow: hidden; }
        .boot-bar i { display: block; height: 100%; background: var(--ink); transition: width .3s ease;
          box-shadow: 0 0 8px rgba(236,238,240,.6); }
        .boot-bar.indet i { width: 38%; animation: sweep 1.15s cubic-bezier(.5,0,.5,1) infinite; }
        @keyframes sweep { 0% { transform: translateX(-110%); } 100% { transform: translateX(370%); } }
        .boot-skip { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: .4em; text-transform: uppercase;
          color: var(--d); margin-top: 14px; opacity: .55; animation: skippulse 2.4s ease-in-out infinite; }
        @keyframes skippulse { 0%,100% { opacity: .25; } 50% { opacity: .7; } }
        @media (prefers-reduced-motion: reduce) { .boot-bar.indet i { animation: none; width: 100%; } .boot-skip { animation: none; } }
      `}</style>
    </div>
  );
}
