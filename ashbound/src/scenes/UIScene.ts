import Phaser from "phaser";
import { COLORS } from "../config";
import { playerState } from "../systems/state";

// Screen-space HUD. Runs at native resolution (no world zoom) so text and bars
// stay crisp. Reads playerState each frame.
export class UIScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private enemyText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("UI");
  }

  create(): void {
    this.g = this.add.graphics().setDepth(10);

    this.enemyText = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "16px", color: hex(COLORS.textDim) })
      .setDepth(11);

    this.banner = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: hex(COLORS.text),
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(12);

    this.hint = this.add
      .text(16, 0, "WASD move · J/LMB attack · SPACE dodge · TAB/RMB lock · E rest at ember", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: hex(COLORS.textDim),
      })
      .setDepth(11);

    this.scale.on("resize", () => this.layout());
    this.layout();
  }

  private layout(): void {
    const h = this.scale.height;
    this.banner.setPosition(this.scale.width / 2, this.scale.height * 0.4);
    this.hint.setPosition(16, h - 24);
  }

  update(): void {
    const g = this.g;
    g.clear();

    const x = 16;
    const y = 16;
    const w = 220;

    // health
    bar(g, x, y, w, 14, playerState.hp / playerState.maxHp, COLORS.hpBack, COLORS.hpFull);
    // stamina
    bar(
      g,
      x,
      y + 20,
      w,
      8,
      playerState.stamina / playerState.maxStamina,
      COLORS.stamBack,
      COLORS.stamFull,
    );

    this.enemyText.setPosition(x, y + 34);
    this.enemyText.setText(`hollows remaining  ${playerState.enemiesLeft}`);

    // banner
    if (playerState.message && this.time.now < playerState.messageUntil) {
      this.banner.setText(playerState.message);
      const dying = playerState.message === "YOU DIED";
      this.banner.setColor(dying ? hex(COLORS.hpFull) : hex(COLORS.text));
      this.banner.setVisible(true);
    } else {
      this.banner.setVisible(false);
    }
  }
}

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
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
