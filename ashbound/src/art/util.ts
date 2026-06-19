// Deterministic RNG + colour math used across the procedural art generators.
// Same seed -> same world, so the game looks identical every run.

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap value-noise in [0,1] for organic borders / terrain fields. */
export function valueNoise(seed: number) {
  const r = mulberry32(seed);
  const grid: number[] = [];
  const N = 256;
  for (let i = 0; i < N * N; i++) grid[i] = r();
  const at = (x: number, y: number) =>
    grid[((y & (N - 1)) * N + (x & (N - 1))) | 0];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const tl = at(xi, yi);
    const tr = at(xi + 1, yi);
    const bl = at(xi, yi + 1);
    const br = at(xi + 1, yi + 1);
    const u = smooth(xf);
    const v = smooth(yf);
    const top = tl + (tr - tl) * u;
    const bot = bl + (br - bl) * u;
    return top + (bot - top) * v;
  };
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgb(n: number): RGB {
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function toHex(c: RGB): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function mix(a: number, b: number, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

/** Shade a colour toward black (amt<0) or white (amt>0). */
export function shade(n: number, amt: number): string {
  const c = rgb(n);
  const t = Math.abs(amt);
  const tgt = amt < 0 ? 0 : 255;
  return toHex({
    r: c.r + (tgt - c.r) * t,
    g: c.g + (tgt - c.g) * t,
    b: c.b + (tgt - c.b) * t,
  });
}

export function hexOf(n: number): string {
  return "#" + (n >>> 0).toString(16).padStart(6, "0").slice(-6);
}
