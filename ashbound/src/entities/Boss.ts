import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { Player } from "./Player";
import { playerState } from "../systems/state";
import { sfx } from "../systems/audio";

type Mode = "sleep" | "chase" | "wind" | "slam" | "recover" | "dead";

const SPD = 36;
const SPD2 = 56;
const RANGE = 46;
const WIND = 0.7;
const WIND2 = 0.46;
const ACTIVE = 0.2;
const RECOVER = 0.7;
const RECOVER2 = 0.46;
const DMG = 38;
const AOE_R = 54;
const KB = 170;
const MAX_HP = 900;
const RUNES = 3000;

export class Boss extends Phaser.Physics.Arcade.Sprite {
  hp = MAX_HP;
  private mode: Mode = "sleep";
  private t = 0;
  private hitstunT = 0;
  private activated = false;
  private phase2 = false;
  private aoe: Phaser.GameObjects.Arc;
  private aoeX = 0;
  private aoeY = 0;
  private hitDone = false;
  private stepT = 0;
  private stepFrame = 0;
  private shadow: Phaser.GameObjects.Image;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "boss_0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 9);
    body.setOffset((this.width - 14) / 2, this.height - 11);
    body.setImmovable(false);
    this.shadow = scene.add.image(x, y, "shadow").setScale(2).setDepth(0);
    this.aoe = scene.add.circle(x, y, AOE_R, 0xe0157a, 0).setDepth(2);
  }

  get world(): GameScene {
    return this.scene as GameScene;
  }

  activate(): void {
    if (this.activated || this.mode === "dead") return;
    this.activated = true;
    this.mode = "chase";
    playerState.bossName = "The Cinder Lord";
    playerState.bossFrac = 1;
  }

  update(dt: number, player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.hitstunT = Math.max(0, this.hitstunT - dt);
    this.syncDecor();
    if (this.mode === "dead") return;
    if (!this.activated) return;

    if (!this.phase2 && this.hp <= MAX_HP * 0.5) {
      this.phase2 = true;
      this.world.shake(0.012, 400);
      playerState.zoneTitle = "";
      this.world.banner("THE FLAME RISES");
    }
    playerState.bossFrac = this.hp / MAX_HP;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const alive = player.active && player.hp > 0;
    const spd = this.phase2 ? SPD2 : SPD;

    if (this.hitstunT > 0 && this.mode === "chase") {
      body.velocity.scale(0.85);
      return;
    }

    switch (this.mode) {
      case "chase": {
        if (!alive) {
          body.setVelocity(0, 0);
          break;
        }
        if (dist <= RANGE) {
          this.mode = "wind";
          this.t = this.phase2 ? WIND2 : WIND;
          body.setVelocity(0, 0);
          this.setTexture("boss_2");
          this.aoeX = this.x + (dx / (dist || 1)) * 30;
          this.aoeY = this.y + (dy / (dist || 1)) * 30;
          break;
        }
        const a = Math.atan2(dy, dx);
        body.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd);
        this.setFlipX(dx < 0);
        this.stepBob(dt);
        break;
      }
      case "wind":
        body.setVelocity(0, 0);
        this.t -= dt;
        this.aoe.setPosition(this.aoeX, this.aoeY);
        this.aoe.setFillStyle(0xe0157a, 0.1 + 0.22 * (1 - this.t / WIND));
        if (this.t <= 0) {
          this.mode = "slam";
          this.t = ACTIVE;
          this.hitDone = false;
          this.setTexture("boss_3");
          this.aoe.setFillStyle(0xe0157a, 0.4);
          this.world.shake(0.01, 200);
          sfx.bossSlam();
        }
        break;
      case "slam":
        this.t -= dt;
        if (!this.hitDone) {
          this.hitDone = true;
          if (Phaser.Math.Distance.Between(this.aoeX, this.aoeY, player.x, player.y) < AOE_R) {
            player.takeDamage(DMG, this.aoeX, this.aoeY);
          }
          this.world.shake(0.014, 220);
        }
        if (this.t <= 0) {
          this.mode = "recover";
          this.t = this.phase2 ? RECOVER2 : RECOVER;
          this.aoe.setFillStyle(0xe0157a, 0);
          this.setTexture("boss_0");
        }
        break;
      case "recover":
        body.setVelocity(0, 0);
        this.t -= dt;
        if (this.t <= 0) this.mode = "chase";
        break;
    }
  }

  private stepBob(dt: number): void {
    this.stepT += dt;
    if (this.stepT > 0.22) {
      this.stepT = 0;
      this.stepFrame ^= 1;
      this.setTexture(this.stepFrame ? "boss_1" : "boss_0");
    }
  }

  takeDamage(amount: number, srcX: number, srcY: number): void {
    if (this.mode === "dead" || !this.activated) return;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => this.active && this.clearTint());
    // bosses have poise — only nudge, never stun-lock
    const a = Math.atan2(this.y - srcY, this.x - srcX);
    (this.body as Phaser.Physics.Arcade.Body).velocity.x += Math.cos(a) * KB * 0.1;
    (this.body as Phaser.Physics.Arcade.Body).velocity.y += Math.sin(a) * KB * 0.1;
    this.hitstunT = 0.08;
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.mode = "dead";
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.aoe.destroy();
    playerState.bossFrac = -1;
    this.world.shake(0.02, 600);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1400,
      onComplete: () => this.destroy(),
    });
    this.world.onBossDown(RUNES);
  }

  private syncDecor(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setDepth(body.bottom);
    this.shadow.setPosition(this.x, body.bottom).setDepth(body.bottom - 1);
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    this.aoe?.destroy();
    super.destroy(fromScene);
  }
}
