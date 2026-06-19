import Phaser from "phaser";
import { ZOOM } from "../config";
import { Player } from "../entities/Player";
import { Hollow } from "../entities/Enemy";
import { GameInput } from "../systems/input";
import { playerState, flash } from "../systems/state";

const WORLD_W = 1280;
const WORLD_H = 896;

interface Spawn {
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  player!: Player;
  lockTarget: Hollow | null = null;

  private input2!: GameInput;
  private enemies!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private reticle!: Phaser.GameObjects.Arc;
  private ember!: Phaser.GameObjects.Sprite;
  private hitStopT = 0;
  private respawnPending = false;
  private checkpoint: Spawn = { x: 200, y: 640 };
  private enemySpawns: Spawn[] = [];

  constructor() {
    super("Game");
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.buildFloor();
    this.obstacles = this.physics.add.staticGroup();
    this.buildLevel();

    this.input2 = new GameInput(this);

    this.player = new Player(this, this.checkpoint.x, this.checkpoint.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.enemies = this.physics.add.group();
    this.enemySpawns = [
      { x: 560, y: 360 },
      { x: 760, y: 520 },
      { x: 920, y: 300 },
      { x: 1040, y: 620 },
      { x: 680, y: 740 },
    ];
    this.spawnAllEnemies();

    // colliders
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies);

    // lock-on reticle (steel — magenta is reserved for the attack telegraph).
    this.reticle = this.add
      .circle(0, 0, 10)
      .setStrokeStyle(1, 0xc6ccd6, 0.9)
      .setVisible(false)
      .setDepth(50000);

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(ZOOM);
    cam.setRoundPixels(true);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setBackgroundColor("#07060a");

    flash(this.time.now, "ASHBOUND", 2600);

    const w = window as unknown as { __ashbound?: { booted: boolean } };
    if (w.__ashbound) w.__ashbound.booted = true;
  }

  private buildFloor(): void {
    this.add
      .tileSprite(0, 0, WORLD_W, WORLD_H, "ground_0")
      .setOrigin(0)
      .setDepth(-1000);
    // scattered variant tiles for texture
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 140; i++) {
      const key = rnd() > 0.5 ? "ground_1" : "ground_2";
      this.add
        .image(Math.floor(rnd() * WORLD_W), Math.floor(rnd() * WORLD_H), key)
        .setOrigin(0)
        .setDepth(-999);
    }
  }

  private buildLevel(): void {
    // Hand-placed props. Pillars & trees collide; tombstones are decoration.
    const pillars = [
      [320, 280],
      [320, 480],
      [880, 200],
      [880, 760],
      [1120, 460],
      [620, 200],
    ];
    for (const [x, y] of pillars) this.addObstacle("pillar", x, y, 6, 5);

    const trees = [
      [180, 300],
      [240, 800],
      [1000, 500],
      [700, 620],
      [460, 720],
    ];
    for (const [x, y] of trees) this.addObstacle("deadtree", x, y, 5, 4);

    const stones = [
      [420, 360],
      [800, 420],
      [960, 680],
      [540, 560],
    ];
    for (const [x, y] of stones) {
      this.add.image(x, y, "tombstone").setDepth(y);
    }

    // The ember — checkpoint & bonfire.
    this.ember = this.add
      .sprite(this.checkpoint.x, this.checkpoint.y - 18, "ember_0")
      .setDepth(this.checkpoint.y - 18);
    this.ember.play("ember-flicker");
  }

  private addObstacle(
    key: string,
    x: number,
    y: number,
    bodyW: number,
    bodyH: number,
  ): void {
    const img = this.obstacles.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
    img.setDepth(y);
    const body = img.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(bodyW, bodyH);
    // anchor collision at the base of the prop
    body.setOffset((img.width - bodyW) / 2, img.height - bodyH);
  }

  private spawnAllEnemies(): void {
    for (const s of this.enemySpawns) {
      const h = new Hollow(this, s.x, s.y);
      (h.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.enemies.add(h);
    }
    playerState.enemiesLeft = this.enemies.countActive(true);
  }

  // ── world API used by entities ────────────────────────────────────────────
  enemyList(): Hollow[] {
    return this.enemies.getChildren() as Hollow[];
  }

  toggleLock(): void {
    if (this.lockTarget && this.lockTarget.active) {
      this.lockTarget = null;
      return;
    }
    let best: Hollow | null = null;
    let bestD = 320;
    for (const e of this.enemyList()) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    this.lockTarget = best;
  }

  spawnSlash(x: number, y: number, angle: number): void {
    const off = 14;
    const s = this.add.image(x + Math.cos(angle) * off, y + Math.sin(angle) * off, "slash");
    s.setRotation(angle);
    s.setDepth((this.player.body as Phaser.Physics.Arcade.Body).bottom + 1);
    s.setScale(0.7);
    s.setAlpha(0.95);
    this.tweens.add({
      targets: s,
      scale: 1.15,
      alpha: 0,
      duration: 150,
      onComplete: () => s.destroy(),
    });
  }

  hitStop(ms: number): void {
    this.hitStopT = Math.max(this.hitStopT, ms);
  }

  shake(intensity: number, duration: number): void {
    this.cameras.main.shake(duration, intensity);
  }

  onHollowDown(): void {
    if (this.lockTarget && !this.lockTarget.active) this.lockTarget = null;
    const left = this.enemies.countActive(true);
    playerState.enemiesLeft = left;
    if (left <= 0) flash(this.time.now, "THE HOLLOWS LIE STILL", 3000);
  }

  onPlayerDeath(): void {
    if (this.respawnPending) return;
    this.respawnPending = true;
    playerState.dead = true;
    flash(this.time.now, "YOU DIED", 2600);
    this.cameras.main.fade(1400, 8, 4, 10, false);
    this.time.delayedCall(1800, () => this.doRespawn());
  }

  private doRespawn(): void {
    this.enemies.clear(true, true);
    this.spawnAllEnemies();
    this.lockTarget = null;
    this.player.respawn(this.checkpoint.x, this.checkpoint.y);
    playerState.dead = false;
    this.respawnPending = false;
    this.cameras.main.fadeFrom(700, 8, 4, 10);
  }

  private restAtEmber(): void {
    this.player.respawn(this.checkpoint.x, this.checkpoint.y);
    this.enemies.clear(true, true);
    this.spawnAllEnemies();
    this.lockTarget = null;
    flash(this.time.now, "You rest. The ash stirs anew.", 2400);
  }

  update(_time: number, delta: number): void {
    if (this.hitStopT > 0) {
      this.hitStopT -= delta;
      return;
    }
    const dt = Math.min(delta / 1000, 0.05);
    const input = this.input2.sample();

    if (!this.respawnPending) this.player.update(dt, input);

    for (const e of this.enemyList()) {
      if (e.active) e.update(dt, this.player);
    }

    // drop a dead lock target
    if (this.lockTarget && !this.lockTarget.active) this.lockTarget = null;
    playerState.lockedOn = !!this.lockTarget;
    if (this.lockTarget) {
      this.reticle.setVisible(true).setPosition(this.lockTarget.x, this.lockTarget.y - 10);
    } else {
      this.reticle.setVisible(false);
    }

    // bonfire rest
    const nearEmber =
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.checkpoint.x,
        this.checkpoint.y,
      ) < 36;
    if (nearEmber && input.interactPressed && !this.respawnPending) {
      this.restAtEmber();
    }
  }
}
