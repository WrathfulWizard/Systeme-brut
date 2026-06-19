import Phaser from "phaser";
import { COLORS } from "../config";
import { playerState, PAUSE_OPTIONS, type MinimapData } from "../systems/state";

// Screen-space HUD at native resolution. Reads playerState each frame. Also
// owns the colour-grade, vignette and minimap — overlays that must NOT be
// scaled by the world camera's zoom (the game runs at zoom 3).
export class UIScene extends Phaser.Scene {
  private grade!: Phaser.GameObjects.Rectangle;
  private vignette!: Phaser.GameObjects.Image;
  private mmImage?: Phaser.GameObjects.Image;
  private mmFrame?: Phaser.GameObjects.Rectangle;
  private mmBack?: Phaser.GameObjects.Rectangle;
  private mmMarkers: Phaser.GameObjects.Rectangle[] = [];
  private mmDot?: Phaser.GameObjects.Rectangle;
  private mm = { x: 0, y: 0, w: 156, h: 117 };
  private g!: Phaser.GameObjects.Graphics;
  private stats!: Phaser.GameObjects.Text;
  private runes!: Phaser.GameObjects.Text;
  private zoneTitle!: Phaser.GameObjects.Text;
  private zoneSub!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private menu!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("UI");
  }

  create(): void {
    // colour-grade + vignette sit over the world (this scene renders above the
    // game scene) but below every HUD element.
    this.grade = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(-10);
    this.vignette = this.add
      .image(0, 0, "fx_vignette")
      .setOrigin(0)
      .setDepth(-9)
      .setDisplaySize(this.scale.width, this.scale.height);

    this.g = this.add.graphics().setDepth(10);
    const mono = "monospace";

    this.stats = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "13px", color: hex(COLORS.text) })
      .setDepth(11);
    this.runes = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "15px", color: "#e8d39a" })
      .setOrigin(1, 0)
      .setDepth(11);

    this.zoneTitle = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "34px", color: hex(COLORS.text), stroke: "#000", strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(12);
    this.zoneSub = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "14px", color: hex(COLORS.textDim), fontStyle: "italic" })
      .setOrigin(0.5)
      .setDepth(12);

    this.banner = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "40px", color: hex(COLORS.text), stroke: "#000", strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(13);

    this.bossName = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "16px", color: "#d8b0a8", stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(13);

    this.prompt = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "14px", color: hex(COLORS.text), stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(13);

    this.menu = this.add
      .text(0, 0, "", { fontFamily: mono, fontSize: "16px", color: hex(COLORS.text), align: "left", lineSpacing: 8 })
      .setOrigin(0.5)
      .setDepth(15);

    this.pauseText = this.add
      .text(0, 0, "", {
        fontFamily: mono,
        fontSize: "22px",
        color: hex(COLORS.text),
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.hint = this.add
      .text(0, 0, "WASD move · J attack · K heavy · SPACE dodge · TAB lock · Q estus · E ember · ESC pause", {
        fontFamily: mono,
        fontSize: "11px",
        color: hex(COLORS.textDim),
      })
      .setDepth(11);

    this.scale.on("resize", () => this.layout());
    this.layout();
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    this.runes.setPosition(w - 16, 16);
    this.zoneTitle.setPosition(w / 2, h * 0.34);
    this.zoneSub.setPosition(w / 2, h * 0.34 + 26);
    this.banner.setPosition(w / 2, h * 0.42);
    this.bossName.setPosition(w / 2, h - 54);
    this.prompt.setPosition(w / 2, h - 86);
    this.menu.setPosition(w / 2, h / 2);
    this.pauseText.setPosition(w / 2, h / 2);
    this.hint.setPosition(16, h - 22);
    this.grade.setSize(w, h);
    this.vignette.setDisplaySize(w, h);
    this.mm.x = w - this.mm.w - 14;
    this.mm.y = h - this.mm.h - 14;
    this.positionMinimap();
  }

  // Lazily assemble the minimap once GameScene has baked its texture + data.
  private tryBuildMinimap(): void {
    if (this.mmImage || !this.textures.exists("minimap")) return;
    const data = this.registry.get("mmData") as MinimapData | undefined;
    if (!data) return;
    const { x, y, w, h } = this.mm;
    this.mmBack = this.add.rectangle(x - 3, y - 3, w + 6, h + 6, 0x05040a, 0.85).setOrigin(0).setDepth(30);
    this.mmImage = this.add.image(x, y, "minimap").setOrigin(0).setDepth(31).setDisplaySize(w, h);
    this.mmFrame = this.add.rectangle(x - 3, y - 3, w + 6, h + 6).setOrigin(0).setStrokeStyle(1, 0x8a8298, 0.9).setDepth(33);
    for (const f of data.bonfires) {
      this.mmMarkers.push(this.add.rectangle(x + f.nx * w, y + f.ny * h, 3, 3, 0xffb050).setDepth(32));
    }
    this.mmMarkers.push(this.add.rectangle(x + data.boss.nx * w, y + data.boss.ny * h, 4, 4, 0xb04030).setDepth(32));
    this.mmDot = this.add.rectangle(0, 0, 4, 4, 0xffffff).setStrokeStyle(1, 0x000000, 0.8).setDepth(34);
    this.positionMinimap();
  }

  private positionMinimap(): void {
    if (!this.mmImage) return;
    const data = this.registry.get("mmData") as MinimapData | undefined;
    const { x, y, w, h } = this.mm;
    this.mmBack!.setPosition(x - 3, y - 3);
    this.mmImage.setPosition(x, y);
    this.mmFrame!.setPosition(x - 3, y - 3);
    if (data) {
      const all = [...data.bonfires, data.boss];
      this.mmMarkers.forEach((m, i) => m.setPosition(x + all[i].nx * w, y + all[i].ny * h));
    }
  }

  update(): void {
    const g = this.g;
    g.clear();
    const now = this.time.now;

    // colour grade + minimap
    this.grade.setFillStyle(playerState.ambientColor, playerState.ambientAlpha);
    this.tryBuildMinimap();
    if (this.mmDot) {
      this.mmDot.setPosition(
        this.mm.x + playerState.mmX * this.mm.w,
        this.mm.y + playerState.mmY * this.mm.h,
      );
    }

    // bars
    const x = 16;
    const y = 16;
    const w = 240;
    bar(g, x, y, w, 14, playerState.hp / playerState.maxHp, COLORS.hpBack, COLORS.hpFull);
    bar(g, x, y + 20, w * 0.8, 8, playerState.stamina / playerState.maxStamina, COLORS.stamBack, COLORS.stamFull);

    // estus pips + level/zone line
    let estusStr = "";
    for (let i = 0; i < playerState.estusMax; i++) estusStr += i < playerState.estus ? "▮" : "▯";
    this.stats.setPosition(x, y + 32);
    this.stats.setText(`Lv ${playerState.level}   estus ${estusStr}   ${playerState.zone}`);

    // runes
    const lost = playerState.lostRunes > 0 ? `   (lost ${playerState.lostRunes})` : "";
    this.runes.setText(`✦ ${playerState.runes}${lost}`);

    // zone card
    const showZone = playerState.zoneTitle && now < playerState.zoneUntil;
    const za = showZone ? fade(now, playerState.zoneUntil) : 0;
    this.zoneTitle.setText(playerState.zoneTitle).setAlpha(za).setVisible(!!showZone);
    this.zoneSub.setText(playerState.zoneSub).setAlpha(za).setVisible(!!showZone);

    // banner
    const showBanner = playerState.message && now < playerState.messageUntil;
    if (showBanner) {
      this.banner.setText(playerState.message);
      this.banner.setColor(playerState.message === "YOU DIED" ? hex(COLORS.hpFull) : hex(COLORS.text));
      this.banner.setAlpha(fade(now, playerState.messageUntil)).setVisible(true);
    } else this.banner.setVisible(false);

    // boss bar
    if (playerState.bossFrac >= 0) {
      const bw = Math.min(this.scale.width * 0.6, 560);
      const bx = (this.scale.width - bw) / 2;
      const by = this.scale.height - 44;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(bx - 2, by - 2, bw + 4, 12);
      g.fillStyle(0x2a0d0d, 1);
      g.fillRect(bx, by, bw, 8);
      g.fillStyle(0xb04030, 1);
      g.fillRect(bx, by, bw * Phaser.Math.Clamp(playerState.bossFrac, 0, 1), 8);
      this.bossName.setText(playerState.bossName).setVisible(true);
    } else this.bossName.setVisible(false);

    // prompt
    this.prompt.setText(playerState.prompt).setVisible(!!playerState.prompt && !playerState.menuOpen);

    // bonfire menu
    if (playerState.menuOpen) {
      const cw = 360;
      const ch = 30 + playerState.menuOptions.length * 26;
      const mx = (this.scale.width - cw) / 2;
      const my = this.scale.height / 2 - ch / 2;
      g.fillStyle(0x07060a, 0.92);
      g.fillRect(mx, my, cw, ch);
      g.lineStyle(1, 0x4a4654, 1);
      g.strokeRect(mx, my, cw, ch);
      const lines = playerState.menuOptions
        .map((o, i) => (i === playerState.menuIndex ? `›  ${o}` : `   ${o}`))
        .join("\n");
      this.menu.setText(lines).setVisible(true);
    } else this.menu.setVisible(false);

    // pause overlay
    if (playerState.paused) {
      g.fillStyle(0x05040a, 0.7);
      g.fillRect(0, 0, this.scale.width, this.scale.height);
      const opts = PAUSE_OPTIONS.map((o, i) => (i === playerState.pauseIndex ? `›  ${o}` : `    ${o}`)).join("\n");
      this.pauseText.setText(`— PAUSED —\n\n${opts}`).setVisible(true);
    } else this.pauseText.setVisible(false);
  }
}

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}
function fade(now: number, until: number): number {
  const left = until - now;
  if (left > 600) return 1;
  return Phaser.Math.Clamp(left / 600, 0, 1);
}
function bar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  back: number,
  front: number,
): void {
  const f = Phaser.Math.Clamp(frac, 0, 1);
  g.fillStyle(0x000000, 0.5);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(back, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(front, 1);
  g.fillRect(x, y, w * f, h);
  g.lineStyle(1, 0x000000, 0.6);
  g.strokeRect(x, y, w, h);
}
