import Phaser from "phaser";
import { bakeFrame, bakeFramesStyled, makeAnim } from "../art/pixelart";
import { PAL, PLAYER_FRAMES, HOLLOW_FRAMES, BEAST_FRAMES, SLASH, EMBER_A, EMBER_B } from "../art/sprites";
import { generateTiles, generateProps, generateBoss, T } from "../art/gen";
import { BIOMES } from "../world/biomes";

// Builds every texture procedurally — characters, a full biome tileset, props,
// the boss — then hands off to the world. No external asset files.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    // Characters — outlined + rim-lit for a crisp, intentional silhouette.
    bakeFramesStyled(this, "player_front", PLAYER_FRAMES.front, PAL, 0x080610, 0x6a5d7e);
    bakeFramesStyled(this, "player_back", PLAYER_FRAMES.back, PAL, 0x080610, 0x6a5d7e);
    bakeFramesStyled(this, "player_side", PLAYER_FRAMES.side, PAL, 0x080610, 0x6a5d7e);
    bakeFramesStyled(this, "hollow_front", HOLLOW_FRAMES.front, PAL, 0x080610, 0x4a5a45);
    bakeFramesStyled(this, "hollow_side", HOLLOW_FRAMES.side, PAL, 0x080610, 0x4a5a45);
    bakeFramesStyled(this, "beast_front", BEAST_FRAMES.front, PAL, 0x080610, 0x4a5a45);
    bakeFramesStyled(this, "beast_side", BEAST_FRAMES.side, PAL, 0x080610, 0x4a5a45);

    makeAnim(this, "player-front-walk", "player_front", 3, 7);
    makeAnim(this, "player-back-walk", "player_back", 3, 7);
    makeAnim(this, "player-side-walk", "player_side", 3, 7);
    makeAnim(this, "hollow-front-walk", "hollow_front", 3, 5);
    makeAnim(this, "hollow-side-walk", "hollow_side", 3, 5);
    makeAnim(this, "beast-front-walk", "beast_front", 3, 9);
    makeAnim(this, "beast-side-walk", "beast_side", 3, 9);

    // Effects.
    bakeFrame(this, "slash", SLASH, PAL);
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

    // World art.
    const tiles = generateTiles(this, BIOMES);
    this.registry.set("tiles", tiles);
    generateProps(this);
    generateBoss(this);
    this.makeShadow();

    void T; // tile size is consumed by the world

    this.scene.start("Title");
  }

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
