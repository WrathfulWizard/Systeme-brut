'use client';

/**
 * SB-00 serum "visual readout" — a glossy, liquid stand-in for the estimated
 * serum numbers in the ASCII matrix beneath it. Ported from the provided
 * serumliquidrender prototype: the WebGL/SDF raymarch shader is kept intact;
 * the full-screen demo chrome and sliders are removed so it drops into the
 * liquid-card. Levels are driven by data, not user input.
 *
 * Falls back silently to a static gradient field if WebGL is unavailable.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const COLORS = [
  new THREE.Vector3(0.21, 0.41, 0.76), // test — blue
  new THREE.Vector3(0.84, 0.70, 0.19), // anavar — gold
  new THREE.Vector3(0.90, 0.48, 0.17), // ambient warm
  new THREE.Vector3(0.80, 0.23, 0.21), // ambient red
];

const CENTERS = [
  new THREE.Vector3(-0.55, 0.32, 0.05),
  new THREE.Vector3(0.52, 0.38, -0.12),
  new THREE.Vector3(-0.18, -0.42, 0.18),
  new THREE.Vector3(0.32, -0.34, -0.16),
];

const TIERS = {
  high: { lobesPer: 6, branchSlots: 7, branchDepth: 3, steps: 60, aoSamples: 3, pixelCap: 1.5 },
  low: { lobesPer: 3, branchSlots: 2, branchDepth: 2, steps: 22, aoSamples: 1, pixelCap: 1.0 },
};

function detectTier(): keyof typeof TIERS {
  try {
    const ua = navigator.userAgent || '';
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const smallScreen = window.innerWidth < 700;
    if (isMobileUA || smallScreen) return 'low';
    return 'high';
  } catch {
    return 'low';
  }
}

const rndDir = () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);

interface Seg { start: THREE.Vector3; end: THREE.Vector3; radius: number; }

function genBranches(origin: THREE.Vector3, dir: THREE.Vector3, depth: number, len: number, baseRadius: number, segs: Seg[], branchSlots: number) {
  if (depth <= 0 || segs.length >= branchSlots) return;
  const d = dir.clone();
  d.x += (Math.random() - 0.5) * 0.7;
  d.y += (Math.random() - 0.5) * 0.7;
  d.z += (Math.random() - 0.5) * 0.7;
  d.normalize();
  const length = len * (0.65 + Math.random() * 0.6);
  const end = origin.clone().add(d.clone().multiplyScalar(length));
  segs.push({ start: origin.clone(), end, radius: baseRadius * (0.55 + 0.45 * Math.random()) });
  if (depth > 1 && segs.length < branchSlots) {
    const children = Math.random() < 0.45 ? 1 : 2;
    for (let c = 0; c < children && segs.length < branchSlots; c++) {
      genBranches(end, d, depth - 1, len * 0.62, baseRadius * 0.7, segs, branchSlots);
    }
  }
}

interface Lobe { base: THREE.Vector3; radius: number; phase: THREE.Vector2; }
interface Branch { start: THREE.Vector3; end: THREE.Vector3; radius: number; phase: THREE.Vector2; }
interface Compound { lobes: Lobe[]; branches: Branch[]; }

function buildGeometryData(lobesPer: number, branchSlots: number, branchDepth: number): Compound[] {
  const compounds: Compound[] = [];
  for (let c = 0; c < 4; c++) {
    const clumpA = rndDir().multiplyScalar(0.5);
    const clumpB = rndDir().multiplyScalar(0.95);
    const splitAt = Math.max(1, Math.round(lobesPer * (0.35 + Math.random() * 0.3)));
    const lobes: Lobe[] = [];
    for (let i = 0; i < lobesPer; i++) {
      const clump = i < splitAt ? clumpA : clumpB;
      const jitter = rndDir().multiplyScalar(0.5);
      lobes.push({
        base: clump.clone().add(jitter),
        radius: 0.5 + Math.random() * 0.8,
        phase: new THREE.Vector2(Math.random() * Math.PI * 2, 0.45 + Math.random() * 0.7),
      });
    }
    const segs: Seg[] = [];
    genBranches(new THREE.Vector3(0, 0, 0), rndDir().normalize(), branchDepth, 0.55, 0.085, segs, branchSlots);
    const branches: Branch[] = segs.map((s) => ({
      start: s.start, end: s.end, radius: s.radius,
      phase: new THREE.Vector2(Math.random() * Math.PI * 2, 0.25 + Math.random() * 0.45),
    }));
    compounds.push({ lobes, branches });
  }
  return compounds;
}

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const v3 = (v: THREE.Vector3) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`;
const v2 = (v: THREE.Vector2) => `vec2(${v.x.toFixed(5)}, ${v.y.toFixed(5)})`;
const f = (n: number) => n.toFixed(5);

function buildLobeBlock(lobe: Lobe) {
  return `
    {
      vec3 bo = ${v3(lobe.base)};
      bo.xz = sw*bo.xz;
      vec2 pf = ${v2(lobe.phase)};
      vec3 wob = vec3(
        sin(time*pf.y+pf.x),
        cos(time*pf.y*1.3+pf.x*1.7),
        sin(time*pf.y*0.8+pf.x*2.1)
      );
      vec3 c = center + bo*spread + wob*spread*0.34;
      float r = baseR*0.40*${f(lobe.radius)} + 0.012;
      float di = length(p-c) - r;
      float kJ = ${f(0.045 + 0.06 * lobe.radius)};
      d = smin(d, di, kJ);
    }`;
}

function buildBranchBlock(branch: Branch) {
  return `
    {
      vec2 pf = ${v2(branch.phase)};
      vec3 sway = vec3(
        sin(time*pf.y+pf.x),
        cos(time*pf.y*1.1+pf.x*1.4),
        sin(time*pf.y*0.9+pf.x*1.8)
      ) * baseR*0.05;
      vec3 bs = center + ${v3(branch.start)}*baseR + sway*0.3;
      vec3 be = center + ${v3(branch.end)}*baseR + sway;
      float rad = max(${f(branch.radius)}*baseR*max(level,0.2), 0.008);
      float dc = sdCapsule(p, bs, be, rad);
      d = smin(d, dc, 0.05);
    }`;
}

function buildCompoundFn(index: number, compound: Compound) {
  const lobeCode = compound.lobes.map(buildLobeBlock).join('\n');
  const branchCode = compound.branches.map(buildBranchBlock).join('\n');
  return `
  float compoundSDF${index}(vec3 p, vec3 center, float baseR, float level, float time){
    float spread = mix(baseR*0.5, baseR*1.05, level);
    float swirl = time*0.18 + ${f(index * 2.3)};
    mat2 sw = rot2(swirl);
    float d = 1e5;
    ${lobeCode}
    ${branchCode}
    return d;
  }`;
}

function buildFragShader(compounds: Compound[], aoSamples: number, steps: number) {
  const aoDenom = Math.max(aoSamples - 1, 1);
  const compoundFns = compounds.map((c, i) => buildCompoundFn(i, c)).join('\n');

  return `
  precision highp float;
  uniform vec2 uResolution;
  uniform vec2 uRot;
  uniform float uTime;
  uniform float uLevel0;
  uniform float uLevel1;
  uniform float uLevel2;
  uniform float uLevel3;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uCenter0;
  uniform vec3 uCenter1;
  uniform vec3 uCenter2;
  uniform vec3 uCenter3;
  varying vec2 vUv;

  mat2 rot2(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

  float smin(float a, float b, float k){
    float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
    return mix(b,a,h) - k*h*(1.0-h);
  }

  float hash(vec3 p){
    p = fract(p*vec3(443.8975,397.2973,491.1871));
    p += dot(p, p.yzx+19.19);
    return fract((p.x+p.y)*p.z);
  }
  float noise3(vec3 p){
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y),
      f.z
    );
  }
  float fbm(vec3 p){
    float v = 0.0;
    float a = 0.5;
    for(int i=0;i<2;i++){
      v += a*noise3(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  float sdSphere(vec3 p, vec3 c, float r){ return length(p-c) - r; }
  float sdCapsule(vec3 p, vec3 a, vec3 b, float r){
    vec3 pa = p-a, ba = b-a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h) - r;
  }

  ${compoundFns}

  float stipple(vec3 p){
    vec3 gp = p*22.0;
    vec3 ip = floor(gp);
    float h = hash(ip);
    vec3 fp = fract(gp) - 0.5;
    float dd = length(fp);
    float dotR = 0.1 + 0.08*hash(ip+vec3(5.0,0.0,0.0));
    float m = smoothstep(dotR, dotR-0.05, dd);
    float present = step(0.74, h);
    return m*present;
  }

  float r0(){ return 0.07 + 0.34*uLevel0; }
  float r1(){ return 0.07 + 0.34*uLevel1; }
  float r2(){ return 0.07 + 0.34*uLevel2; }
  float r3(){ return 0.07 + 0.34*uLevel3; }

  float mapScene(vec3 p){
    float d0 = compoundSDF0(p, uCenter0, r0(), uLevel0, uTime);
    float d1 = compoundSDF1(p, uCenter1, r1(), uLevel1, uTime);
    float d2 = compoundSDF2(p, uCenter2, r2(), uLevel2, uTime);
    float d3 = compoundSDF3(p, uCenter3, r3(), uLevel3, uTime);
    float d = smin(d0, d1, 0.2);
    d = smin(d, d2, 0.2);
    d = smin(d, d3, 0.2);
    float microFine = fbm(p*5.0 + vec3(0.0,0.0,uTime*0.09)) - 0.5;
    float microCoarse = fbm(p*1.8 + vec3(uTime*0.07,uTime*0.05,0.0)) - 0.5;
    d -= microFine*0.016;
    d -= microCoarse*0.06;
    d -= sin(p.x*9.0 + p.y*5.0 - uTime*1.6)*0.007;
    return d;
  }

  vec3 colorAt(vec3 p){
    float w0 = exp(-sdSphere(p, uCenter0, r0())*9.0);
    float w1 = exp(-sdSphere(p, uCenter1, r1())*9.0);
    float w2 = exp(-sdSphere(p, uCenter2, r2())*9.0);
    float w3 = exp(-sdSphere(p, uCenter3, r3())*9.0);
    float wsum = w0+w1+w2+w3;
    vec3 csum = w0*uColor0 + w1*uColor1 + w2*uColor2 + w3*uColor3;
    return csum/max(wsum, 0.0001);
  }

  vec3 calcNormal(vec3 p){
    float e = 0.0018;
    vec2 k = vec2(1.0,-1.0);
    return normalize(
      k.xyy*mapScene(p+k.xyy*e) +
      k.yyx*mapScene(p+k.yyx*e) +
      k.yxy*mapScene(p+k.yxy*e) +
      k.xxx*mapScene(p+k.xxx*e)
    );
  }

  float calcAO(vec3 p, vec3 n){
    float ao = 0.0;
    float sca = 1.0;
    for(int i=0;i<${aoSamples};i++){
      float h = 0.015 + 0.13*float(i)/${aoDenom}.0;
      float d = mapScene(p + n*h);
      ao += (h-d)*sca;
      sca *= 0.62;
    }
    return clamp(1.0 - 1.4*ao, 0.0, 1.0);
  }

  void main(){
    vec2 uv = vUv - 0.5;
    uv.x *= uResolution.x/uResolution.y;

    vec3 ro = vec3(0.0, 0.0, 3.1);
    vec3 rd = normalize(vec3(uv*0.62, -1.0));

    ro.yz = rot2(uRot.y)*ro.yz; rd.yz = rot2(uRot.y)*rd.yz;
    ro.xz = rot2(uRot.x)*ro.xz; rd.xz = rot2(uRot.x)*rd.xz;

    float t = 0.0;
    bool hit = false;
    vec3 p = ro;
    for(int i=0;i<${steps};i++){
      p = ro + rd*t;
      float d = mapScene(p);
      if(d < 0.0018){ hit = true; break; }
      t += d*0.72;
      if(t > 8.0) break;
    }

    vec3 col;
    if(hit){
      vec3 n = calcNormal(p);
      vec3 base = colorAt(p);
      float ao = calcAO(p, n);

      vec3 keyDir = normalize(vec3(0.45, 0.75, 0.4));
      vec3 fillDir = normalize(vec3(-0.55, -0.15, 0.6));
      vec3 viewDir = -rd;

      float wrapKey = max(dot(n, keyDir)*0.5 + 0.5, 0.0);
      float lambKey = max(dot(n, keyDir), 0.0);
      float diffKey = mix(lambKey, wrapKey, 0.6);
      float diffFill = max(dot(n, fillDir)*0.5 + 0.5, 0.0);

      vec3 halfV = normalize(keyDir + viewDir);
      float spec = pow(max(dot(n, halfV), 0.0), 16.0);
      float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);

      vec3 lit = base*(0.40 + 0.42*diffKey) + base*0.16*diffFill*vec3(0.85,0.95,1.0);
      lit *= mix(0.68, 1.0, ao);

      vec3 rimColor = mix(base, vec3(1.0), 0.4);
      vec3 sss = rimColor * fres * 0.55;

      col = lit + sss + vec3(1.0)*spec*0.08*ao;

      vec3 dotColor = mix(base, vec3(1.0), 0.5);
      col = mix(col, dotColor, stipple(p)*0.5);

      float patch = fbm(p*3.0 + vec3(7.0,3.0,1.5));
      col *= mix(0.7, 1.15, patch);
      col += base * smoothstep(0.6, 0.92, patch) * 0.6;
    } else {
      col = vec3(0.026, 0.026, 0.03);
    }

    float grain = hash(vec3(gl_FragCoord.xy, mod(uTime*53.0, 4000.0))) - 0.5;
    col += grain * 0.03;

    gl_FragColor = vec4(col, 1.0);
  }
  `;
}

export default function SerumLiquidRender({ levels = [78, 52, 40, 30] }: { levels?: number[] }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const tierName = detectTier();
    const tier = TIERS[tierName];
    const compounds = buildGeometryData(tier.lobesPer, tier.branchSlots, tier.branchDepth);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: tierName === 'high', alpha: false, powerPreference: 'low-power' });
    } catch {
      setRenderError(true);
      return;
    }
    if (!renderer.getContext()) {
      setRenderError(true);
      return;
    }
    renderer.setClearColor(0x070708, 1);

    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 200;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelCap));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setRenderError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock = new THREE.Clock();

    const uniforms = {
      uResolution: { value: new THREE.Vector2(width, height) },
      uRot: { value: new THREE.Vector2(0.3, 0.15) },
      uTime: { value: 0 },
      uLevel0: { value: levels[0] / 100 },
      uLevel1: { value: levels[1] / 100 },
      uLevel2: { value: levels[2] / 100 },
      uLevel3: { value: levels[3] / 100 },
      uColor0: { value: COLORS[0] }, uColor1: { value: COLORS[1] },
      uColor2: { value: COLORS[2] }, uColor3: { value: COLORS[3] },
      uCenter0: { value: CENTERS[0] }, uCenter1: { value: CENTERS[1] },
      uCenter2: { value: CENTERS[2] }, uCenter3: { value: CENTERS[3] },
    };

    let material: THREE.ShaderMaterial, geometry: THREE.PlaneGeometry, mesh: THREE.Mesh;
    try {
      const frag = buildFragShader(compounds, tier.aoSamples, tier.steps);
      material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag });
      geometry = new THREE.PlaneGeometry(2, 2);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      renderer.compile(scene, camera);
    } catch {
      setRenderError(true);
      try { mount.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
      return;
    }

    let raf = 0;
    let rot = 0.3;
    let failed = false;
    const animate = () => {
      rot += 0.0018;
      uniforms.uRot.value.set(rot, 0.15);
      uniforms.uTime.value = clock.getElapsedTime();
      const l = levelsRef.current;
      uniforms.uLevel0.value = (l[0] ?? 0) / 100;
      uniforms.uLevel1.value = (l[1] ?? 0) / 100;
      uniforms.uLevel2.value = (l[2] ?? 0) / 100;
      uniforms.uLevel3.value = (l[3] ?? 0) / 100;
      try {
        renderer.render(scene, camera);
      } catch {
        // a shader that compiled on one GPU can still fail to run on another —
        // bail to the animated fallback instead of freezing on a black box.
        failed = true;
        cancelAnimationFrame(raf);
        setRenderError(true);
        return;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    // If the very first frame produced GL errors, fall back.
    const gl = renderer.getContext();
    if (gl && gl.getError() !== gl.NO_ERROR && !failed) { setRenderError(true); cancelAnimationFrame(raf); }

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      try { mount.removeChild(renderer.domElement); } catch {}
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (renderError) {
    // Always-on CSS fallback: a living "liquid" field whose glow tracks the
    // current serum level. No WebGL required, so it works on every machine.
    const lvl = Math.max(0, Math.min(100, levels[0] ?? 0)) / 100;
    return (
      <div className="serum-fallback" aria-hidden style={{ ['--lvl' as string]: lvl }}>
        <div className="serum-fallback-blob" />
        <div className="serum-fallback-blob b2" />
      </div>
    );
  }

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
