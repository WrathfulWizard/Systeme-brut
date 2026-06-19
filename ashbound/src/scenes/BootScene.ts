import Phaser from "phaser";
import { TILE } from "../config";
import { bakeFrame, bakeFrames, makeAnim } from "../art/pixelart";
import {
  PAL,
  PLAYER_FRAMES,
  HOLLOW_FRAMES,
  SLASH,
  PILLAR,
  TOMBSTONE,
  DEADTREE,
  EMBER_A,
  EMBER_B,
} from "../art/sprites";

// Builds every texture procedurally, then hands off to the world. No external
// asset files — the art lives in code so the prototype runs anywhere.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    // Characters.
    bakeFrames(this, "player_front", PLAYER_FRAMES.front, PAL);
    bakeFrames(this, "player_back", PLAYER_FRAMES.back, PAL);
    bakeFrames(this, "player_side", PLAYER_FRAMES.side, PAL);
    bakeFrames(this, "hollow_front", HOLLOW_FRAMES.front, PAL);
    bakeFrames(this, "hollow_side", HOLLOW_FRAMES.side, PAL);

    // Walk cycles use frames 1 & 2; idle is frame 0 (set directly on sprites).
    makeAnim(this, "player-front-walk", "player_front", 3, 7);
    makeAnim(this, "player-back-walk", "player_back", 3, 7);
    makeAnim(this, "player-side-walk", "player_side", 3, 7);
    makeAnim(this, "hollow-front-walk", "hollow_front", 3, 5);
    makeAnim(this, "hollow-side-walk", "hollow_side", 3, 5);

    // Effects & props.
    bakeFrame(this, "slash", SLASH, PAL);
    bakeFrame(this, "pillar", PILLAR, PAL);
    bakeFrame(this, "tombstone", TOMBSTONE, PAL);
    bakeFrame(this, "deadtree", DEADTREE, PAL);
    bakeFrame(this, "ember_0", EMBER_A, PAL);
    bakeFrame(this, "ember_1", EMBER_B, PAL);
    if (!this.anims.exists("ember-flicker")) {
      this.anims.create({
        key: "ember-flicker",
        frames: [{ key: "ember_0" }, { key: "ember_1" }],
        frameRate: 4,
        repeat: -1,
      });
    }

    this.makeGroundTiles();
    this.makeShadow();

    this.scene.start("Game");
    this.scene.launch("UI");
  }

  // A handful of ash-cobble variants with random cracks/specks for variation.
  private makeGroundTiles(): void {
    const base = [0x14121b, 0x16131d, 0x121019];
    for (let v = 0; v < 3; v++) {
      const key = `ground_${v}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.createCanvas(key, TILE, TILE);
      if (!tex) continue;
      const ctx = tex.context;
      ctx.fillStyle = "#" + base[v].toString(16).padStart(6, "0");
      ctx.fillRect(0, 0, TILE, TILE);
      // subtle grout lines
      ctx.fillStyle = "#0e0c14";
      ctx.fillRect(0, (v * 5) % TILE, TILE, 1);
      ctx.fillRect((v * 7) % TILE, 0, 1, TILE);
      // deterministic-ish specks
      let seed = v * 9301 + 49297;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = rnd() > 0.5 ? "#1d1a26" : "#0e0c14";
        ctx.fillRect(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), 1, 1);
      }
      tex.refresh();
    }
  }

  // Soft round drop-shadow used under every entity to sell the 2.5D ground plane.
  private makeShadow(): void {
    const key = "shadow";
    if (this.textures.exists(key)) return;
    const w = 16;
    const h = 7;
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }
}
