/**
 * Platformer Physics & Game Engine for VIRLA — Guardiões do Cuidado
 * Handles AABB collision, coyote time, input buffering, moving platforms,
 * contextual interactions, projectile neutralization, and camera rendering.
 */

import {
  LevelDefinition,
  ElderlyNPC,
  Enemy,
  Projectile,
  Particle,
  ShieldWave,
} from './types';
import { SpriteRenderer, COLORS } from './sprites';
import { sound } from './audio';

export interface GameCallbacks {
  onCollectHeart: (heartKey: string) => void;
  onActivateMechanism: (mechKey: string) => void;
  onRescueElderly: (elderlyKey: string, elderlyName: string) => void;
  onRecovery: () => void;
  onFinishPhase: () => void;
  onNotification?: (msg: string) => void;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public level: LevelDefinition;
  public callbacks: GameCallbacks;

  // Player state
  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public width: number = 24;
  public height: number = 34;
  public facing: 1 | -1 = 1;
  public skinIndex: number = 0;
  public onGround: boolean = false;
  public energy: number = 3;
  public maxEnergy: number = 3;
  public invulnerableTimer: number = 0;
  public frameCounter: number = 0;
  public animState: 'idle' | 'run' | 'jump' | 'help' | 'hurt' | 'cheer' = 'idle';

  // Jump feel
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;

  // Checkpoints
  public currentCheckpoint: { x: number; y: number };

  // Gameplay entities copied from level definition
  public elderly: ElderlyNPC[] = [];
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public shieldWaves: ShieldWave[] = [];

  // Contextual Interaction Prompt
  public contextualAction: {
    available: boolean;
    type: 'elderly' | 'mechanism' | 'shield';
    label: string;
    targetId?: string;
  } = { available: false, type: 'shield', label: 'Escudo do Cuidado' };

  // Camera & Screen Shake
  public cameraX: number = 0;
  public cameraY: number = 0;
  public shakeAmount: number = 0;

  // Inputs
  public keys: { [key: string]: boolean } = {};
  public isRunning: boolean = false;
  public hasFinishedPhase: boolean = false;
  private lastLockNotify: number = 0;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    level: LevelDefinition,
    skinIndex: number,
    callbacks: GameCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = JSON.parse(JSON.stringify(level)); // Deep clone
    this.skinIndex = skinIndex;
    this.callbacks = callbacks;

    this.x = this.level.spawnPoint.x;
    this.y = this.level.spawnPoint.y;
    this.currentCheckpoint = { ...this.level.spawnPoint };

    this.elderly = this.level.elderly;
    this.enemies = this.level.enemies;

    this.setupInputs();
  }

  public clearInputs() {
    this.keys = {};
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (this.hasFinishedPhase) return;
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
      this.keys[code] = true;

      if (code === 'KeyM') {
        sound.toggleMute();
      }

      if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW') && !e.repeat) {
        this.jumpBufferTimer = 6;
      }

      if ((code === 'KeyE' || code === 'KeyJ') && !e.repeat) {
        this.handleAction();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      // Variable jump height cut
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && this.vy < -3) {
        this.vy *= 0.5;
      }
    });

    window.addEventListener('blur', () => this.clearInputs());
    window.addEventListener('touchcancel', () => this.clearInputs());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearInputs();
    });
  }

  public setTouchInput(key: string, pressed: boolean) {
    this.keys[key] = pressed;
    if (pressed) {
      if (key === 'ArrowUp') {
        this.jumpBufferTimer = 6;
      }
      if (key === 'KeyE') {
        this.handleAction();
      }
    } else {
      if (key === 'ArrowUp' && this.vy < -3) {
        this.vy *= 0.5;
      }
    }
  }

  public handleAction() {
    if (this.contextualAction.available && this.contextualAction.type === 'elderly') {
      // Rescue elderly
      const eld = this.elderly.find((e) => e.id === this.contextualAction.targetId);
      if (eld && eld.state === 'waiting') {
        eld.state = 'escorted';
        this.animState = 'help';
        sound.playRescue();
        this.createHeartBurst(eld.x + eld.width / 2, eld.y - 10, 12);
        this.callbacks.onRescueElderly(eld.id, eld.name);
        if (this.callbacks.onNotification) {
          this.callbacks.onNotification(`♥ Você acolheu ${eld.name}!`);
        }
        return;
      }
    }

    if (this.contextualAction.available && this.contextualAction.type === 'mechanism') {
      // Activate mechanism
      const mech = this.level.mechanisms.find((m) => m.id === this.contextualAction.targetId);
      if (mech && !mech.activated) {
        mech.activated = true;
        this.animState = 'help';
        sound.playMechanism();
        this.createSparkleBurst(mech.x + mech.width / 2, mech.y + mech.height / 2, 14);
        this.callbacks.onActivateMechanism(mech.id);
        if (this.callbacks.onNotification) {
          this.callbacks.onNotification(`✨ ${mech.message}`);
        }
        return;
      }
    }

    // Default: Trigger Care Shield Wave
    this.triggerCareShield();
  }

  private triggerCareShield() {
    sound.playShield();
    this.shieldWaves.push({
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
      radius: 8,
      maxRadius: 75,
      life: 1,
      maxLife: 24,
    });
    this.createHeartBurst(this.x + this.width / 2, this.y + this.height / 2, 6);
  }

  public start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop(now: number) {
    if (!this.isRunning) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Clamp dt to prevent tunneling

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  private update(dt: number) {
    this.frameCounter += dt;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
    if (this.shakeAmount > 0) {
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 20);
    }

    // 1. HORIZONTAL MOVEMENT
    const moveLeft = this.keys['KeyA'] || this.keys['ArrowLeft'];
    const moveRight = this.keys['KeyD'] || this.keys['ArrowRight'];

    const targetVx = moveLeft ? -3.8 : moveRight ? 3.8 : 0;
    this.vx += (targetVx - this.vx) * 0.35;

    if (moveLeft) this.facing = -1;
    if (moveRight) this.facing = 1;

    // 2. GRAVITY & VERTICAL MOVEMENT
    this.vy += 0.55;
    if (this.vy > 12) this.vy = 12;

    // Coyote & Buffer timers
    if (this.onGround) {
      this.coyoteTimer = 6;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer--;
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer--;
      if (this.coyoteTimer > 0) {
        this.vy = -11.5;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        sound.playJump();
        this.createDust(this.x + this.width / 2, this.y + this.height);
      }
    }

    // 3. COLLISION WITH PLATFORMS (AABB)
    let nextX = this.x + this.vx;
    let nextY = this.y + this.vy;
    this.onGround = false;

    // Update moving platforms first
    for (const plat of this.level.platforms) {
      if (plat.type === 'moving' && plat.vx && plat.minX !== undefined && plat.maxX !== undefined) {
        plat.x += plat.vx;
        if (plat.x <= plat.minX || plat.x >= plat.maxX) {
          plat.vx *= -1;
        }
      }
    }

    // Horizontal Platform Check
    for (const plat of this.level.platforms) {
      if (
        nextX < plat.x + plat.width &&
        nextX + this.width > plat.x &&
        this.y < plat.y + plat.height &&
        this.y + this.height > plat.y
      ) {
        if (this.vx > 0) nextX = plat.x - this.width;
        else if (this.vx < 0) nextX = plat.x + plat.width;
        this.vx = 0;
      }
    }
    this.x = Math.max(0, Math.min(this.level.width - this.width, nextX));

    // Vertical Platform Check
    for (const plat of this.level.platforms) {
      if (
        this.x < plat.x + plat.width &&
        this.x + this.width > plat.x &&
        nextY < plat.y + plat.height &&
        nextY + this.height > plat.y
      ) {
        if (this.vy > 0) {
          // Landing on top
          nextY = plat.y - this.height;
          this.vy = 0;
          this.onGround = true;
          // Ride moving platform
          if (plat.type === 'moving' && plat.vx) {
            this.x += plat.vx;
          }
        } else if (this.vy < 0) {
          // Hitting ceiling
          nextY = plat.y + plat.height;
          this.vy = 0;
        }
      }
    }
    this.y = nextY;

    // 4. PIT / FALL HAZARD CHECK
    if (this.y > this.level.height + 40) {
      this.handlePlayerRecovery();
      return;
    }

    // Hazard Areas (Puddles)
    for (const haz of this.level.hazards) {
      if (
        this.x < haz.x + haz.width &&
        this.x + this.width > haz.x &&
        this.y < haz.y + haz.height &&
        this.y + this.height > haz.y
      ) {
        if (haz.type === 'puddle') {
          // Slippery reduction
          this.vx *= 0.8;
        }
      }
    }

    // 5. ANIMATION STATE
    if (this.invulnerableTimer > 0) {
      this.animState = 'hurt';
    } else if (!this.onGround) {
      this.animState = 'jump';
    } else if (Math.abs(this.vx) > 0.4) {
      this.animState = 'run';
    } else {
      this.animState = 'idle';
    }

    // 6. COLLECT HEARTS
    for (const heart of this.level.hearts) {
      if (!heart.collected) {
        if (
          this.x < heart.x + heart.width + 8 &&
          this.x + this.width > heart.x - 8 &&
          this.y < heart.y + heart.height + 8 &&
          this.y + this.height > heart.y - 8
        ) {
          heart.collected = true;
          sound.playHeart();
          this.createHeartBurst(heart.x + heart.width / 2, heart.y + heart.height / 2, 8);
          this.callbacks.onCollectHeart(heart.id);
        }
      }
    }

    // 7. CHECKPOINTS
    for (const cp of this.level.checkpoints) {
      if (!cp.activated) {
        if (
          this.x < cp.x + cp.width + 12 &&
          this.x + this.width > cp.x - 12 &&
          this.y < cp.y + cp.height + 12 &&
          this.y + this.height > cp.y - 12
        ) {
          cp.activated = true;
          this.currentCheckpoint = { x: cp.x, y: cp.y - 4 };
          sound.playCheckpoint();
          this.createSparkleBurst(cp.x + 12, cp.y + 12, 10);
          if (this.callbacks.onNotification) {
            this.callbacks.onNotification('🚩 Ponto de Apoio alcançado!');
          }
        }
      }
    }

    // 8. ESCORTED ELDERLY WALK LOGIC
    for (const eld of this.elderly) {
      if (eld.state === 'escorted') {
        eld.walkFrame += dt;
        const dx = eld.destinationX - eld.x;
        if (Math.abs(dx) > 4) {
          eld.facing = dx > 0 ? 1 : -1;
          eld.x += eld.facing * eld.walkSpeed;
        } else {
          eld.state = 'safe';
          sound.playVictory();
          this.createSparkleBurst(eld.x + eld.width / 2, eld.y - 10, 16);
          if (this.callbacks.onNotification) {
            this.callbacks.onNotification(`🏠 ${eld.name}: "${eld.thankQuote}"`);
          }
        }
      }
    }

    // 9. ENEMY LOGIC & PROJECTILES
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      // Patrol
      enemy.x += enemy.vx;
      if (enemy.x <= enemy.patrolLeft || enemy.x >= enemy.patrolRight) {
        enemy.vx *= -1;
      }

      // Boateiro shooting
      if (enemy.type === 'boateiro') {
        enemy.shootCooldown--;
        if (enemy.shootCooldown <= 0) {
          enemy.shootCooldown = 130 + Math.random() * 40;
          const dir = this.x > enemy.x ? 1 : -1;
          this.projectiles.push({
            id: 'proj_' + Math.random().toString(36).substring(2, 6),
            x: enemy.x + enemy.width / 2,
            y: enemy.y + 10,
            vx: dir * 1.8,
            vy: 0,
            radius: 8,
            text: 'Boato?',
            duration: 180,
          });
        }
      }

      // Player collision with enemy
      if (this.invulnerableTimer <= 0) {
        if (
          this.x < enemy.x + enemy.width &&
          this.x + this.width > enemy.x &&
          this.y < enemy.y + enemy.height &&
          this.y + this.height > enemy.y
        ) {
          this.takeDamage();
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.duration--;

      // Hit player
      if (
        this.invulnerableTimer <= 0 &&
        Math.hypot(p.x - (this.x + this.width / 2), p.y - (this.y + this.height / 2)) < p.radius + 12
      ) {
        this.takeDamage();
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.duration <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 10. UPDATE SHIELD WAVES & HIT ENEMY/PROJECTILE
    for (let i = this.shieldWaves.length - 1; i >= 0; i--) {
      const wave = this.shieldWaves[i];
      wave.radius += 3.2;
      wave.life++;

      // Neutralize projectiles
      for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
        const pr = this.projectiles[pi];
        if (Math.hypot(pr.x - wave.x, pr.y - wave.y) < wave.radius + pr.radius) {
          this.createSparkleBurst(pr.x, pr.y, 6);
          this.projectiles.splice(pi, 1);
        }
      }

      // Neutralize enemies in range
      for (const enemy of this.enemies) {
        if (enemy.alive) {
          const ex = enemy.x + enemy.width / 2;
          const ey = enemy.y + enemy.height / 2;
          if (Math.hypot(ex - wave.x, ey - wave.y) < wave.radius + 15) {
            enemy.alive = false;
            sound.playHeart();
            this.createHeartBurst(ex, ey, 14);
            if (this.callbacks.onNotification) {
              this.callbacks.onNotification(`💜 ${enemy.message}`);
            }
          }
        }
      }

      if (wave.life >= wave.maxLife || wave.radius >= wave.maxRadius) {
        this.shieldWaves.splice(i, 1);
      }
    }

    // 11. PARTICLES UPDATE
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life++;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 12. CONTEXTUAL ACTION CHECK
    this.checkContextualActions();

    // 13. CHECK PHASE COMPLETION & SHELTER BARRIER
    const safeCount = this.elderly.filter((e) => e.state === 'safe').length;
    const targetRescues = this.level.id === 'tutorial' ? 1 : 3;
    const isShelterUnlocked = safeCount >= targetRescues;

    if (this.x >= this.level.shelterPoint.x - 50) {
      if (isShelterUnlocked) {
        if (!this.hasFinishedPhase) {
          this.hasFinishedPhase = true;
          this.animState = 'cheer';
          sound.playVictory();
          this.createSparkleBurst(this.x + 12, this.y - 10, 25);
          this.callbacks.onFinishPhase();
        }
      } else {
        // Locked: gently repel player back and display floating notification
        this.x = this.level.shelterPoint.x - 55;
        this.vx = -1.5;
        const now = Date.now();
        if (now - this.lastLockNotify > 2500) {
          this.lastLockNotify = now;
          if (this.callbacks.onNotification) {
            this.callbacks.onNotification(
              `🔒 Ponto de Acolhimento bloqueado! Acolha todos os ${targetRescues} idosos primeiro (${safeCount}/${targetRescues})`
            );
          }
        }
      }
    }

    // 14. SMOOTH CAMERA UPDATE
    const targetCamX = this.x + this.width / 2 - this.canvas.width / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    const maxCamX = Math.max(0, this.level.width - this.canvas.width);
    this.cameraX = Math.max(0, Math.min(maxCamX, this.cameraX));
  }

  private checkContextualActions() {
    // Priority 1: Elderly waiting to be helped
    for (const eld of this.elderly) {
      if (eld.state === 'waiting') {
        const dist = Math.hypot(
          this.x + this.width / 2 - (eld.x + eld.width / 2),
          this.y + this.height / 2 - (eld.y + eld.height / 2)
        );
        if (dist < 65) {
          this.contextualAction = {
            available: true,
            type: 'elderly',
            label: `Ajudar ${eld.name}`,
            targetId: eld.id,
          };
          return;
        }
      }
    }

    // Priority 2: Inactive Mechanism
    for (const mech of this.level.mechanisms) {
      if (!mech.activated) {
        const dist = Math.hypot(
          this.x + this.width / 2 - (mech.x + mech.width / 2),
          this.y + this.height / 2 - (mech.y + mech.height / 2)
        );
        if (dist < 60) {
          this.contextualAction = {
            available: true,
            type: 'mechanism',
            label: `Ativar ${mech.label}`,
            targetId: mech.id,
          };
          return;
        }
      }
    }

    // Default: Escudo do Cuidado
    this.contextualAction = {
      available: false,
      type: 'shield',
      label: 'Escudo do Cuidado',
    };
  }

  private takeDamage() {
    this.energy--;
    this.invulnerableTimer = 1.2;
    this.shakeAmount = 8;
    this.vy = -6;
    this.vx = -this.facing * 4;
    sound.playHurt();

    if (this.energy <= 0) {
      this.handlePlayerRecovery();
    }
  }

  private handlePlayerRecovery() {
    this.energy = this.maxEnergy;
    this.x = this.currentCheckpoint.x;
    this.y = this.currentCheckpoint.y;
    this.vx = 0;
    this.vy = 0;
    this.invulnerableTimer = 1.5;
    this.shakeAmount = 10;
    sound.playHurt();
    this.callbacks.onRecovery();
    if (this.callbacks.onNotification) {
      this.callbacks.onNotification('🔄 Retomando no Ponto de Apoio!');
    }
  }

  // --- PARTICLE CREATION HELPERS ---

  private createDust(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1.5,
        life: 0,
        maxLife: 15,
        color: '#E5E7EB',
        size: 3,
      });
    }
  }

  private createHeartBurst(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 1.5 + Math.random() * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 26,
        color: COLORS.pink,
        size: 5,
        text: '♥',
      });
    }
  }

  private createSparkleBurst(x: number, y: number, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 22,
        color: COLORS.gold,
        size: 3.5,
        text: '✦',
      });
    }
  }

  // --- RENDER FUNCTION ---

  public render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Screen shake
    if (this.shakeAmount > 0) {
      const sx = (Math.random() - 0.5) * this.shakeAmount;
      const sy = (Math.random() - 0.5) * this.shakeAmount;
      ctx.translate(sx, sy);
    }

    // 1. Parallax Background
    SpriteRenderer.drawParallaxBackground(
      ctx,
      this.level.number,
      this.cameraX,
      canvas.width,
      canvas.height
    );

    // Apply Camera Translation for world objects
    ctx.save();
    ctx.translate(-Math.floor(this.cameraX), -Math.floor(this.cameraY));

    // 2. Recognized Exit & Shelter Destination
    const safeElderlyCount = this.elderly.filter((e) => e.state === 'safe').length;
    const requiredRescues = this.level.id === 'tutorial' ? 1 : 3;
    const isUnlocked = safeElderlyCount >= requiredRescues;

    SpriteRenderer.drawExitDestination(
      ctx,
      this.level.number,
      this.level.shelterPoint.x,
      this.level.shelterPoint.y,
      this.frameCounter,
      isUnlocked,
      safeElderlyCount,
      requiredRescues
    );

    // 3. Platforms
    for (const plat of this.level.platforms) {
      ctx.fillStyle = plat.type === 'moving' ? '#9333EA' : '#581C87';
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

      // Grass / Top trim
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(plat.x, plat.y, plat.width, 4);

      // Floor tiles detail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let px = plat.x; px < plat.x + plat.width; px += 32) {
        ctx.strokeRect(px, plat.y, 32, plat.height);
      }
    }

    // 4. Hazards (Puddles)
    for (const haz of this.level.hazards) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.beginPath();
      ctx.ellipse(haz.x + haz.width / 2, haz.y + 10, haz.width / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Mechanisms
    for (const mech of this.level.mechanisms) {
      SpriteRenderer.drawMechanism(ctx, mech, this.frameCounter);
    }

    // 6. Checkpoints
    for (const cp of this.level.checkpoints) {
      SpriteRenderer.drawCheckpoint(ctx, cp, this.frameCounter);
    }

    // 7. Connection Hearts
    for (const heart of this.level.hearts) {
      SpriteRenderer.drawHeart(ctx, heart, this.frameCounter);
    }

    // 8. Elderly NPCs
    for (const eld of this.elderly) {
      SpriteRenderer.drawElderly(ctx, eld, this.frameCounter);
    }

    // 9. Enemies
    for (const enemy of this.enemies) {
      SpriteRenderer.drawEnemy(ctx, enemy, this.frameCounter);
    }

    // 10. Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#881337';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y + 3);
    }

    // 11. Shield Waves
    for (const wave of this.shieldWaves) {
      const alpha = 1 - wave.life / wave.maxLife;
      ctx.strokeStyle = `rgba(254, 145, 254, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(254, 145, 254, ${alpha * 0.2})`;
      ctx.fill();
    }

    // 12. Player
    SpriteRenderer.drawPlayer(
      ctx,
      this.x,
      this.y,
      this.skinIndex,
      this.facing,
      this.animState,
      this.frameCounter,
      this.invulnerableTimer > 0
    );

    // 13. Particles
    for (const pt of this.particles) {
      const alpha = 1 - pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = alpha;
      if (pt.text) {
        ctx.font = `${pt.size * 2}px sans-serif`;
        ctx.fillText(pt.text, pt.x, pt.y);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // Undo camera translation
    ctx.restore(); // Undo screen shake
  }
}
