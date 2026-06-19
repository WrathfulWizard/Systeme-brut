// Procedural audio — every sound is synthesised at runtime via Web Audio, so
// there are no audio asset files, matching the all-in-code art pipeline. All
// calls are guarded: if the AudioContext can't be created (e.g. headless), the
// whole module silently no-ops and never breaks the game.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

// ambient bed
let ambGain: GainNode | null = null;
let ambLP: BiquadFilterNode | null = null;
let ambVoices: { osc: OscillatorNode; g: GainNode }[] = [];
let bossOn = false;

export function initAudio(): void {
  if (ctx) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuf = makeNoise();
    startAmbient();
    window.addEventListener("pointerdown", resumeAudio, { once: false });
    window.addEventListener("keydown", resumeAudio, { once: false });
  } catch {
    ctx = null;
  }
}

export function resumeAudio(): void {
  try {
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}

function makeNoise(): AudioBuffer {
  const len = ctx!.sampleRate;
  const b = ctx!.createBuffer(1, len, len);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function t(): number {
  return ctx!.currentTime;
}

function env(g: GainNode, peak: number, dur: number, attack = 0.005): void {
  const n = t();
  g.gain.setValueAtTime(0.0001, n);
  g.gain.linearRampToValueAtTime(peak, n + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, slideTo?: number): void {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t());
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t() + dur);
  const g = ctx.createGain();
  env(g, peak, dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(t() + dur + 0.02);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

function noise(dur: number, peak: number, type: BiquadFilterType, freq: number, q = 1, sweepTo?: number): void {
  if (!ctx || !master || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t());
  f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t() + dur);
  const g = ctx.createGain();
  env(g, peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start();
  src.stop(t() + dur + 0.02);
  src.onended = () => {
    src.disconnect();
    f.disconnect();
    g.disconnect();
  };
}

function startAmbient(): void {
  if (!ctx || !master) return;
  ambGain = ctx.createGain();
  ambGain.gain.value = 0.05;
  ambLP = ctx.createBiquadFilter();
  ambLP.type = "lowpass";
  ambLP.frequency.value = 320;
  ambLP.connect(ambGain).connect(master);
  // detuned low drones + a dormant tritone voice for boss tension
  [
    { f: 55, v: 0.5 },
    { f: 55.5, v: 0.5 },
    { f: 78, v: 0.0 },
  ].forEach((spec) => {
    const osc = ctx!.createOscillator();
    osc.type = "sine";
    osc.frequency.value = spec.f;
    const g = ctx!.createGain();
    g.gain.value = spec.v;
    osc.connect(g).connect(ambLP!);
    osc.start();
    ambVoices.push({ osc, g });
  });
}

export const sfx = {
  swing(): void {
    noise(0.16, 0.22, "bandpass", 1300, 6, 380);
  },
  hit(): void {
    tone(90, 0.12, "sine", 0.5, 60);
    noise(0.07, 0.35, "highpass", 2200, 1);
  },
  hurt(): void {
    tone(240, 0.2, "square", 0.18, 110);
    noise(0.12, 0.2, "lowpass", 900, 1);
  },
  dodge(): void {
    noise(0.22, 0.16, "bandpass", 760, 5, 240);
  },
  estus(): void {
    tone(330, 0.32, "sine", 0.18, 620);
    tone(660, 0.3, "triangle", 0.08, 990);
  },
  enemyDie(): void {
    tone(70, 0.28, "sine", 0.4, 45);
    noise(0.3, 0.28, "lowpass", 1400, 1, 220);
  },
  rune(): void {
    tone(880, 0.1, "triangle", 0.16, 1320);
  },
  bossSlam(): void {
    tone(48, 0.5, "sine", 0.7, 30);
    noise(0.4, 0.45, "lowpass", 420, 1, 120);
  },
  rest(): void {
    [261.6, 329.6, 392.0].forEach((f, i) => setTimeout(() => tone(f, 0.6, "sine", 0.14), i * 70));
  },
  uiMove(): void {
    tone(440, 0.05, "square", 0.12);
  },
  uiSelect(): void {
    tone(680, 0.08, "square", 0.16, 760);
  },
  playerDie(): void {
    tone(120, 1.3, "sine", 0.3, 70);
    tone(180, 1.2, "sine", 0.16, 110);
  },
  bossDie(): void {
    [110, 130, 165].forEach((f) => tone(f, 1.6, "sine", 0.2, f * 0.6));
    noise(1.2, 0.3, "lowpass", 600, 1, 80);
  },
  setBoss(on: boolean): void {
    if (on === bossOn || !ctx || !ambGain || !ambLP) return;
    bossOn = on;
    const n = t();
    ambGain.gain.linearRampToValueAtTime(on ? 0.09 : 0.05, n + 1.2);
    ambLP.frequency.linearRampToValueAtTime(on ? 600 : 320, n + 1.2);
    if (ambVoices[2]) ambVoices[2].g.gain.linearRampToValueAtTime(on ? 0.4 : 0.0, n + 1.2);
  },
};
