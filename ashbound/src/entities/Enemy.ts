import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { Player } from "./Player";

export type Archetype = "hollow" | "mireling" | "emberknight";

interface Arch {
  maxHp: number;
  speed: number;
  aggro: number;
  atkRange: number;
  windup: number;
  active: number;
  recovery: number;
  dmg: number;
  reach: number;
  kb: number;
  tex: "hollow" | "beast";
  scale: number;
  runes: number;
  tint?: number;
}

const ARCH: Record<Archetype, Arch> = {
  hollow: {
    maxHp: 70, speed: 46, aggro: 150, atkRange: 22, windup: 0.42, active: 0.12,
    recovery: 0.5, dmg: 16, reach: 20, kb: 70, tex: "hollow", scale: 1, runes: 28,
  },
  mireling: {
    maxHp: 52, speed: 74, aggro: 180, atkRange: 20, windup: 0.3, active: 0.1,
    recovery: 0.38, dmg: 14, reach: 18, kb: 60, tex: "beast", scale: 1, runes: 22,
    tint: 0x7fa86a,
  },
  emberknight: {
    maxHp: 120, speed: 40, aggro: 160, atkRange: 24, windup: 0.55, active: 0.14,
    recovery: 0.55, dmg: 26, reach: 22, kb: 80, tex: "hollow", scale: 1.18, runes: 70,
    tint: 0xd8702a,
  },
};

type Mode = "idle" | "chase" | "windup" | "active" | "recovery" | "dead";

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  private cfg: Arch;
  private mode: Mode = "idle";
  private t = 0;
  private hitstunT = 0;
  private hitThisSwing = false;
  private shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Arc;
  private faceFront = true;
  private faceFlip = false;
  private animMoving = false;
  private baseTint?: number;

  constructor(scene: GameScene, x: number, y: number, archetype: Archetype) {
    const cfg = ARCH[archetype];
    super(scene, x, y, `${cfg.tex}_front_0`);
    this.cfg = cfg;
    this.hp = cfg.maxHp;
    this.baseTint = cfg.tint;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.5);
    this.setScale(cfg.scale);
    if (this.baseTint !== undefined) this.setTint(this.baseTint);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(8, 6);
    body.setOffset(1, this.height - 6);
    this.shadow = scene.add.image(x, y, "shadow").setDepth(0).setScale(cfg.scale);
    this.telegraph = scene.add.circle(x, y, cfg.atkRange, 0xe0157a, 0).setDepth(1);
  }

  get world(): GameScene {
    return this.scene as GameScene;
  }

  update(dt: number, player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.hitstunT = Math.max(0, this.hitstunT - dt);
    if (this.mode === "dead") return;
    if (this.hitstunT > 0) {
      body.velocity.scale(0.8);
      this.syncDecor();
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const alive = player.active && player.hp > 0;
    const c = this.cfg;

    switch (this.mode) {
      case "idle":
        body.setVelocity(0, 0);
        this.setMoving(false);
        if (alive && dist < c.aggro) this.mode = "chase";
        break;
      case "chase": {
        if (!alive) {
          this.mode = "idle";
          break;
        }
        if (dist <= c.atkRange) {
          this.mode = "windup";
          this.t = c.windup;
          body.setVelocity(0, 0);
          break;
        }
        const a = Math.atan2(dy, dx);
        body.setVelocity(Math.cos(a) * c.speed, Math.sin(a) * c.speed);
        this.faceFront = Math.abs(dy) >= Math.abs(dx);
        this.faceFlip = dx < 0;
        this.setMoving(true);
        break;
      }
      case "windup":
        body.setVelocity(0, 0);
        this.setMoving(false);
        this.faceFront = Math.abs(dy) >= Math.abs(dx);
        this.faceFlip = dx < 0;
        this.applyTextureNow(false);
        this.t -= dt;
        this.telegraph.setFillStyle(0xe0157a, 0.12 + 0.18 * Math.sin(this.t * 24));
        if (this.t <= 0) {
          this.mode = "active";
          this.t = c.active;
          this.hitThisSwing = false;
          this.telegraph.setFillStyle(0xe0157a, 0.32);
        }
        break;
      case "active":
        this.t -= dt;
        if (!this.hitThisSwing && dist <= c.reach + 8) {
          this.hitThisSwing = true;
          player.takeDamage(c.dmg, this.x, this.y);
        }
        if (this.t <= 0) {
          this.mode = "recovery";
          this.t = c.recovery;
          this.telegraph.setFillStyle(0xe0157a, 0);
        }
        break;
      case "recovery":
        body.setVelocity(0, 0);
        this.setMoving(false);
        this.t -= dt;
        if (this.t <= 0) this.mode = alive ? "chase" : "idle";
        break;
    }
    this.syncDecor();
  }

  takeDamage(amount: number, srcX: number, srcY: number): void {
    if (this.mode === "dead") return;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.applyBaseTint());
    const a = Math.atan2(this.y - srcY, this.x - srcX);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(a) * this.cfg.kb,
      Math.sin(a) * this.cfg.kb,
    );
    this.hitstunT = 0.22;
    this.telegraph.setFillStyle(0xe0157a, 0);
    if (this.hp <= 0) this.die();
  }

  private applyBaseTint(): void {
    if (this.baseTint !== undefined) this.setTint(this.baseTint);
    else this.clearTint();
  }

  private die(): void {
    this.mode = "dead";
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.telegraph.destroy();
    const rx = this.x;
    const ry = this.y;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: this.faceFlip ? -80 : 80,
      duration: 420,
      onComplete: () => this.destroy(),
    });
    this.world.onEnemyDown(this.cfg.runes, rx, ry);
  }

  private setMoving(moving: boolean): void {
    if (moving === this.animMoving) {
      if (!moving) this.applyTextureNow(false);
      return;
    }
    this.animMoving = moving;
    this.applyTextureNow(moving);
  }

  private applyTextureNow(moving = this.animMoving): void {
    const dir = this.faceFront ? "front" : "side";
    this.setFlipX(dir === "side" && this.faceFlip);
    if (moving) this.play(`${this.cfg.tex}-${dir}-walk`, true);
    else {
      this.stop();
      this.setTexture(`${this.cfg.tex}_${dir}_0`);
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
