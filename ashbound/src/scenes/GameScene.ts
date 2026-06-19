import Phaser from "phaser";
import { ZOOM } from "../config";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { GameInput } from "../systems/input";
import { playerState, flash, zoneCard, PAUSE_OPTIONS, type MinimapData } from "../systems/state";
import { generateWorld, type WorldData, type Bonfire } from "../world/worldgen";
import type { TileIndex } from "../art/gen";
import { BIOMES, type Biome } from "../world/biomes";
import { initAudio, sfx } from "../systems/audio";

export interface Damageable {
  x: number;
  y: number;
  active: boolean;
  takeDamage(amount: number, srcX: number, srcY: number): void;
}

const SAVE_KEY = "ashbound.save.v1";
const BURN_INTERVAL = 0.5;
const BURN_DAMAGE = 9;

export class GameScene extends Phaser.Scene {
  player!: Player;
  lockTarget: Damageable | null = null;

  private input2!: GameInput;
  private world!: WorldData;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private enemies!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private boss!: Boss;
  private reticle!: Phaser.GameObjects.Arc;
  private ashEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodstain: Phaser.GameObjects.Image | null = null;
  private bloodPos: { x: number; y: number } | null = null;
  private hitStopT = 0;
  private respawnPending = false;
  private burnT = 0;
  private currentBiome = "";
  private checkpoint!: Bonfire;
  private nearBonfire: Bonfire | null = null;
  private bossArenaCenter = { x: 0, y: 0 };
  private tiles!: TileIndex;

  constructor() {
    super("Game");
  }

  create(): void {
    this.tiles = this.registry.get("tiles") as TileIndex;
    const tiles = this.tiles;
    this.world = generateWorld(tiles);
    const w = this.world;
    const px = w.cols * w.tileSize;
    const py = w.rows * w.tileSize;

    // Tilemap.
    const map = this.make.tilemap({ data: w.data, tileWidth: w.tileSize, tileHeight: w.tileSize });
    const ts = map.addTilesetImage("tileset", "tileset", w.tileSize, w.tileSize)!;
    this.layer = map.createLayer(0, ts, 0, 0)!.setDepth(-1000);
    this.layer.setCollision(w.collide);

    this.physics.world.setBounds(0, 0, px, py);
    this.obstacles = this.physics.add.staticGroup();
    this.buildProps();

    this.input2 = new GameInput(this);

    this.checkpoint = w.bonfires.find((b) => b.biomeId === "barrows")!;
    this.player = new Player(this, w.playerStart.x, w.playerStart.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.enemies = this.physics.add.group();
    this.spawnEnemies();

    // Boss + fog gate.
    this.bossArenaCenter = { x: w.boss.x, y: w.boss.y };
    this.boss = new Boss(this, w.boss.x, w.boss.y);
    (this.boss.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.buildBonfires();
    this.buildFogGate();

    // colliders
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.collider(this.boss, this.layer);
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies);
    this.physics.add.collider(this.player, this.boss);

    this.reticle = this.add
      .circle(0, 0, 10)
      .setStrokeStyle(1, 0xc6ccd6, 0.9)
      .setVisible(false)
      .setDepth(50000);

    // NB: colour-grade, vignette and minimap are screen-space and live in the
    // unzoomed UIScene — putting them here would be scaled by the camera zoom.

    // drifting ash that follows the camera
    this.ashEmitter = this.add.particles(0, 0, "fx_ash", {
      follow: this.player,
      followOffset: { x: 0, y: -130 },
      x: { min: -260, max: 260 },
      lifespan: 4200,
      speedY: { min: 8, max: 22 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.5, max: 1.2 },
      alpha: { start: 0.4, end: 0 },
      tint: 0x8a829a,
      frequency: 130,
      quantity: 1,
    });
    this.ashEmitter.setDepth(35000);

    initAudio();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, px, py);
    cam.setZoom(ZOOM);
    cam.setRoundPixels(true);
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.setBackgroundColor("#07060a");

    this.loadGame();
    this.applyBiome(this.world.biomeAt(this.player.x, this.player.y), true);
    this.buildMinimap();

    // reset transient run state on (re)entry
    playerState.paused = false;
    playerState.menuOpen = false;
    this.physics.world.resume();

    const w2 = window as unknown as { __ashbound?: { booted: boolean } };
    if (w2.__ashbound) w2.__ashbound.booted = true;
  }

  // ── minimap ──────────────────────────────────────────────────────────────
  // Bakes the 'minimap' texture (global) and publishes marker data; the HUD
  // scene draws it at native scale.
  private buildMinimap(): void {
    const w = this.world;
    const key = "minimap";
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, w.cols, w.rows);
    if (!tex) return;
    const ctx = tex.context;
    for (let ty = 0; ty < w.rows; ty++) {
      for (let tx = 0; tx < w.cols; tx++) {
        const b = BIOMES[w.biomeGrid[ty * w.cols + tx]];
        const bi = this.tiles.biome[b.id];
        const idx = w.data[ty][tx];
        let col: number;
        if (idx === this.tiles.abyss) col = 0x050409;
        else if (idx === bi.water) col = b.lava ? b.accent : mixInt(b.water, 0x4a7a96, 0.5);
        else if (idx === bi.cliff) col = shadeInt(b.cliff, 0.28);
        else col = shadeInt(mixInt(b.ground[0], b.accent, 0.6), 0.22);
        ctx.fillStyle = "#" + (col >>> 0).toString(16).padStart(6, "0").slice(-6);
        ctx.fillRect(tx, ty, 1, 1);
      }
    }
    tex.refresh();

    const wpx = w.cols * w.tileSize;
    const hpx = w.rows * w.tileSize;
    const data: MinimapData = {
      cols: w.cols,
      rows: w.rows,
      bonfires: w.bonfires.map((f) => ({ nx: f.x / wpx, ny: f.y / hpx })),
      boss: { nx: w.boss.x / wpx, ny: w.boss.y / hpx },
    };
    this.registry.set("mmData", data);
  }

  private togglePause(): void {
    playerState.paused = !playerState.paused;
    playerState.pauseIndex = 0;
    sfx.uiSelect();
    if (playerState.paused) this.physics.world.pause();
    else this.physics.world.resume();
  }
  private pauseConfirm(): void {
    if (playerState.pauseIndex === 0) {
      this.togglePause();
    } else {
      playerState.paused = false;
      this.physics.world.resume();
      this.scene.stop("UI");
      this.scene.start("Title");
    }
  }

  // ── world construction ──────────────────────────────────────────────────
  private buildProps(): void {
    for (const p of this.world.props) {
      let img: Phaser.GameObjects.Image;
      if (p.collide) {
        const s = this.obstacles.create(p.x, p.y, p.key) as Phaser.Physics.Arcade.Sprite;
        const body = s.body as Phaser.Physics.Arcade.StaticBody;
        const bw = p.body ? p.body[0] : 8;
        const bh = p.body ? p.body[1] : 5;
        body.setSize(bw, bh);
        body.setOffset((s.width - bw) / 2, s.height - bh);
        body.updateFromGameObject();
        img = s;
      } else {
        img = this.add.image(p.x, p.y, p.key);
      }
      img.setOrigin(0.5, 1).setDepth(p.y);
      if (p.tint !== undefined) img.setTint(p.tint);
      if (p.glow) {
        this.add
          .image(p.x, p.y - img.height * 0.5, "fx_light")
          .setTint(p.tint ?? 0xffcf8a)
          .setScale(0.6)
          .setAlpha(0.5)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(p.y - 1);
      }
    }
  }

  private buildBonfires(): void {
    for (const b of this.world.bonfires) {
      this.add.sprite(b.x, b.y, "ember_0").setDepth(b.y).play("ember-flicker");
      this.add
        .image(b.x, b.y - 6, "fx_light")
        .setTint(0xffb050)
        .setScale(1.3)
        .setAlpha(0.55)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(b.y - 1);
      this.add
        .particles(b.x, b.y - 4, "fx_spark", {
          speedY: { min: -34, max: -14 },
          speedX: { min: -6, max: 6 },
          lifespan: 1200,
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: [0xf2c14e, 0xd8702a],
          frequency: 180,
          quantity: 1,
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(b.y + 2);
    }
  }

  // ── juice helpers used by entities ────────────────────────────────────────
  spark(x: number, y: number, color: number): void {
    const e = this.add.particles(x, y, "fx_spark", {
      speed: { min: 40, max: 150 },
      lifespan: 280,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    e.setDepth(60000);
    e.explode(9);
    this.time.delayedCall(320, () => e.destroy());
  }

  deathAsh(x: number, y: number, tint: number): void {
    const e = this.add.particles(x, y, "fx_ash", {
      speed: { min: 20, max: 90 },
      gravityY: 40,
      lifespan: 700,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [tint, 0x2a2730],
      emitting: false,
    });
    e.setDepth(59000);
    e.explode(20);
    this.time.delayedCall(760, () => e.destroy());
  }

  popNumber(x: number, y: number, amount: number, color: number): void {
    const txt = this.add
      .text(x + (Math.random() - 0.5) * 8, y - 14, `${Math.round(amount)}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#" + color.toString(16).padStart(6, "0"),
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(61000);
    this.tweens.add({
      targets: txt,
      y: y - 34,
      alpha: 0,
      duration: 620,
      onComplete: () => txt.destroy(),
    });
  }

  private fogGate!: Phaser.GameObjects.Image;
  private buildFogGate(): void {
    const g = this.world.boss;
    this.fogGate = this.add
      .image(g.gateX, g.gateY, "fx_foggate")
      .setDepth(g.gateY + 100)
      .setAlpha(0.85);
  }

  private spawnEnemies(): void {
    for (const e of this.world.enemies) {
      const en = new Enemy(this, e.x, e.y, e.archetype);
      (en.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.enemies.add(en);
    }
    playerState.enemiesLeft = this.enemies.countActive(true);
  }

  // ── world API for entities ──────────────────────────────────────────────
  meleeTargets(): Damageable[] {
    const list: Damageable[] = this.enemies.getChildren() as unknown as Damageable[];
    if (this.boss.active) return [...list, this.boss];
    return list;
  }

  toggleLock(): void {
    if (this.lockTarget && this.lockTarget.active) {
      this.lockTarget = null;
      return;
    }
    let best: Damageable | null = null;
    let bestD = 340;
    for (const e of this.meleeTargets()) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    this.lockTarget = best;
  }

  spawnSlash(x: number, y: number, angle: number, scale = 1): void {
    const off = 14;
    const s = this.add.image(x + Math.cos(angle) * off, y + Math.sin(angle) * off, "slash");
    s.setRotation(angle).setScale(0.7 * scale).setAlpha(0.95);
    if (scale > 1.2) s.setTint(0xff9a5a);
    s.setDepth((this.player.body as Phaser.Physics.Arcade.Body).bottom + 1);
    this.tweens.add({ targets: s, scale: 1.15 * scale, alpha: 0, duration: 160, onComplete: () => s.destroy() });
  }

  hitStop(ms: number): void {
    this.hitStopT = Math.max(this.hitStopT, ms);
  }
  shake(intensity: number, duration: number): void {
    this.cameras.main.shake(duration, intensity);
  }
  banner(text: string): void {
    flash(this.time.now, text, 2400);
  }

  onEnemyDown(runes: number, x: number, y: number): void {
    playerState.runes += runes;
    sfx.enemyDie();
    sfx.rune();
    this.deathAsh(x, y, 0x6b6478);
    if (this.lockTarget && !this.lockTarget.active) this.lockTarget = null;
    playerState.enemiesLeft = this.enemies.countActive(true);
  }

  onBossDown(runes: number): void {
    playerState.runes += runes;
    playerState.bossFrac = -1;
    sfx.bossDie();
    sfx.setBoss(false);
    this.deathAsh(this.boss.x, this.boss.y, 0xd8702a);
    this.fogGate?.destroy();
    flash(this.time.now, "THE CINDER LORD FALLS", 4200);
    this.time.delayedCall(2400, () => zoneCard(this.time.now, "The flame is yours", "Ashbound — demo complete", 6000));
    this.saveGame();
  }

  onPlayerDeath(): void {
    if (this.respawnPending) return;
    this.respawnPending = true;
    playerState.dead = true;
    // drop runes as a recoverable bloodstain
    this.dropBloodstain();
    flash(this.time.now, "YOU DIED", 2600);
    this.cameras.main.fade(1400, 8, 4, 10, false);
    this.time.delayedCall(1800, () => this.doRespawn());
  }

  private dropBloodstain(): void {
    this.bloodstain?.destroy();
    playerState.lostRunes = playerState.runes;
    playerState.runes = 0;
    if (playerState.lostRunes <= 0) {
      this.bloodstain = null;
      this.bloodPos = null;
      return;
    }
    this.bloodPos = { x: this.player.x, y: this.player.y };
    this.bloodstain = this.add
      .image(this.bloodPos.x, this.bloodPos.y, "fx_light")
      .setTint(0xe0157a)
      .setScale(0.7)
      .setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.bloodPos.y);
  }

  private doRespawn(): void {
    this.enemies.clear(true, true);
    this.spawnEnemies();
    this.lockTarget = null;
    this.player.respawn(this.checkpoint.x, this.checkpoint.y);
    playerState.dead = false;
    this.respawnPending = false;
    this.cameras.main.fadeFrom(700, 8, 4, 10);
    this.applyBiome(this.world.biomeAt(this.player.x, this.player.y), true);
  }

  // ── bonfire menu ──────────────────────────────────────────────────────────
  private openRest(b: Bonfire): void {
    sfx.rest();
    this.checkpoint = b;
    this.player.respawn(b.x, b.y);
    playerState.estus = playerState.estusMax;
    this.enemies.clear(true, true);
    this.spawnEnemies();
    this.lockTarget = null;
    playerState.menuOpen = true;
    playerState.menuIndex = 0;
    this.buildMenu();
    this.saveGame();
    flash(this.time.now, "", 0);
  }

  private levelCost(): number {
    return 80 + (playerState.level - 1) * 60;
  }
  private buildMenu(): void {
    playerState.menuOptions = [
      "Rest (restore)",
      `Reinforce — ${this.levelCost()} runes  (Lv ${playerState.level})`,
      "Leave",
    ];
  }
  private menuConfirm(): void {
    const i = playerState.menuIndex;
    if (i === 0) {
      this.player.respawn(this.checkpoint.x, this.checkpoint.y);
      playerState.estus = playerState.estusMax;
    } else if (i === 1) {
      const cost = this.levelCost();
      if (playerState.runes >= cost) {
        playerState.runes -= cost;
        playerState.level += 1;
        this.player.maxHp += 20;
        this.player.maxStamina += 6;
        this.player.respawn(this.checkpoint.x, this.checkpoint.y);
        this.buildMenu();
        this.saveGame();
      } else {
        flash(this.time.now, "Not enough runes", 1200);
      }
    } else {
      playerState.menuOpen = false;
    }
  }

  // ── biome grade ─────────────────────────────────────────────────────────
  private applyBiome(b: Biome, _instant: boolean): void {
    playerState.zone = b.name;
    playerState.ambientColor = b.ambient;
    playerState.ambientAlpha = b.ambientAlpha;
  }

  // ── save / load ─────────────────────────────────────────────────────────
  private saveGame(): void {
    try {
      const data = {
        runes: playerState.runes,
        level: playerState.level,
        maxHp: this.player.maxHp,
        maxStamina: this.player.maxStamina,
        estusMax: playerState.estusMax,
        checkpoint: this.checkpoint.biomeId,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }
  private loadGame(): void {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      playerState.runes = d.runes ?? 0;
      playerState.level = d.level ?? 1;
      this.player.maxHp = d.maxHp ?? this.player.maxHp;
      this.player.maxStamina = d.maxStamina ?? this.player.maxStamina;
      playerState.estusMax = d.estusMax ?? playerState.estusMax;
      playerState.estus = playerState.estusMax;
      this.player.hp = this.player.maxHp;
      this.player.stamina = this.player.maxStamina;
      const cp = this.world.bonfires.find((b) => b.biomeId === d.checkpoint);
      if (cp) {
        this.checkpoint = cp;
        this.player.setPosition(cp.x, cp.y);
      }
    } catch {
      /* corrupt save — ignore */
    }
  }

  // ── main loop ─────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    const input = this.input2.sample();

    // pause (works even mid hit-stop)
    if (input.pausePressed && !playerState.menuOpen) this.togglePause();
    if (playerState.paused) {
      const n = PAUSE_OPTIONS.length;
      if (input.upPressed) {
        playerState.pauseIndex = (playerState.pauseIndex + n - 1) % n;
        sfx.uiMove();
      }
      if (input.downPressed) {
        playerState.pauseIndex = (playerState.pauseIndex + 1) % n;
        sfx.uiMove();
      }
      if (input.interactPressed) {
        sfx.uiSelect();
        this.pauseConfirm();
      }
      return;
    }

    if (this.hitStopT > 0) {
      this.hitStopT -= delta;
      return;
    }
    const dt = Math.min(delta / 1000, 0.05);

    if (playerState.menuOpen) {
      if (input.upPressed) {
        playerState.menuIndex = (playerState.menuIndex + 2) % 3;
        sfx.uiMove();
      }
      if (input.downPressed) {
        playerState.menuIndex = (playerState.menuIndex + 1) % 3;
        sfx.uiMove();
      }
      if (input.interactPressed) {
        sfx.uiSelect();
        this.menuConfirm();
      }
      return;
    }

    if (!this.respawnPending) this.player.update(dt, input);

    // cull updates to the player's neighbourhood
    const pr = 460;
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy;
      if (e.active && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < pr) {
        e.update(dt, this.player);
      }
    }
    this.boss.update(dt, this.player);

    // fog gate -> activate boss when the player crosses into the arena
    if (this.fogGate && this.fogGate.active) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bossArenaCenter.x, this.bossArenaCenter.y) < 120) {
        this.boss.activate();
        sfx.setBoss(true);
        zoneCard(this.time.now, "The Cinder Lord", "guardian of the last flame", 3000);
        this.tweens.add({ targets: this.fogGate, alpha: 0, duration: 600, onComplete: () => this.fogGate.destroy() });
      }
    }

    // lock target reticle
    if (this.lockTarget && !this.lockTarget.active) this.lockTarget = null;
    playerState.lockedOn = !!this.lockTarget;
    if (this.lockTarget) {
      this.reticle.setVisible(true).setPosition(this.lockTarget.x, this.lockTarget.y - 10);
    } else this.reticle.setVisible(false);

    playerState.mmX = this.player.x / (this.world.cols * this.world.tileSize);
    playerState.mmY = this.player.y / (this.world.rows * this.world.tileSize);

    // zone transitions
    const biome = this.world.biomeAt(this.player.x, this.player.y);
    if (biome.id !== this.currentBiome) {
      this.currentBiome = biome.id;
      this.applyBiome(biome, false);
      zoneCard(this.time.now, biome.name, biome.subtitle);
    }

    // lava / hazard tiles
    this.burnT -= dt;
    const tile = this.layer.getTileAtWorldXY(this.player.x, this.player.y);
    if (tile && this.world.damaging.includes(tile.index) && this.burnT <= 0) {
      this.burnT = BURN_INTERVAL;
      this.player.envDamage(BURN_DAMAGE);
    }

    // bloodstain recovery
    if (this.bloodPos && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.bloodPos.x, this.bloodPos.y) < 18) {
      playerState.runes += playerState.lostRunes;
      playerState.lostRunes = 0;
      this.bloodstain?.destroy();
      this.bloodstain = null;
      this.bloodPos = null;
      sfx.rune();
      flash(this.time.now, "Runes reclaimed", 1500);
    }

    // bonfire prompt + rest
    this.nearBonfire = null;
    for (const b of this.world.bonfires) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y) < 30) {
        this.nearBonfire = b;
        break;
      }
    }
    playerState.prompt = this.nearBonfire ? "[E] tend the ember" : "";
    if (this.nearBonfire && input.interactPressed) this.openRest(this.nearBonfire);
  }
}

function mixInt(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return ((Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t));
}
function shadeInt(c: number, amt: number): number {
  return mixInt(c, amt < 0 ? 0x000000 : 0xffffff, Math.abs(amt));
}
