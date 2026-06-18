'use client';

/**
 * SERUM DYNAMICS — one flowing stream per active compound, coloured and moving
 * to that compound's "character" (steady / confident / oscillating / saturated),
 * with thickness driven by its estimated serum level (half-life model upstream).
 *
 * Built on Three.js STANDARD meshes (TubeGeometry + MeshPhysicalMaterial), not
 * a hand-rolled raymarch shader — so it compiles on effectively any GPU that
 * runs Electron. If WebGL is unavailable it falls back to an always-on Canvas2D
 * render of the same streams, so the visual is never a black box.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SerumCompound, SerumCharacter } from '@/lib/types';

interface CharParams { amp: number; freq: number; speed: number; zAmp: number; radius: number; wobble: number; }
const CHAR: Record<SerumCharacter, CharParams> = {
  steady:      { amp: 0.34, freq: 0.8, speed: 0.5,  zAmp: 0.5, radius: 1.0,  wobble: 0.05 },
  confident:   { amp: 0.5,  freq: 0.6, speed: 0.6,  zAmp: 0.8, radius: 1.2,  wobble: 0.04 },
  oscillating: { amp: 0.9,  freq: 1.8, speed: 1.7,  zAmp: 0.6, radius: 0.85, wobble: 0.28 },
  saturated:   { amp: 0.3,  freq: 0.5, speed: 0.28, zAmp: 1.0, radius: 1.5,  wobble: 0.03 },
};

const POINTS = 11;        // spline control points along each stream
const SPAN = 4.4;         // half-width the stream flows across
const BASE_RADIUS = 0.17;

function streamCurve(c: SerumCompound, idx: number, count: number, t: number): THREE.CatmullRomCurve3 {
  const p = CHAR[c.character];
  const baseY = count > 1 ? 1.7 - (3.4 * idx) / (count - 1) : 0;
  const lane = idx * 1.7;
  const pts: THREE.Vector3[] = [];
  for (let j = 0; j < POINTS; j++) {
    const f = j / (POINTS - 1);
    const x = -SPAN + 2 * SPAN * f;
    const ph = t * p.speed + j * p.freq + lane;
    const y = baseY + p.amp * Math.sin(ph) + p.wobble * Math.sin(ph * 5.0 + lane);
    const z = p.zAmp * Math.cos(ph * 0.8 + idx) - 0.4;
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

export default function SerumLiquidRender({ compounds = [] }: { compounds?: SerumCompound[] }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<SerumCompound[]>(compounds);
  dataRef.current = compounds;
  const [renderError, setRenderError] = useState(false);

  // ---- WebGL (Three.js) primary path -------------------------------------
  useEffect(() => {
    if (renderError) return;
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      if (!renderer.getContext()) throw new Error('no gl context');
    } catch { setRenderError(true); return; }

    const W = mount.clientWidth || 480, H = mount.clientHeight || 240;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    renderer.setClearColor(0x070708, 1);
    mount.appendChild(renderer.domElement);

    const onLost = (e: Event) => { e.preventDefault(); setRenderError(true); };
    renderer.domElement.addEventListener('webglcontextlost', onLost, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070708);
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    scene.add(new THREE.AmbientLight(0x4a4a55, 1.3));
    const key = new THREE.DirectionalLight(0xfff1e0, 1.5); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.8); fill.position.set(-4, -2, 3); scene.add(fill);

    // starfield
    const starN = 380;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 22;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      starPos[i * 3 + 2] = -4 - Math.random() * 12;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb3c8, size: 0.045, transparent: true, opacity: 0.7 }));
    scene.add(stars);

    interface Ribbon { mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; }
    let ribbons: Ribbon[] = [];

    const buildRibbons = () => {
      for (const r of ribbons) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mat.dispose(); }
      ribbons = dataRef.current.map((c) => {
        const col = new THREE.Color(c.color);
        const mat = new THREE.MeshPhysicalMaterial({
          color: col, roughness: 0.28, metalness: 0.12, clearcoat: 0.9, clearcoatRoughness: 0.25,
          emissive: col.clone().multiplyScalar(0.12),
        });
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
        scene.add(mesh);
        return { mesh, mat };
      });
    };
    buildRibbons();
    let builtFor = dataRef.current.length;

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      const t = clock.getElapsedTime();
      const data = dataRef.current;
      if (data.length !== builtFor) { buildRibbons(); builtFor = data.length; }

      const peak = Math.max(1, ...data.map((c) => c.current));
      data.forEach((c, i) => {
        const rb = ribbons[i];
        if (!rb) return;
        const lvl = Math.max(0.12, c.current / peak);
        const radius = BASE_RADIUS * CHAR[c.character].radius * (0.35 + 0.75 * lvl);
        const curve = streamCurve(c, i, data.length, t);
        const geo = new THREE.TubeGeometry(curve, 70, radius, 14, false);
        rb.mesh.geometry.dispose();
        rb.mesh.geometry = geo;
      });

      camera.position.x = Math.sin(t * 0.12) * 0.7;
      camera.position.y = Math.sin(t * 0.08) * 0.35;
      camera.lookAt(0, 0, 0);
      stars.rotation.z = t * 0.005;

      try { renderer.render(scene, camera); }
      catch { cancelAnimationFrame(raf); setRenderError(true); return; }
      raf = requestAnimationFrame(animate);
    };
    animate();

    const gl = renderer.getContext();
    if (gl && gl.getError() !== gl.NO_ERROR) { cancelAnimationFrame(raf); setRenderError(true); }

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      for (const r of ribbons) { r.mesh.geometry.dispose(); r.mat.dispose(); }
      starGeo.dispose();
      try { mount.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderError]);

  return (
    <>
      {renderError
        ? <SerumCanvas2D compounds={compounds} />
        : <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />}
      <SerumLegend compounds={compounds} />
    </>
  );
}

/* ---- Canvas2D fallback — always renders, no WebGL needed ------------------ */
function SerumCanvas2D({ compounds }: { compounds: SerumCompound[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(compounds);
  dataRef.current = compounds;

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2 }));
    let raf = 0; const t0 = performance.now();
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, t = (performance.now() - t0) / 1000;
      ctx.fillStyle = '#070708'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(159,179,200,0.5)';
      for (const s of stars) { ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 7); ctx.fill(); }

      const data = dataRef.current;
      const peak = Math.max(1, ...data.map((c) => c.current));
      data.forEach((c, i) => {
        const p = CHAR[c.character];
        const lvl = Math.max(0.12, c.current / peak);
        const baseY = data.length > 1 ? h * (0.22 + (0.56 * i) / Math.max(1, data.length - 1)) : h * 0.5;
        const thick = (6 + 22 * lvl) * p.radius;
        ctx.save();
        ctx.shadowColor = c.color; ctx.shadowBlur = 16;
        ctx.strokeStyle = c.color; ctx.lineWidth = thick; ctx.lineCap = 'round';
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const f = x / w;
          const ph = t * p.speed + f * Math.PI * 2 * (1 + p.freq) + i;
          const y = baseY + p.amp * 26 * Math.sin(ph) + p.wobble * 30 * Math.sin(ph * 5 + i);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

/* ---- legend overlay (HTML, reliable + legible) --------------------------- */
function SerumLegend({ compounds }: { compounds: SerumCompound[] }) {
  if (compounds.length === 0) {
    return <div className="serum-legend empty">No active compound — add a protocol to model serum dynamics.</div>;
  }
  return (
    <div className="serum-legend">
      {compounds.map((c) => (
        <div key={c.key} className="srow">
          <span className="dot" style={{ background: c.color }} />
          <span className="lbl">{c.label}</span>
          <span className="sub">{c.klass} · t½ {c.halfLifeDays}d · {c.character}</span>
          <span className="mg">{c.current}mg</span>
        </div>
      ))}
    </div>
  );
}
