'use client';

/**
 * SERUM DYNAMICS — one organic BIOMASS per active compound. Each is a
 * noise-deformed sphere that breathes and shifts shape like a living organism,
 * drifting near the centre so they overlap and bleed into one another. A
 * compound gains prominence — bigger, brighter, more present — as its estimated
 * serum level rises and (especially) once it reaches steady state. Each compound
 * keeps its own custom colour.
 *
 * Built on Three.js standard meshes (deformed IcosahedronGeometry +
 * MeshPhysicalMaterial), not a hand-rolled raymarch shader, so it compiles on
 * effectively any GPU. If WebGL is unavailable it falls back to an always-on
 * Canvas2D render of the same biomasses, so the visual is never a black box.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SerumCompound, SerumCharacter } from '@/lib/types';

interface CharParams { amp: number; freq: number; speed: number; wobble: number; }
// How each compound's biomass moves: steady = calm swells, confident = smooth
// fuller body, oscillating = jittery and restless, saturated = big slow heaves.
const CHAR: Record<SerumCharacter, CharParams> = {
  steady:      { amp: 0.18, freq: 1.6, speed: 0.5, wobble: 0.05 },
  confident:   { amp: 0.22, freq: 1.3, speed: 0.6, wobble: 0.06 },
  oscillating: { amp: 0.30, freq: 2.6, speed: 1.5, wobble: 0.22 },
  saturated:   { amp: 0.26, freq: 1.0, speed: 0.32, wobble: 0.04 },
};

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
    camera.position.set(0, 0, 6.4);

    scene.add(new THREE.AmbientLight(0x44485a, 1.4));
    const key = new THREE.DirectionalLight(0xfff1e0, 1.4); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.7); fill.position.set(-4, -2, 3); scene.add(fill);

    // starfield
    const starN = 360;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 22;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      starPos[i * 3 + 2] = -4 - Math.random() * 12;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb3c8, size: 0.045, transparent: true, opacity: 0.65 }));
    scene.add(stars);

    interface Blob {
      mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; halo: THREE.Mesh; haloMat: THREE.MeshBasicMaterial;
      base: Float32Array; // unit directions per vertex (x,y,z)
      seed: number;
    }
    let blobs: Blob[] = [];

    const buildBlobs = () => {
      for (const b of blobs) {
        scene.remove(b.mesh); scene.remove(b.halo);
        b.mesh.geometry.dispose(); b.mat.dispose(); b.halo.geometry.dispose(); b.haloMat.dispose();
      }
      blobs = dataRef.current.map((c, i) => {
        const col = new THREE.Color(c.color);
        const geo = new THREE.IcosahedronGeometry(1, 4); // ~2562 verts: smooth organism
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const base = new Float32Array(pos.array.length);
        for (let k = 0; k < pos.count; k++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, k).normalize();
          base[k * 3] = v.x; base[k * 3 + 1] = v.y; base[k * 3 + 2] = v.z;
        }
        const mat = new THREE.MeshPhysicalMaterial({
          color: col, roughness: 0.34, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.4,
          transmission: 0.25, thickness: 1.2, ior: 1.25, transparent: true, opacity: 0.9,
          emissive: col.clone().multiplyScalar(0.25),
        });
        const mesh = new THREE.Mesh(geo, mat);
        // soft additive halo so neighbouring biomasses bleed into each other
        const haloMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), haloMat);
        scene.add(mesh); scene.add(halo);
        return { mesh, mat, halo, haloMat, base, seed: i * 1.37 };
      });
    };
    buildBlobs();
    let builtFor = dataRef.current.length;

    const tmp = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      const t = clock.getElapsedTime();
      const data = dataRef.current;
      if (data.length !== builtFor) { buildBlobs(); builtFor = data.length; }
      const peak = Math.max(1, ...data.map((c) => c.current));
      const n = data.length;

      data.forEach((c, i) => {
        const b = blobs[i]; if (!b) return;
        const p = CHAR[c.character];
        const lvl = Math.max(0.16, c.current / peak);              // relative serum level
        const prominence = lvl * (c.steadyState ? 1.0 : 0.7) * (c.discontinued ? 0.6 : 1);
        const size = 0.55 + 1.15 * prominence;                     // bigger with dose + steadiness

        // organic deformation of every vertex along its direction
        const geo = b.mesh.geometry as THREE.IcosahedronGeometry;
        const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const a = p.amp, f = p.freq, s = t * p.speed + b.seed;
        for (let k = 0; k < arr.length; k += 3) {
          const dx = b.base[k], dy = b.base[k + 1], dz = b.base[k + 2];
          const noise =
            Math.sin(dx * f * 2.0 + s) * 0.5 +
            Math.sin(dy * f * 2.6 - s * 1.3) * 0.32 +
            Math.sin(dz * f * 3.1 + s * 0.7) * 0.28 +
            p.wobble * Math.sin((dx + dy) * 7.0 + s * 3.2);
          const r = size * (1 + a * noise);
          arr[k] = dx * r; arr[k + 1] = dy * r; arr[k + 2] = dz * r;
        }
        (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        geo.computeVertexNormals();

        // drift the biomasses so they overlap and shift into one another
        const ang = (i / Math.max(1, n)) * Math.PI * 2 + t * 0.06;
        const spread = n > 1 ? 1.5 : 0;
        const cx = Math.cos(ang) * spread + Math.sin(t * 0.3 + b.seed) * 0.18;
        const cy = Math.sin(ang) * spread * 0.6 + Math.cos(t * 0.24 + b.seed) * 0.16;
        const cz = Math.sin(t * 0.2 + b.seed) * 0.4;
        b.mesh.position.set(cx, cy, cz);
        b.halo.position.set(cx, cy, cz);
        b.halo.scale.setScalar(size * 2.1);

        b.mat.emissiveIntensity = 0.2 + 0.9 * prominence;
        b.mat.opacity = 0.55 + 0.4 * prominence;
        b.haloMat.opacity = 0.04 + 0.10 * prominence;
      });

      camera.position.x = Math.sin(t * 0.12) * 0.6;
      camera.position.y = Math.sin(t * 0.08) * 0.3;
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
      for (const b of blobs) { b.mesh.geometry.dispose(); b.mat.dispose(); b.halo.geometry.dispose(); b.haloMat.dispose(); }
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

/* ---- Canvas2D fallback — biomass blobs, no WebGL needed ------------------- */
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

    const stars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2 }));
    let raf = 0; const t0 = performance.now();
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, t = (performance.now() - t0) / 1000;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#070708'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(159,179,200,0.5)';
      for (const s of stars) { ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 7); ctx.fill(); }

      const data = dataRef.current;
      const peak = Math.max(1, ...data.map((c) => c.current));
      const n = data.length;
      ctx.globalCompositeOperation = 'lighter';      // biomasses bleed into each other
      data.forEach((c, i) => {
        const p = CHAR[c.character];
        const lvl = Math.max(0.16, c.current / peak);
        const prominence = lvl * (c.steadyState ? 1 : 0.7) * (c.discontinued ? 0.6 : 1);
        const ang = (i / Math.max(1, n)) * Math.PI * 2 + t * 0.06;
        const spread = n > 1 ? Math.min(w, h) * 0.18 : 0;
        const cx = w / 2 + Math.cos(ang) * spread + Math.sin(t * 0.3 + i) * 12;
        const cy = h / 2 + Math.sin(ang) * spread * 0.7 + Math.cos(t * 0.24 + i) * 10;
        const R = (18 + 64 * prominence);
        // wobbly organic outline
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * Math.PI * 2;
          const wob = 1 + p.amp * (Math.sin(a * 3 + t * p.speed + i) * 0.5 + Math.sin(a * 5 - t * p.speed) * 0.3) + p.wobble * Math.sin(a * 9 + t * 3);
          const rr = R * wob;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.2);
        g.addColorStop(0, hexA(c.color, 0.55 * prominence + 0.25));
        g.addColorStop(1, hexA(c.color, 0));
        ctx.fillStyle = g; ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(160,160,170,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* ---- legend overlay (HTML, reliable + legible) --------------------------- */
function SerumLegend({ compounds }: { compounds: SerumCompound[] }) {
  if (compounds.length === 0) {
    return <div className="serum-legend empty">No active compound — add a protocol to model serum dynamics.</div>;
  }
  return (
    <div className="serum-legend">
      {compounds.map((c) => (
        <div key={c.key + c.label} className="srow">
          <span className="dot" style={{ background: c.color }} />
          <span className="lbl">{c.label}</span>
          <span className="sub">{c.klass} · t½ {c.halfLifeDays}d{c.steadyState ? ' · steady' : ''}</span>
          <span className="mg">{c.current}mg</span>
        </div>
      ))}
    </div>
  );
}
