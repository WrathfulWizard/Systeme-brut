import Phaser from "phaser";
import { PLAYER } from "../config";
import type { InputState } from "../systems/input";
import { playerState } from "../systems/state";
import { sfx } from "../systems/audio";
import type { GameScene } from "../scenes/GameScene";

type Mode = "free" | "roll" | "attack" | "dead";
type Dir = "front" | "back" | "side";

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number = PLAYER.maxHp;
  stamina: number = PLAYER.maxStamina;
  maxHp: number = PLAYER.maxHp;
  maxStamina: number = PLAYER.maxStamina;

  private mode: Mode = "free";
  private faceX = 0;
  private faceY = 1; // start facing the camera
  private shadow: Phaser.GameObjects.Image;

  // timers (seconds, counting down)
  private rollElapsed = 0;
  private rollDirX = 0;
  private rollDirY = 0;
  private busyT = 0; // action lockout (post-roll recovery)
  private attackPhase: "windup" | "active" | "recovery" = "windup";
  private attackT = 0;
  private attackAngle = 0;
  private hitThisSwing = new Set<object>();
  private invulnT = 0;
  private hitstunT = 0;
  private regenDelayT = 0;
  private currentAnimDir: Dir | null = null;
  private currentMoving = false;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "player_front_0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(8, 6);
    body.setOffset(3, 11);
    this.shadow = scene.add.image(x, y, "shadow").setDepth(0);
  }

  get world(): GameScene {
    return this.scene as GameScene;
  }

  get invulnerable(): boolean {
    if (this.invulnT > 0) return true;
    // i-frames live in the early part of the roll
    return this.mode === "roll" && this.rollElapsed < PLAYER.rollIFrames;
  }

  update(dt: number, input: InputState): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // timers
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.busyT = Math.max(0, this.busyT - dt);
    this.hitstunT = Math.max(0, this.hitstunT - dt);
    this.regenDelayT = Math.max(0, this.regenDelayT - dt);

    if (this.regenDelayT <= 0 && this.mode !== "dead") {
      this.stamina = Math.min(this.maxStamina, this.stamina + PLAYER.staminaRegen * dt);
    }

    if (this.mode === "dead") {
      body.setVelocity(0, 0);
      this.syncDecor();
      return;
    }

    // lock-on toggle is always allowed
    if (input.lockPressed) this.world.toggleLock();

    switch (this.mode) {
      case "free":
        this.updateFree(dt, input, body);
        break;
      case "roll":
        this.updateRoll(dt, body);
        break;
      case "attack":
        this.updateAttack(dt, body);
        break;
    }

    this.publish();
    this.syncDecor();
  }

  private updateFree(_dt: number, input: InputState, body: Phaser.Physics.Arcade.Body): void {
    // When locked on, the Penitent always faces the target (strafe combat).
    const target = this.world.lockTarget;
    if (target && target.active) {
      const a = Math.atan2(target.y - this.y, target.x - this.x);
      this.faceX = Math.cos(a);
      this.faceY = Math.sin(a);
    }

    if (this.hitstunT > 0) {
      body.velocity.scale(0.85); // skid through knockback
      this.applyAnim(false);
      return;
    }

    // start actions
    if (this.busyT <= 0) {
      if (input.healPressed && playerState.estus > 0 && this.hp < this.maxHp) {
        this.drinkEstus(body);
        return;
      }
      if (input.heavyPressed && this.stamina >= PLAYER.heavyCost) {
        this.beginAttack(true);
        return;
      }
      if (input.attackPressed && this.stamina >= PLAYER.attackCost) {
        this.beginAttack(false);
        return;
      }
      if (input.rollPressed && this.stamina >= PLAYER.rollCost) {
        this.beginRoll(input);
        return;
      }
    }

    // locomotion
    let mx = input.moveX;
    let my = input.moveY;
    const moving = mx !== 0 || my !== 0;
    if (moving) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      body.setVelocity(mx * PLAYER.walkSpeed, my * PLAYER.walkSpeed);
      if (!target) {
        this.faceX = mx;
        this.faceY = my;
      }
    } else {
      body.setVelocity(0, 0);
    }
    this.applyAnim(moving);
  }

  private beginRoll(input: InputState): void {
    this.stamina -= PLAYER.rollCost;
    this.regenDelayT = PLAYER.staminaRegenDelay;
    let dx = input.moveX;
    let dy = input.moveY;
    if (dx === 0 && dy === 0) {
      dx = this.faceX;
      dy = this.faceY;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.rollDirX = dx / len;
    this.rollDirY = dy / len;
    this.mode = "roll";
    this.rollElapsed = 0;
    this.setRotation(0);
    sfx.dodge();
  }

  private updateRoll(dt: number, body: Phaser.Physics.Arcade.Body): void {
    this.rollElapsed += dt;
    body.setVelocity(this.rollDirX * PLAYER.rollSpeed, this.rollDirY * PLAYER.rollSpeed);
    // spin the sprite through the dodge for readability
    const spin = (this.rollDirX >= 0 ? 1 : -1) * Math.PI * 2;
    this.setRotation((this.rollElapsed / PLAYER.rollDuration) * spin);
    if (this.rollElapsed >= PLAYER.rollDuration) {
      this.setRotation(0);
      this.mode = "free";
      this.busyT = PLAYER.rollRecovery;
      body.velocity.scale(0.4);
    }
  }

  private heavy = false;
  private busyLungeX = 0;
  private busyLungeY = 0;
  private beginAttack(heavy: boolean): void {
    this.heavy = heavy;
    this.stamina -= heavy ? PLAYER.heavyCost : PLAYER.attackCost;
    this.regenDelayT = PLAYER.staminaRegenDelay;
    this.mode = "attack";
    this.attackPhase = "windup";
    this.attackT = heavy ? PLAYER.heavyWindup : PLAYER.attackWindup;
    this.attackAngle = Math.atan2(this.faceY, this.faceX);
    this.hitThisSwing.clear();
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.applyAnim(false);
    sfx.swing();
    const lunge = heavy ? PLAYER.heavyLunge : 60;
    this.busyLungeX = Math.cos(this.attackAngle) * lunge;
    this.busyLungeY = Math.sin(this.attackAngle) * lunge;
  }

  private updateAttack(dt: number, body: Phaser.Physics.Arcade.Body): void {
    body.velocity.scale(0.7);
    this.attackT -= dt;
    if (this.attackT > 0) {
      if (this.attackPhase === "active") this.resolveSwing();
      return;
    }
    // advance phase
    if (this.attackPhase === "windup") {
      this.attackPhase = "active";
      this.attackT = this.heavy ? PLAYER.heavyActive : PLAYER.attackActive;
      this.world.spawnSlash(this.x, this.y, this.attackAngle, this.heavy ? 1.6 : 1);
      body.setVelocity(this.busyLungeX, this.busyLungeY);
      this.resolveSwing();
    } else if (this.attackPhase === "active") {
      this.attackPhase = "recovery";
      this.attackT = this.heavy ? PLAYER.heavyRecovery : PLAYER.attackRecovery;
    } else {
      this.mode = "free";
    }
  }

  private drinkEstus(body: Phaser.Physics.Arcade.Body): void {
    playerState.estus -= 1;
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.45));
    this.busyT = 0.55;
    body.setVelocity(0, 0);
    this.applyAnim(false);
    this.setTint(0x6fe08a);
    this.scene.time.delayedCall(450, () => this.active && this.clearTint());
    sfx.estus();
    this.world.spark(this.x, this.y - 8, 0x6fe08a);
  }

  /** Lava / hazards — bleeds through i-frames but on a throttle (scene-driven). */
  envDamage(amount: number): void {
    if (this.mode === "dead") return;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xd8702a);
    this.scene.time.delayedCall(60, () => this.active && this.clearTint());
    if (this.hp <= 0) this.die();
  }

  private resolveSwing(): void {
    const half = (this.heavy ? PLAYER.heavyArc : PLAYER.attackArc) / 2;
    const reach = this.heavy ? PLAYER.heavyReach : PLAYER.attackReach;
    const dmg = this.heavy ? PLAYER.heavyDamage : PLAYER.attackDamage;
    for (const enemy of this.world.meleeTargets()) {
      if (!enemy.active || this.hitThisSwing.has(enemy)) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + 10) continue;
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.attackAngle));
      if (da <= half) {
        this.hitThisSwing.add(enemy);
        enemy.takeDamage(dmg, this.x, this.y);
        this.world.hitStop(this.heavy ? 110 : 60);
        this.world.shake(this.heavy ? 0.008 : 0.004, this.heavy ? 130 : 80);
        this.world.spark(enemy.x, enemy.y, this.heavy ? 0xff9a5a : 0xffe0a0);
        this.world.popNumber(enemy.x, enemy.y, dmg, this.heavy ? 0xff9a5a : 0xffe6b0);
        sfx.hit();
      }
    }
  }

  takeDamage(amount: number, srcX: number, srcY: number): void {
    if (this.mode === "dead" || this.invulnerable) return;
    this.hp = Math.max(0, this.hp - amount);
    sfx.hurt();
    this.world.spark(this.x, this.y - 6, 0xc83838);
    this.invulnT = PLAYER.invulnAfterHit;
    this.hitstunT = 0.16;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    const a = Math.atan2(this.y - srcY, this.x - srcX);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(a) * PLAYER.knockback,
      Math.sin(a) * PLAYER.knockback,
    );
    this.world.shake(0.008, 140);
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.mode = "dead";
    this.setRotation(0);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.scene.tweens.add({ targets: this, alpha: 0.25, angle: 90, duration: 600 });
    sfx.playerDie();
    this.world.onPlayerDeath();
  }

  respawn(x: number, y: number): void {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.mode = "free";
    this.setPosition(x, y);
    this.setAlpha(1);
    this.setAngle(0);
    this.clearTint();
    this.invulnT = 0.5;
  }

  private applyAnim(moving: boolean): void {
    let dir: Dir;
    let flip = false;
    if (Math.abs(this.faceY) >= Math.abs(this.faceX)) {
      dir = this.faceY >= 0 ? "front" : "back";
    } else {
      dir = "side";
      flip = this.faceX < 0;
    }
    this.setFlipX(flip);
    if (dir === this.currentAnimDir && moving === this.currentMoving) return;
    this.currentAnimDir = dir;
    this.currentMoving = moving;
    if (moving) {
      this.play(`player-${dir}-walk`, true);
    } else {
      this.stop();
      this.setTexture(`player_${dir}_0`);
    }
  }

  private syncDecor(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setDepth(body.bottom);
    this.shadow.setPosition(this.x, body.bottom - 2).setDepth(body.bottom - 1);
  }

  private publish(): void {
    playerState.hp = this.hp;
    playerState.stamina = this.stamina;
    playerState.maxHp = this.maxHp;
    playerState.maxStamina = this.maxStamina;
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
