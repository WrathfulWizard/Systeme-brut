import Phaser from "phaser";
import { COLORS } from "../config";
import { initAudio, resumeAudio, sfx } from "../systems/audio";

const SAVE_KEY = "ashbound.save.v1";

// Quiet, grim title card. Drifting ash, one ember, one prompt.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    initAudio();
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor("#06050a");

    // central ember glow
    this.add
      .image(w / 2, h * 0.46, "fx_light")
      .setTint(0xd8702a)
      .setScale(5)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);

    // drifting ash
    const ash = this.add.particles(0, 0, "fx_ash", {
      x: { min: 0, max: w },
      y: h + 10,
      lifespan: 9000,
      speedY: { min: -26, max: -10 },
      speedX: { min: -8, max: 8 },
      scale: { min: 0.5, max: 1.4 },
      alpha: { start: 0.5, end: 0 },
      tint: 0x9a8fae,
      frequency: 120,
      quantity: 1,
    });
    ash.setDepth(1);

    const title = this.add
      .text(w / 2, h * 0.4, "ASHBOUND", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: hex(COLORS.text),
        stroke: "#000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({ targets: title, alpha: { from: 0.7, to: 1 }, duration: 2600, yoyo: true, repeat: -1 });

    this.add
      .text(w / 2, h * 0.4 + 52, "a pilgrimage into the forgetting", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: hex(COLORS.textDim),
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(5);

    const hasSave = !!this.safeGet();
    const prompt = this.add
      .text(w / 2, h * 0.72, hasSave ? "ENTER — continue        N — new game" : "ENTER — begin", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: hex(COLORS.text),
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({ targets: prompt, alpha: { from: 0.35, to: 1 }, duration: 1100, yoyo: true, repeat: -1 });

    this.add
      .text(w / 2, h - 26, "WASD move · J attack · SPACE dodge · TAB lock · Q estus · E ember", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: hex(COLORS.textDim),
      })
      .setOrigin(0.5)
      .setDepth(5);

    const begin = (fresh: boolean) => {
      resumeAudio();
      sfx.uiSelect();
      if (fresh) this.safeClear();
      this.cameras.main.fade(700, 6, 5, 10);
      this.time.delayedCall(720, () => {
        this.scene.start("Game");
        this.scene.launch("UI");
      });
    };

    this.input.keyboard!.once("keydown-ENTER", () => begin(false));
    this.input.keyboard!.on("keydown-N", () => begin(true));
    this.input.once("pointerdown", () => begin(false));
  }

  private safeGet(): string | null {
    try {
      return window.localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  }
  private safeClear(): void {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}
