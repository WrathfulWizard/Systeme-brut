import Phaser from "phaser";
import { COLORS } from "./config";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";

// Runtime smoke hook: the headless boot test reads window.__ashbound to confirm
// the renderer reached the Game scene without throwing.
interface SmokeFlags { booted: boolean; error: string | null }
const smoke: SmokeFlags = { booted: false, error: null };
(window as unknown as { __ashbound: SmokeFlags }).__ashbound = smoke;
window.addEventListener("error", (e) => {
  smoke.error = String((e.error && e.error.stack) || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  smoke.error = String((e as PromiseRejectionEvent).reason);
});

// Ashbound — top-down 2.5D soulslike. Pixel-perfect render, world drawn at
// native resolution and zoomed by the camera.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: COLORS.bg,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene, UIScene],
};

new Phaser.Game(config);
