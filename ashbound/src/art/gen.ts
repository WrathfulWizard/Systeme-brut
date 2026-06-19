import Phaser from "phaser";
import type { Biome } from "../world/biomes";
import { bakeCanvas } from "./pixelart";
import { mulberry32, mix, shade, hexOf, type RNG } from "./util";

export const T = 16;

export interface TileIndex {
  texture: string;
  tileSize: number;
  abyss: number;
  biome: Record<string, { ground: number[]; water: number; cliff: number }>;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Tileset ──────────────────────────────────────────────────────────────────
export function generateTiles(scene: Phaser.Scene, biomes: Biome[]): TileIndex {
  type Task = (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  const tasks: Task[] = [];
  const push = (t: Task): number => tasks.push(t) - 1;

  const abyss = push((ctx, x, y) => {
    ctx.fillStyle = "#050409";
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#0a0810";
    ctx.fillRect(x, y, T, 2);
  });

  const index: TileIndex["biome"] = {};
  for (const b of biomes) {
    const ground: number[] = [];
    for (let v = 0; v < 4; v++) {
      const seed = hashStr(b.id + ":g" + v);
      ground.push(push((ctx, x, y) => drawGround(ctx, x, y, b, mulberry32(seed))));
    }
    const water = push((ctx, x, y) => drawWater(ctx, x, y, b, mulberry32(hashStr(b.id + ":w"))));
    const cliff = push((ctx, x, y) => drawCliff(ctx, x, y, b, mulberry32(hashStr(b.id + ":c"))));
    index[b.id] = { ground, water, cliff };
  }

  const cols = 8;
  const rows = Math.ceil(tasks.length / cols);
  const key = "tileset";
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, cols * T, rows * T);
  if (!tex) throw new Error("tileset canvas failed");
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  tasks.forEach((t, i) => t(ctx, (i % cols) * T, Math.floor(i / cols) * T));
  tex.refresh();

  return { texture: key, tileSize: T, abyss, biome: index };
}

function drawGround(ctx: CanvasRenderingContext2D, x0: number, y0: number, b: Biome, r: RNG): void {
  const base = b.ground[Math.floor(r() * b.ground.length)];
  ctx.fillStyle = hexOf(base);
  ctx.fillRect(x0, y0, T, T);

  // grain
  for (let i = 0; i < 40; i++) {
    const x = x0 + Math.floor(r() * T);
    const y = y0 + Math.floor(r() * T);
    ctx.fillStyle = r() > 0.5 ? hexOf(b.speckDark) : hexOf(b.speckLight);
    ctx.fillRect(x, y, 1, 1);
  }

  switch (b.detail) {
    case "ash":
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = mix(base, b.accent, 0.25);
        ctx.fillRect(x0 + Math.floor(r() * T), y0 + Math.floor(r() * T), 1, 1);
      }
      break;
    case "grass":
      for (let i = 0; i < 6; i++) {
        const gx = x0 + Math.floor(r() * T);
        const gy = y0 + 4 + Math.floor(r() * (T - 6));
        ctx.fillStyle = mix(base, b.accent, 0.35);
        ctx.fillRect(gx, gy, 1, 2);
        ctx.fillStyle = shade(base, -0.3);
        ctx.fillRect(gx, gy + 2, 1, 1);
      }
      break;
    case "ember":
      ctx.strokeStyle = mix(base, b.accent, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 + r() * T, y0 + r() * T);
      ctx.lineTo(x0 + r() * T, y0 + r() * T);
      ctx.stroke();
      ctx.fillStyle = hexOf(b.accent);
      ctx.fillRect(x0 + Math.floor(r() * T), y0 + Math.floor(r() * T), 1, 1);
      break;
    case "mire":
      ctx.fillStyle = shade(base, -0.35);
      ctx.fillRect(x0, y0 + Math.floor(r() * T), T, 1);
      ctx.fillStyle = mix(base, b.water, 0.5);
      ctx.fillRect(x0 + Math.floor(r() * T), y0 + Math.floor(r() * T), 2, 1);
      break;
    case "stone":
      // flagstone seams
      ctx.fillStyle = shade(base, -0.4);
      ctx.fillRect(x0, y0 + 7, T, 1);
      ctx.fillRect(x0 + 7, y0, 1, T);
      ctx.fillStyle = shade(base, 0.12);
      ctx.fillRect(x0 + 1, y0 + 1, 5, 1);
      ctx.fillRect(x0 + 9, y0 + 9, 5, 1);
      break;
  }
  // bottom/right edge shading for subtle relief
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x0, y0 + T - 1, T, 1);
  ctx.fillRect(x0 + T - 1, y0, 1, T);
}

function drawWater(ctx: CanvasRenderingContext2D, x0: number, y0: number, b: Biome, r: RNG): void {
  ctx.fillStyle = hexOf(b.water);
  ctx.fillRect(x0, y0, T, T);
  // depth: darker toward the top
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x0, y0, T, 3);
  if (b.lava) {
    for (let i = 0; i < 5; i++) {
      const y = y0 + 2 + Math.floor(r() * (T - 3));
      ctx.fillStyle = i % 2 ? hexOf(b.accent) : mix(b.water, b.accent, 0.6);
      ctx.fillRect(x0 + Math.floor(r() * (T - 4)), y, 2 + Math.floor(r() * 3), 1);
    }
    ctx.fillStyle = mix(b.accent, 0xffffff, 0.4);
    ctx.fillRect(x0 + Math.floor(r() * T), y0 + Math.floor(r() * T), 1, 1);
  } else {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = shade(b.water, 0.18);
      ctx.fillRect(x0 + 1 + Math.floor(r() * 6), y0 + 4 + i * 4, 3 + Math.floor(r() * 4), 1);
    }
  }
}

function drawCliff(ctx: CanvasRenderingContext2D, x0: number, y0: number, b: Biome, r: RNG): void {
  ctx.fillStyle = hexOf(b.cliff);
  ctx.fillRect(x0, y0, T, T);
  ctx.fillStyle = shade(b.cliff, 0.22);
  ctx.fillRect(x0, y0, T, 2); // lit top
  ctx.fillStyle = shade(b.cliff, -0.4);
  ctx.fillRect(x0, y0 + T - 3, T, 3); // shadowed base
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = shade(b.cliff, r() > 0.5 ? 0.15 : -0.3);
    ctx.fillRect(x0 + Math.floor(r() * T), y0 + 2 + Math.floor(r() * (T - 5)), 1, 1 + Math.floor(r() * 2));
  }
}

// ── Props ────────────────────────────────────────────────────────────────────
// Foliage props are drawn in a neutral green so the world can tint them to each
// biome's accent at placement time; structural props keep their stone tones.
export function generateProps(scene: Phaser.Scene): void {
  const px = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Deciduous / pale tree (foliage tinted later).
  bakeCanvas(scene, "p_pine", 18, 26, (ctx) => {
    const r = mulberry32(11);
    // trunk
    px(ctx, 8, 18, "#2a2018", 2, 8);
    px(ctx, 7, 22, "#1c150f", 4, 4);
    // tiered canopy
    const green = 0x4f7d52;
    for (let tier = 0; tier < 3; tier++) {
      const cy = 4 + tier * 5;
      const half = 8 - tier * 1.5;
      for (let y = 0; y < 7; y++) {
        const wdt = Math.max(0, (half * (7 - y)) / 7) | 0;
        for (let x = -wdt; x <= wdt; x++) {
          const shadeAmt = x / 8 + (r() - 0.5) * 0.3;
          px(ctx, 9 + x, cy + y, mix(green, shadeAmt < -0.1 ? 0x9ad0a0 : 0x1e3a24, Math.abs(shadeAmt)));
        }
      }
    }
    px(ctx, 9, 2, "#0a0c0a"); // crown
  });

  bakeCanvas(scene, "p_deadtree", 18, 26, (ctx) => {
    const dark = "#241a12";
    const lite = "#3a2a1c";
    px(ctx, 8, 14, dark, 2, 12);
    // branches
    const branch = (x: number, y: number, dx: number, n: number) => {
      for (let i = 0; i < n; i++) {
        px(ctx, x + dx * i, y - i, i % 2 ? lite : dark);
      }
    };
    branch(8, 14, -1, 6);
    branch(9, 13, 1, 6);
    branch(8, 10, -1, 4);
    branch(9, 9, 1, 5);
    px(ctx, 7, 24, "#1a130d", 4, 2);
  });

  bakeCanvas(scene, "p_pillar", 14, 24, (ctx) => {
    const r = mulberry32(7);
    for (let y = 0; y < 24; y++) {
      const w = y > 18 ? 12 : 8;
      const x = 7 - w / 2;
      px(ctx, x, y, y % 6 === 0 ? "#4a4654" : "#37343f", w, 1);
      if (r() > 0.7) px(ctx, x + 1 + Math.floor(r() * (w - 2)), y, "#26242c");
    }
    px(ctx, 1, 22, "#2a2832", 12, 2);
    px(ctx, 2, 0, "#4a4654", 8, 1); // broken top
  });

  bakeCanvas(scene, "p_obelisk", 14, 26, (ctx) => {
    for (let y = 0; y < 26; y++) {
      const w = 6 + (y > 22 ? 4 : 0);
      px(ctx, 7 - w / 2, y, y < 4 ? "#5a3020" : "#2c2422", w, 1);
    }
    px(ctx, 5, 8, "#d8702a", 4, 1);
    px(ctx, 6, 12, "#d8702a", 2, 6);
  });

  bakeCanvas(scene, "p_wall", 26, 18, (ctx) => {
    const r = mulberry32(3);
    for (let y = 4; y < 18; y++) {
      for (let x = 0; x < 26; x++) {
        if (y > 16 - Math.floor(r() * 4) && x > 18) continue; // crumbled corner
        const brick = ((x >> 2) + (y >> 2)) % 2;
        px(ctx, x, y, brick ? "#34313c" : "#2a2730");
        if ((x & 3) === 0 || (y & 3) === 0) px(ctx, x, y, "#1c1a22");
      }
    }
    px(ctx, 0, 4, "#46434e", 18, 1);
  });

  bakeCanvas(scene, "p_grave", 12, 14, (ctx) => {
    px(ctx, 3, 1, "#3a3742", 6, 11);
    px(ctx, 3, 1, "#4a4654", 6, 1);
    px(ctx, 4, 4, "#23212a", 4, 1);
    px(ctx, 4, 6, "#23212a", 4, 1);
    px(ctx, 2, 12, "#1a1820", 8, 2);
  });

  bakeCanvas(scene, "p_rock", 12, 8, (ctx) => {
    px(ctx, 2, 3, "#3a3742", 8, 4);
    px(ctx, 3, 2, "#46434e", 5, 1);
    px(ctx, 2, 6, "#23212a", 8, 1);
  });

  bakeCanvas(scene, "p_boulder", 18, 14, (ctx) => {
    const r = mulberry32(5);
    for (let y = 2; y < 13; y++) {
      const w = 14 - Math.abs(7 - y);
      const x = 9 - w / 2;
      px(ctx, x, y, y < 5 ? "#46434e" : "#34313c", w, 1);
      if (r() > 0.8) px(ctx, x + Math.floor(r() * w), y, "#23212a");
    }
    px(ctx, 2, 12, "#1a1820", 14, 2);
  });

  bakeCanvas(scene, "p_stump", 14, 10, (ctx) => {
    px(ctx, 3, 3, "#3a2a1c", 8, 6);
    px(ctx, 4, 3, "#5a4630", 6, 2);
    px(ctx, 5, 4, "#2a2018", 4, 1);
    px(ctx, 3, 8, "#1a130d", 8, 2);
  });

  bakeCanvas(scene, "p_bones", 14, 8, (ctx) => {
    px(ctx, 2, 4, "#b9b09a", 9, 1);
    px(ctx, 3, 6, "#9a917a", 7, 1);
    px(ctx, 5, 2, "#cfc6ad", 1, 4);
    px(ctx, 8, 2, "#cfc6ad", 1, 4);
  });

  bakeCanvas(scene, "p_reeds", 12, 16, (ctx) => {
    const r = mulberry32(9);
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(r() * 10);
      const h = 8 + Math.floor(r() * 7);
      for (let y = 0; y < h; y++) px(ctx, x, 16 - y, mix(0x3f6d4a, 0x101c14, y / h));
    }
  });

  bakeCanvas(scene, "p_mushroom", 12, 12, (ctx) => {
    px(ctx, 5, 6, "#c9c0aa", 2, 5); // stalk
    for (let y = 2; y < 7; y++) {
      const w = (7 - y) * 2 + 2;
      px(ctx, 6 - w / 2, y, mix(0x3fa8c0, 0x0e2a30, (y - 2) / 5), w, 1);
    }
    px(ctx, 4, 3, "#bfeefb"); // glint
    px(ctx, 7, 4, "#bfeefb");
  });

  bakeCanvas(scene, "p_embervent", 14, 12, (ctx) => {
    px(ctx, 2, 8, "#1a1110", 10, 4); // scorched base
    for (let i = 0; i < 6; i++) {
      const r = mulberry32(13 + i)();
      px(ctx, 4 + Math.floor(r * 6), 4 + Math.floor(r * 6), i % 2 ? "#f2c14e" : "#d8702a");
    }
    px(ctx, 6, 2, "#f7e08a", 2, 2); // core
  });

  bakeCanvas(scene, "p_banner", 12, 22, (ctx) => {
    px(ctx, 5, 0, "#2a2730", 1, 22); // pole
    for (let y = 2; y < 18; y++) {
      const wob = Math.sin(y * 0.6) * 1.2;
      px(ctx, 6 + Math.round(wob), y, "#7a1f2b", 5, 1);
      px(ctx, 6 + Math.round(wob), y, "#b04030", 1, 1);
    }
    px(ctx, 6, 18, "#5a151f", 5, 1);
  });

  // Soft additive light for glowing props / embers.
  bakeCanvas(scene, "fx_light", 40, 40, (ctx) => {
    const g = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
  });

  // Fog puff for drifting ambience.
  bakeCanvas(scene, "fx_fog", 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(180,180,200,0.5)");
    g.addColorStop(1, "rgba(180,180,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  // Fog gate (boss arena seal).
  bakeCanvas(scene, "fx_foggate", 64, 80, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 80);
    g.addColorStop(0, "rgba(210,200,225,0.0)");
    g.addColorStop(0.5, "rgba(190,180,215,0.55)");
    g.addColorStop(1, "rgba(150,140,180,0.15)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 80);
    for (let i = 0; i < 60; i++) {
      const r = mulberry32(40 + i)();
      ctx.fillStyle = `rgba(230,225,240,${0.1 + r * 0.2})`;
      ctx.fillRect(Math.floor(r * 64), Math.floor(mulberry32(80 + i)() * 80), 2, 2);
    }
  });
}

// ── Boss: The Cinder Lord ───────────────────────────────────────────────────
// A 32x46 armoured colossus with a greatsword. Four poses: idle, step, raise,
// slam. Drawn procedurally for a heavier, less-blocky silhouette than a grid.
export function generateBoss(scene: Phaser.Scene): void {
  const W = 32;
  const H = 46;
  const dark = 0x26242e;
  const mid = 0x403d4a;
  const lite = 0x5a5666;
  const ember = 0xd8702a;
  const emberHot = 0xf2c14e;
  const cloak = 0x3a1820;
  const steel = 0x8f96a3;
  const steelHi = 0xc6ccd6;

  const frame = (key: string, pose: 0 | 1 | 2 | 3): void => {
    bakeCanvas(scene, key, W, H, (ctx) => {
      const px = (x: number, y: number, c: string, w = 1, h = 1) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
      };
      const bob = pose === 1 ? 1 : 0;
      const cx = 16;

      // tattered cloak behind
      for (let y = 16; y < 44; y++) {
        const spread = 4 + (y - 16) * 0.4;
        px(cx - spread, y + bob, hexOf(cloak), spread * 2, 1);
        if ((y & 1) === 0) px(cx - spread, y + bob, hexOf(0x24101a), 1);
      }
      // legs
      const legSplit = pose === 1 ? 1 : 0;
      px(cx - 6 - legSplit, 34 + bob, hexOf(dark), 5, 11);
      px(cx + 1 + legSplit, 34 + bob, hexOf(dark), 5, 11);
      px(cx - 6 - legSplit, 34 + bob, hexOf(mid), 5, 1);
      px(cx + 1 + legSplit, 34 + bob, hexOf(mid), 5, 1);
      px(cx - 7 - legSplit, 44, hexOf(0x14121a), 6, 2);
      px(cx + 1 + legSplit, 44, hexOf(0x14121a), 6, 2);

      // torso plate (trapezoid)
      for (let y = 16; y < 35; y++) {
        const w = 8 + (y - 16) * 0.5;
        px(cx - w / 2, y + bob, hexOf(mid), w, 1);
      }
      px(cx - 5, 17 + bob, hexOf(lite), 10, 1); // collar light
      // ember core
      px(cx - 2, 23 + bob, hexOf(ember), 4, 6);
      px(cx - 1, 24 + bob, hexOf(emberHot), 2, 4);
      // pauldron spikes
      for (let i = 0; i < 3; i++) {
        px(cx - 11 + i, 17 - i + bob, hexOf(dark), 4, 4 + i);
        px(cx + 8 - i, 17 - i + bob, hexOf(dark), 4, 4 + i);
      }
      px(cx - 11, 16 + bob, hexOf(lite), 1, 2);
      px(cx + 10, 16 + bob, hexOf(lite), 1, 2);

      // helm + horns
      px(cx - 5, 6 + bob, hexOf(dark), 10, 11);
      px(cx - 4, 7 + bob, hexOf(mid), 8, 3);
      // horns
      px(cx - 7, 2 + bob, hexOf(0x1a1820), 2, 6);
      px(cx + 5, 2 + bob, hexOf(0x1a1820), 2, 6);
      px(cx - 8, 1 + bob, hexOf(0x1a1820), 2, 3);
      px(cx + 6, 1 + bob, hexOf(0x1a1820), 2, 3);
      // visor glow
      px(cx - 3, 11 + bob, hexOf(ember), 6, 2);
      px(cx - 3, 11 + bob, hexOf(emberHot), 2, 1);
      px(cx + 2, 11 + bob, hexOf(emberHot), 1, 1);

      // greatsword — position depends on pose
      const blade = (bx: number, by: number, len: number, vertical: boolean) => {
        if (vertical) {
          px(bx, by - len, hexOf(steel), 3, len);
          px(bx + 1, by - len, hexOf(steelHi), 1, len);
          px(bx - 1, by + 1, hexOf(0x5a3a24), 5, 2); // guard
          px(bx, by + 3, hexOf(0x3a2418), 3, 4); // grip
        } else {
          px(bx, by, hexOf(steel), len, 3);
          px(bx, by + 1, hexOf(steelHi), len, 1);
          px(bx - 2, by - 1, hexOf(0x5a3a24), 2, 5);
        }
      };
      if (pose === 2) {
        // raised overhead
        blade(cx + 8, 14 + bob, 18, true);
        px(cx + 7, 16 + bob, hexOf(mid), 5, 4); // gauntlet
      } else if (pose === 3) {
        // slammed forward/down
        blade(cx + 2, 40, 20, false);
        px(cx + 6, 30, hexOf(mid), 4, 5);
      } else {
        // resting at right side
        blade(cx + 11, 22 + bob, 16, true);
        px(cx + 9, 24 + bob, hexOf(mid), 5, 4);
      }
    });
  };

  frame("boss_0", 0);
  frame("boss_1", 1);
  frame("boss_2", 2);
  frame("boss_3", 3);
}
