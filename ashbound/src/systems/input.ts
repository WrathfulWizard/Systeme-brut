import Phaser from "phaser";

export interface InputState {
  moveX: number;
  moveY: number;
  rollPressed: boolean; // edge
  attackPressed: boolean; // edge
  lockPressed: boolean; // edge
  interactPressed: boolean; // edge
  healPressed: boolean; // edge
  heavyPressed: boolean; // edge (strong attack)
  pausePressed: boolean; // edge
  upPressed: boolean; // edge (menu)
  downPressed: boolean; // edge (menu)
}

// Wraps keyboard + mouse into a per-frame InputState with proper edge
// detection. Edge presses (roll/attack/lock/interact) are latched on event and
// consumed once per frame so a single tap never double-fires.
export class GameInput {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private latchRoll = false;
  private latchAttack = false;
  private latchLock = false;
  private latchInteract = false;
  private latchHeal = false;
  private latchHeavy = false;
  private latchPause = false;
  private latchUp = false;
  private latchDown = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = kb.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,J,K,TAB,E,Q,P,ESC,ENTER",
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    // Stop TAB from moving focus / browser default.
    kb.on("keydown-TAB", (e: KeyboardEvent) => e.preventDefault());
    kb.on("keydown-SPACE", () => (this.latchRoll = true));
    kb.on("keydown-J", () => (this.latchAttack = true));
    kb.on("keydown-TAB", () => (this.latchLock = true));
    kb.on("keydown-E", () => (this.latchInteract = true));
    kb.on("keydown-Q", () => (this.latchHeal = true));
    kb.on("keydown-K", () => (this.latchHeavy = true));
    kb.on("keydown-ESC", () => (this.latchPause = true));
    kb.on("keydown-P", () => (this.latchPause = true));
    kb.on("keydown-W", () => (this.latchUp = true));
    kb.on("keydown-UP", () => (this.latchUp = true));
    kb.on("keydown-S", () => (this.latchDown = true));
    kb.on("keydown-DOWN", () => (this.latchDown = true));

    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.latchAttack = true;
      if (p.rightButtonDown()) this.latchLock = true;
    });
    // Suppress the OS context menu on right-click (lock-on).
    scene.input.mouse?.disableContextMenu();
  }

  sample(): InputState {
    const k = this.keys;
    const down = (...names: string[]) => names.some((n) => k[n]?.isDown);
    let mx = 0;
    let my = 0;
    if (down("A", "LEFT")) mx -= 1;
    if (down("D", "RIGHT")) mx += 1;
    if (down("W", "UP")) my -= 1;
    if (down("S", "DOWN")) my += 1;

    const out: InputState = {
      moveX: mx,
      moveY: my,
      rollPressed: this.latchRoll,
      attackPressed: this.latchAttack,
      lockPressed: this.latchLock,
      interactPressed: this.latchInteract,
      healPressed: this.latchHeal,
      heavyPressed: this.latchHeavy,
      pausePressed: this.latchPause,
      upPressed: this.latchUp,
      downPressed: this.latchDown,
    };
    this.latchRoll = this.latchAttack = this.latchLock = this.latchInteract = false;
    this.latchHeal = this.latchHeavy = this.latchPause = false;
    this.latchUp = this.latchDown = false;
    return out;
  }
}
