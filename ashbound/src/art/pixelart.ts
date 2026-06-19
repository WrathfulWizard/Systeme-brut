import Phaser from "phaser";

// Tiny pixel-art baker. Sprites are authored as arrays of strings where each
// character maps to a palette colour ('.' / ' ' = transparent). We rasterise
// them to CanvasTextures at native resolution; the camera zoom handles upscale,
// so the result stays crisp under `pixelArt: true`.

export type Palette = Record<string, number>;

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

/** Bake a single grid into a texture under `key`. Returns [width, height]. */
export function bakeFrame(
  scene: Phaser.Scene,
  key: string,
  grid: string[],
  palette: Palette,
): [number, number] {
  const h = grid.length;
  const w = grid.reduce((m, row) => Math.max(m, row.length), 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`failed to create canvas texture: ${key}`);
  const ctx = tex.context;
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const col = palette[ch];
      if (col === undefined) continue;
      ctx.fillStyle = hex(col);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
  return [w, h];
}

/** Bake a texture by drawing straight onto its 2D context (tiles, props, fx). */
export function bakeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`failed to create canvas texture: ${key}`);
  const ctx = tex.context;
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

/** Bake every frame of a named clip: `${key}_0`, `${key}_1`, ... */
export function bakeFrames(
  scene: Phaser.Scene,
  key: string,
  frames: string[][],
  palette: Palette,
): void {
  frames.forEach((grid, i) => bakeFrame(scene, `${key}_${i}`, grid, palette));
}

// Mix two 0xRRGGBB colours, returning a packed int.
function mixInt(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * Bake a grid with a 1px dark silhouette outline and a cool top rim-light —
 * the cheap, uniform "this was drawn on purpose" upgrade for every character.
 * Size is unchanged (the grids carry a transparent margin), so entity body
 * offsets stay valid.
 */
export function bakeFrameStyled(
  scene: Phaser.Scene,
  key: string,
  grid: string[],
  palette: Palette,
  outline = 0x080610,
  rim = 0x6a5d7e,
): void {
  const h = grid.length;
  const w = grid.reduce((m, row) => Math.max(m, row.length), 0);
  // colour grid: null = transparent
  const src: (number | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row: (number | null)[] = [];
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      row.push(ch === undefined || ch === "." || ch === " " ? null : palette[ch] ?? null);
    }
    src.push(row);
  }
  const out: (number | null)[][] = src.map((r) => r.slice());
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y][x] !== null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y][x] === null) {
        // outline empty cells touching the silhouette
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          out[y][x] = outline;
        }
      } else if (!solid(x, y - 1)) {
        // top edge -> rim light
        out[y][x] = mixInt(src[y][x]!, rim, 0.4);
      }
    }
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`failed to create canvas texture: ${key}`);
  const ctx = tex.context;
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = out[y][x];
      if (c === null) continue;
      ctx.fillStyle = "#" + (c >>> 0).toString(16).padStart(6, "0").slice(-6);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
}

export function bakeFramesStyled(
  scene: Phaser.Scene,
  key: string,
  frames: string[][],
  palette: Palette,
  outline?: number,
  rim?: number,
): void {
  frames.forEach((grid, i) => bakeFrameStyled(scene, `${key}_${i}`, grid, palette, outline, rim));
}

/** Register a looping/one-shot animation from baked frame keys. */
export function makeAnim(
  scene: Phaser.Scene,
  animKey: string,
  frameKey: string,
  count: number,
  frameRate: number,
  repeat = -1,
): void {
  if (scene.anims.exists(animKey)) return;
  const frames = [];
  for (let i = 0; i < count; i++) frames.push({ key: `${frameKey}_${i}` });
  scene.anims.create({ key: animKey, frames, frameRate, repeat });
}
