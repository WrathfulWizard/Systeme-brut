import Phaser from "phaser";
import { HOLLOW } from "../config";
import type { GameScene } from "../scenes/GameScene";
import type { Player } from "./Player";

type Mode = "idle" | "chase" | "windup" | "active" | "recovery" | "dead";

export class Hollow extends Phaser.Physics.Arcade.Sprite {
  hp: number = HOLLOW.maxHp;
  private mode: Mode = "idle";
  private t = 0; // phase timer
  private hitstunT = 0;
  private hitThisSwing = false;
  private shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Arc;
  private faceFront = true;
  private faceFlip = false;
  private animMoving = false;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "hollow_front_0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(8, 6);
    body.setOffset(1, 9);
    this.shadow = scene.add.image(x, y, "shadow").setDepth(0);
    // attack telegraph ring (hidden until windup)
    this.telegraph = scene.add.circle(x, y, HOLLOW.attackReach, 0xe0157a, 0.0).setDepth(1);
  }

  get world(): GameScene {
    return this.scene as GameScene;
  }

  update(dt: number, player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.hitstunT = Math.max(0, this.hitstunT - dt);

    if (this.mode === "dead") {
      this.syncDecor();
      return;
    }
    if (this.hitstunT > 0) {
      body.velocity.scale(0.8);
      this.syncDecor();
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const playerAlive = player.active && player.hp > 0;

    switch (this.mode) {
      case "idle":
        body.setVelocity(0, 0);
        this.setMoving(false);
        if (playerAlive && dist < HOLLOW.aggroRange) this.mode = "chase";
        break;

      case "chase": {
        if (!playerAlive) {
          this.mode = "idle";
          break;
        }
        if (dist <= HOLLOW.attackRange) {
          this.beginWindup(body);
          break;
        }
        const a = Math.atan2(dy, dx);
        body.setVelocity(Math.cos(a) * HOLLOW.speed, Math.sin(a) * HOLLOW.speed);
        this.faceFront = Math.abs(dy) >= Math.abs(dx);
        this.faceFlip = dx < 0;
        this.setMoving(true);
        break;
      }

      case "windup":
        body.setVelocity(0, 0);
        this.setMoving(false);
        this.faceTowards(dx, dy);
        this.t -= dt;
        // pulse the telegraph toward the strike
        this.telegraph.setFillStyle(0xe0157a, 0.12 + 0.18 * Math.sin(this.t * 24));
        if (this.t <= 0) {
          this.mode = "active";
          this.t = HOLLOW.attackActive;
          this.hitThisSwing = false;
          this.telegraph.setFillStyle(0xe0157a, 0.32);
        }
        break;

      case "active":
        this.t -= dt;
        if (!this.hitThisSwing && dist <= HOLLOW.attackReach + 8) {
          this.hitThisSwing = true;
          player.takeDamage(HOLLOW.attackDamage, this.x, this.y);
        }
        if (this.t <= 0) {
          this.mode = "recovery";
          this.t = HOLLOW.attackRecovery;
          this.telegraph.setFillStyle(0xe0157a, 0.0);
        }
        break;

      case "recovery":
        body.setVelocity(0, 0);
        this.setMoving(false);
        this.t -= dt;
        if (this.t <= 0) this.mode = playerAlive ? "chase" : "idle";
        break;
    }

    this.syncDecor();
  }

  private beginWindup(body: Phaser.Physics.Arcade.Body): void {
    this.mode = "windup";
    this.t = HOLLOW.attackWindup;
    body.setVelocity(0, 0);
  }

  takeDamage(amount: number, srcX: number, srcY: number): void {
    if (this.mode === "dead") return;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.clearTint());
    const a = Math.atan2(this.y - srcY, this.x - srcX);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(a) * HOLLOW.knockbackTaken,
      Math.sin(a) * HOLLOW.knockbackTaken,
    );
    this.hitstunT = 0.22;
    this.telegraph.setFillStyle(0xe0157a, 0.0);
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.mode = "dead";
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.telegraph.destroy();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: this.faceFlip ? -80 : 80,
      duration: 420,
      onComplete: () => this.destroy(),
    });
    this.world.onHollowDown();
  }

  private faceTowards(dx: number, dy: number): void {
    this.faceFront = Math.abs(dy) >= Math.abs(dx);
    this.faceFlip = dx < 0;
    this.applyTextureNow();
  }

  private setMoving(moving: boolean): void {
    if (moving === this.animMoving && !moving) {
      this.applyTextureNow();
      return;
    }
    this.animMoving = moving;
    this.applyTextureNow(moving);
  }

  private applyTextureNow(moving = this.animMoving): void {
    const dir = this.faceFront ? "front" : "side";
    this.setFlipX(dir === "side" && this.faceFlip);
    if (moving) {
      this.play(`hollow-${dir}-walk`, true);
    } else {
      this.stop();
      this.setTexture(`hollow_${dir}_0`);
    }
  }

  private syncDecor(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setDepth(body.bottom);
    this.shadow.setPosition(this.x, body.bottom - 2).setDepth(body.bottom - 1);
    this.telegraph.setPosition(this.x, this.y);
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    this.telegraph?.destroy();
    super.destroy(fromScene);
  }
}
