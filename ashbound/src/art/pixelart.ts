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
