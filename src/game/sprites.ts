/**
 * High-Fidelity Canvas 2D Pixel Art & Vector Renderer for VIRLA — Guardiões do Cuidado
 * Features bespoke character animations, NPC details, expressive enemies,
 * interactive mechanisms, phase-specific shelter destinations, and parallax layers
 * in the official VIRLA palette.
 */

import { ElderlyNPC, Enemy, Mechanism, HeartItem, CheckpointFlag } from './types';

export const COLORS = {
  purple: '#83078E',
  purpleDark: '#6B0075',
  purpleDeep: '#4A0052',
  pink: '#FE91FE',
  pinkLight: '#FFD1FF',
  white: '#FFFFFF',
  gold: '#FACC15',
  charcoal: '#1E1B2E',
  greenGarden: '#10B981',
  blueSky: '#38BDF8',
};

export class SpriteRenderer {
  // Draw Caregiver Player with rich animation frames
  static drawPlayer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    skinIndex: number,
    facing: 1 | -1,
    state: 'idle' | 'run' | 'jump' | 'help' | 'hurt' | 'cheer',
    frame: number,
    invulnerable: boolean
  ) {
    if (invulnerable && Math.floor(frame * 12) % 2 === 0) {
      return; // Flash effect during invulnerability
    }

    ctx.save();
    ctx.translate(Math.round(x + 16), Math.round(y + 20));
    ctx.scale(facing, 1);

    // Animation physics parameters
    const runCycle = frame * 14;
    const isRunning = state === 'run';
    const isJumping = state === 'jump';
    const isCheering = state === 'cheer';
    const isHelping = state === 'help';
    const isHurt = state === 'hurt';

    const bob = isRunning ? Math.sin(runCycle) * 2.5 : Math.sin(frame * 3) * 0.8;
    const legAngle = isRunning ? Math.sin(runCycle) * 0.55 : 0;
    const armAngle = isRunning ? -Math.sin(runCycle) * 0.6 : 0;

    // 1. Support Backpack (Back layer)
    ctx.fillStyle = COLORS.purpleDark;
    ctx.beginPath();
    ctx.roundRect(-15, -9 + bob, 7, 14, 3);
    ctx.fill();

    // Backpack Pink Accent & Zipper
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(-15, -4 + bob, 7, 2.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-11, -7 + bob, 2, 2); // First aid cross badge
    ctx.fillRect(-12, -6 + bob, 4, 1);

    // 2. Legs & Sneakers
    ctx.fillStyle = '#374151'; // Dark pants
    if (isJumping) {
      // Tucked jump posture
      ctx.fillRect(-7, 6, 5, 8);
      ctx.fillRect(1, 5, 5, 8);
      // Pink sneakers tucked
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(-7, 12, 7, 3);
      ctx.fillRect(1, 11, 7, 3);
    } else {
      // Left leg
      ctx.save();
      ctx.translate(-4, 7);
      ctx.rotate(legAngle);
      ctx.fillRect(-2.5, 0, 5, 11);
      // Pink sneaker with white sole
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(-2.5, 9, 8, 3.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2.5, 12, 8, 1.5);
      ctx.restore();

      // Right leg
      ctx.save();
      ctx.translate(4, 7);
      ctx.rotate(-legAngle);
      ctx.fillStyle = '#374151';
      ctx.fillRect(-2.5, 0, 5, 11);
      // Pink sneaker with white sole
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(-2.5, 9, 8, 3.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2.5, 12, 8, 1.5);
      ctx.restore();
    }

    // 3. Torso - Official VIRLA Purple Vest
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath();
    ctx.roundRect(-9, -9 + bob, 18, 18, 4);
    ctx.fill();

    // Vest Zipper / Pink Borders
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(-1.5, -9 + bob, 3, 18);
    ctx.fillRect(-9, 7 + bob, 18, 2.5);

    // Official Heart Badge on Chest (VIRLA Symbol)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-4.5, -2 + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.pink;
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('♥', -7, 1 + bob);

    // 4. Head & Face
    const skinTone = skinIndex === 1 ? '#D97706' : skinIndex === 2 ? '#854D0E' : '#FBBF24';
    ctx.fillStyle = skinTone;
    ctx.beginPath();
    ctx.arc(0, -15 + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Eyes with lively expression
    if (isHurt) {
      // Worried >< eyes
      ctx.strokeStyle = COLORS.charcoal;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(1, -17 + bob);
      ctx.lineTo(4, -14 + bob);
      ctx.moveTo(4, -17 + bob);
      ctx.lineTo(1, -14 + bob);
      ctx.stroke();
    } else {
      // Bright eyes with white pupil highlight
      ctx.fillStyle = COLORS.charcoal;
      ctx.fillRect(2, -17 + bob, 2.5, 3.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(2, -17 + bob, 1, 1.5);
    }

    // Cheerful blush
    ctx.fillStyle = 'rgba(254, 145, 254, 0.7)';
    ctx.fillRect(1, -13 + bob, 3.5, 2);

    // Friendly smile
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(2, -13 + bob, 2.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // 5. Hair & Headwear per skin
    if (skinIndex === 0) {
      // Clara: Brown Ponytail + Violet Hairband
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(-1, -17 + bob, 8.5, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      // Side bangs
      ctx.fillRect(-5, -18 + bob, 4, 8);
      // Animated bouncy ponytail
      const tailSway = isRunning ? Math.sin(runCycle) * 3 : Math.sin(frame * 4) * 1.5;
      ctx.beginPath();
      ctx.roundRect(-12 + tailSway * 0.3, -20 + bob, 6, 12, 3);
      ctx.fill();
      // Pink ribbon
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(-9, -19 + bob, 4, 3.5);
    } else if (skinIndex === 1) {
      // Lucas: Stylish Purple/Pink Cap with Visor
      ctx.fillStyle = COLORS.purpleDark;
      ctx.beginPath();
      ctx.arc(0, -18 + bob, 8.5, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      // Cap visor
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(-2, -19 + bob, 11, 3.5);
      // Short hair strands
      ctx.fillStyle = '#451A03';
      ctx.fillRect(-7, -14 + bob, 4, 4);
    } else {
      // Mariana: Voluminous dark curly hair with pink flower clip
      ctx.fillStyle = '#1C1917';
      ctx.beginPath();
      ctx.arc(0, -17 + bob, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-7, -14 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      // Pink blossom clip
      ctx.fillStyle = COLORS.pink;
      ctx.beginPath();
      ctx.arc(4, -20 + bob, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(3.5, -20.5 + bob, 1.5, 1.5);
    }

    // 6. Arms & Interaction States
    ctx.fillStyle = COLORS.purple;
    if (isHelping || isCheering) {
      // Raised hands with caring glowing aura
      ctx.fillRect(4, -13 + bob, 11, 4.5);
      ctx.fillStyle = skinTone;
      ctx.fillRect(13, -14 + bob, 4.5, 5.5); // Open palm
      // Glowing connection sparkles
      ctx.fillStyle = COLORS.pink;
      ctx.font = '8px sans-serif';
      ctx.fillText('✦', 16, -17 + bob);
    } else {
      ctx.save();
      ctx.translate(0, -4 + bob);
      ctx.rotate(armAngle);
      ctx.fillRect(-2.5, 0, 5, 11);
      ctx.fillStyle = skinTone;
      ctx.fillRect(-2.5, 9, 5, 3.5);
      ctx.restore();
    }

    ctx.restore();
  }

  // Draw Elderly Characters (Sr. Jorge, Dona Lúcia, Dona Celina)
  static drawElderly(ctx: CanvasRenderingContext2D, elderly: ElderlyNPC, frame: number) {
    ctx.save();
    ctx.translate(Math.round(elderly.x + elderly.width / 2), Math.round(elderly.y + elderly.height / 2));
    ctx.scale(elderly.facing, 1);

    const isWalking = elderly.state === 'escorted';
    const bob = isWalking ? Math.sin(frame * 9) * 2 : Math.sin(frame * 2.5) * 1;
    const legSwing = isWalking ? Math.sin(frame * 9) * 0.35 : 0;

    // Body & Clothing
    if (elderly.type === 'jorge') {
      // Sr. Jorge: Gardener Apron, Corduroy Pants & Spectacles
      ctx.fillStyle = '#4B5563';
      ctx.fillRect(-6, 6, 4.5, 11 + legSwing * 2);
      ctx.fillRect(1.5, 6, 4.5, 11 - legSwing * 2);

      // Green Gardener's Cardigan
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.roundRect(-9, -8 + bob, 18, 17, 3);
      ctx.fill();

      // White collar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2.5, -8 + bob, 5, 3.5);

      // Head with textured silver hair
      ctx.fillStyle = '#FED7AA';
      ctx.beginPath();
      ctx.arc(0, -15 + bob, 7.5, 0, Math.PI * 2);
      ctx.fill();
      // Silver hair
      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.arc(0, -18 + bob, 8, Math.PI, Math.PI * 2);
      ctx.fill();
      // Glasses & gentle smile
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(1.5, -16 + bob, 4.5, 3.5);
      ctx.beginPath();
      ctx.moveTo(1.5, -15 + bob);
      ctx.lineTo(-2, -15 + bob);
      ctx.stroke();

      // Trowel or flower pot if safe
      if (elderly.state === 'safe') {
        ctx.fillStyle = '#10B981';
        ctx.font = '14px sans-serif';
        ctx.fillText('🪴', 8, -4 + bob);
      }
    } else if (elderly.type === 'lucia') {
      // Dona Lúcia: Lavender Patterned Cardigan & Pearl Necklace
      ctx.fillStyle = '#6D28D9';
      ctx.fillRect(-6, 6, 12, 11); // Skirt

      // Lilac Cardigan
      ctx.fillStyle = '#C084FC';
      ctx.beginPath();
      ctx.roundRect(-9, -8 + bob, 18, 16, 4);
      ctx.fill();

      // Pearl necklace
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -3 + bob, 3.5, 0, Math.PI);
      ctx.stroke();

      // Silver wavy hair
      ctx.fillStyle = '#9CA3AF';
      ctx.beginPath();
      ctx.arc(0, -17 + bob, 8.5, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.fillStyle = '#FFEDD5';
      ctx.beginPath();
      ctx.arc(0, -14 + bob, 6.5, 0, Math.PI * 2);
      ctx.fill();

      if (elderly.state === 'safe' || elderly.state === 'escorted') {
        ctx.fillStyle = COLORS.pink;
        ctx.font = '13px sans-serif';
        ctx.fillText('🎵', 8, -13 + bob);
      }
    } else {
      // Dona Celina: Warm Shawl with Fringe & Walking Cane
      ctx.fillStyle = '#BE185D';
      ctx.fillRect(-6.5, 6, 13, 11);

      // Warm Cozy Shawl
      ctx.fillStyle = COLORS.pink;
      ctx.beginPath();
      ctx.moveTo(-11, -7 + bob);
      ctx.lineTo(11, -7 + bob);
      ctx.lineTo(0, 7 + bob);
      ctx.closePath();
      ctx.fill();

      // White bun hair
      ctx.fillStyle = '#F3F4F6';
      ctx.beginPath();
      ctx.arc(0, -15 + bob, 7, 0, Math.PI * 2);
      ctx.arc(-4, -19 + bob, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.fillStyle = '#FCE7F3';
      ctx.beginPath();
      ctx.arc(0, -14 + bob, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Walking cane
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(8, -4 + bob);
      ctx.lineTo(8, 16);
      ctx.stroke();
    }

    ctx.restore();

    // Floating Interaction Prompt
    if (elderly.state === 'waiting') {
      ctx.save();
      ctx.fillStyle = 'rgba(254, 145, 254, 0.95)';
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 1.5;
      const bubbleW = 84;
      const bubbleH = 24;
      const bx = elderly.x + elderly.width / 2 - bubbleW / 2;
      const by = elderly.y - 32 + Math.sin(frame * 4) * 2.5;

      ctx.beginPath();
      ctx.roundRect(bx, by, bubbleW, bubbleH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.purpleDark;
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`♥ Ajudar ${elderly.name}`, bx + bubbleW / 2, by + 16);
      ctx.restore();
    } else if (elderly.state === 'escorted') {
      ctx.save();
      ctx.fillStyle = COLORS.pink;
      ctx.font = '14px sans-serif';
      ctx.fillText('💜', elderly.x + 8, elderly.y - 14);
      ctx.restore();
    } else if (elderly.state === 'safe') {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
      ctx.beginPath();
      const bx = elderly.x - 20;
      const by = elderly.y - 32;
      ctx.roundRect(bx, by, 84, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Acolhido(a) ✨', bx + 42, by + 15);
      ctx.restore();
    }
  }

  // Draw Symbolic Enemies with attack telegraphs
  static drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, frame: number) {
    if (!enemy.alive) return;

    ctx.save();
    ctx.translate(Math.round(enemy.x + enemy.width / 2), Math.round(enemy.y + enemy.height / 2));

    if (enemy.type === 'baguncudo') {
      // Bagunçudo (Desorganização): flying memos & spinning clock
      const wobble = Math.sin(frame * 7) * 3;
      ctx.rotate(wobble * 0.06);

      // Shuffling paper sheets
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(-13, -11, 20, 15);
      ctx.fillStyle = '#D1D5DB';
      ctx.fillRect(-9, -15, 18, 17);
      ctx.fillStyle = '#F3F4F6';
      ctx.fillRect(-11, -9, 22, 17);

      // Scrambled Clock in center
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Spinning clock hands
      const handAngle = frame * 12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(handAngle) * 6, Math.sin(handAngle) * 6);
      ctx.stroke();

      // Mischievous eyes
      ctx.fillStyle = COLORS.purpleDark;
      ctx.fillRect(-4, -4, 2.5, 2.5);
      ctx.fillRect(2, -4, 2.5, 2.5);

      // Label indicator
      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏰ Desorganização', 0, -18);
    } else if (enemy.type === 'boateiro') {
      // Boateiro (Desinformação): speech bubble creature with attack telegraph windup!
      const hover = Math.sin(frame * 6) * 3.5;
      ctx.translate(0, hover);

      // Attack telegraph: swells up and flashes when shootCooldown is low
      const isTelegraphing = enemy.shootCooldown < 30;
      const telegraphScale = isTelegraphing ? 1 + Math.sin(frame * 25) * 0.15 : 1;
      ctx.scale(telegraphScale, telegraphScale);

      // Telegraph warning glow
      if (isTelegraphing) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Speech bubble body
      ctx.fillStyle = isTelegraphing ? '#FB7185' : '#FDA4AF';
      ctx.beginPath();
      ctx.roundRect(-15, -13, 30, 22, 7);
      ctx.fill();
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.lineTo(-4, 15);
      ctx.lineTo(4, 9);
      ctx.fill();

      // Question marks
      ctx.fillStyle = '#881337';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isTelegraphing ? '⚠️' : '?!', 0, 3);

      // Label indicator
      ctx.fillStyle = '#FDA4AF';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.fillText('💬 Desinformação', 0, -20);
    } else {
      // Sombra do Isolamento: Whimsical dark violet cloud with expressive eyes
      const floatY = Math.sin(frame * 3.5) * 4;
      ctx.translate(0, floatY);

      // Cloud puffs
      ctx.fillStyle = 'rgba(107, 0, 117, 0.88)';
      ctx.beginPath();
      ctx.arc(-11, 0, 17, 0, Math.PI * 2);
      ctx.arc(11, 0, 17, 0, Math.PI * 2);
      ctx.arc(0, -9, 19, 0, Math.PI * 2);
      ctx.fill();

      // Inner soft aura
      ctx.fillStyle = 'rgba(254, 145, 254, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      // Expressive wistful eyes
      ctx.fillStyle = COLORS.pinkLight;
      ctx.beginPath();
      ctx.arc(-6, -3, 3.8, 0, Math.PI * 2);
      ctx.arc(6, -3, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.charcoal;
      ctx.fillRect(-5, -3, 2.5, 2.5);
      ctx.fillRect(5, -3, 2.5, 2.5);

      // Label
      ctx.fillStyle = COLORS.pink;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌫️ Sombra do Isolamento', 0, -24);
    }

    ctx.restore();
  }

  // Draw Connection Heart item
  static drawHeart(ctx: CanvasRenderingContext2D, heart: HeartItem, frame: number) {
    if (heart.collected) return;
    const hover = Math.sin(frame * 6 + heart.x) * 3.5;
    const scale = 1 + Math.sin(frame * 8) * 0.12;

    ctx.save();
    ctx.translate(heart.x + heart.width / 2, heart.y + heart.height / 2 + hover);
    ctx.scale(scale, scale);

    // Glowing halo
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 15);
    glow.addColorStop(0, 'rgba(254, 145, 254, 0.75)');
    glow.addColorStop(1, 'rgba(254, 145, 254, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    // Heart Shape
    ctx.fillStyle = COLORS.pink;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-6, -3, -9, -9, -3, -9);
    ctx.bezierCurveTo(0, -9, 0, -5, 0, -3);
    ctx.bezierCurveTo(0, -5, 0, -9, 3, -9);
    ctx.bezierCurveTo(9, -9, 6, -3, 0, 4);
    ctx.fill();

    // White shine highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2, -7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Mechanism Station (Binder, Antenna, Lantern)
  static drawMechanism(ctx: CanvasRenderingContext2D, mech: Mechanism, frame: number) {
    ctx.save();
    ctx.translate(mech.x + mech.width / 2, mech.y + mech.height / 2);

    if (mech.type === 'binder') {
      ctx.fillStyle = mech.activated ? '#10B981' : COLORS.purple;
      ctx.beginPath();
      ctx.roundRect(-13, -17, 26, 34, 4);
      ctx.fill();

      // Paper sheet
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-10, -14, 20, 28);

      // Checkmarks
      ctx.fillStyle = mech.activated ? '#10B981' : '#9CA3AF';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(mech.activated ? '✔ Rotina' : '⏳ Rotina', -9, -2);
      ctx.fillText(mech.activated ? '✔ Cuidado' : '○ Cuidado', -9, 9);
    } else if (mech.type === 'antenna') {
      ctx.strokeStyle = mech.activated ? COLORS.pink : '#9CA3AF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.lineTo(0, -13);
      ctx.moveTo(-9, 15);
      ctx.lineTo(0, 0);
      ctx.lineTo(9, 15);
      ctx.stroke();

      if (mech.activated) {
        const ring = (frame * 40) % 22;
        ctx.strokeStyle = `rgba(254, 145, 254, ${1 - ring / 22})`;
        ctx.beginPath();
        ctx.arc(0, -13, ring, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = mech.activated ? COLORS.pink : '#9CA3AF';
      ctx.beginPath();
      ctx.arc(0, -13, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 3;
      ctx.strokeRect(-9, -15, 18, 30);

      ctx.fillStyle = mech.activated ? COLORS.pink : '#FDE047';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Status label
    ctx.fillStyle = mech.activated ? '#34D399' : COLORS.pink;
    ctx.font = 'bold 9.5px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mech.activated ? '✓ Conectado' : `[Ajudar] ${mech.label}`, 0, -23);

    ctx.restore();
  }

  // Draw Checkpoint Flag
  static drawCheckpoint(ctx: CanvasRenderingContext2D, cp: CheckpointFlag, frame: number) {
    ctx.save();
    ctx.translate(cp.x, cp.y);

    // Flagpole
    ctx.fillStyle = '#D1D5DB';
    ctx.fillRect(0, 0, 3.5, 38);

    // Base
    ctx.fillStyle = '#4B5563';
    ctx.fillRect(-4, 35, 12, 4.5);

    // Pennant Flag
    const wave = Math.sin(frame * 6) * 3.5;
    ctx.fillStyle = cp.activated ? COLORS.pink : COLORS.purple;
    ctx.beginPath();
    ctx.moveTo(3.5, 2);
    ctx.lineTo(25 + wave, 10);
    ctx.lineTo(3.5, 19);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('♥', 8 + wave * 0.5, 13);

    ctx.restore();
  }

  // Draw Recognized Exit / Shelter Destination with Lock & Unlock visual indicators
  static drawExitDestination(
    ctx: CanvasRenderingContext2D,
    phaseNumber: number,
    x: number,
    y: number,
    frame: number,
    isUnlocked: boolean,
    rescuedCount: number,
    requiredRescues: number = 3
  ) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    // 1. Beacon Beam of Light when Unlocked
    if (isUnlocked) {
      const beamGlow = ctx.createLinearGradient(0, -300, 0, 60);
      beamGlow.addColorStop(0, 'rgba(254, 145, 254, 0)');
      beamGlow.addColorStop(0.7, 'rgba(254, 145, 254, 0.25)');
      beamGlow.addColorStop(1, 'rgba(250, 204, 21, 0.4)');
      ctx.fillStyle = beamGlow;
      ctx.fillRect(-10, -300, 110, 360);
    }

    // 2. Thematic Structure per Phase
    if (phaseNumber === 1) {
      // Phase 1: Espaço de Acolhimento no Jardim da Casa
      // Pergola with wooden posts and flowering vines
      ctx.fillStyle = '#78350F';
      ctx.fillRect(0, 0, 8, 55);
      ctx.fillRect(80, 0, 8, 55);

      // Trellis roof
      ctx.fillStyle = '#92400E';
      ctx.fillRect(-8, -10, 104, 10);
      for (let tx = -4; tx <= 92; tx += 12) {
        ctx.fillRect(tx, -14, 4, 6);
      }

      // Flowering vines with pink blossoms
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(4, 10, 8, 0, Math.PI * 2);
      ctx.arc(84, 12, 8, 0, Math.PI * 2);
      ctx.arc(44, -10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.pink;
      ctx.beginPath();
      ctx.arc(5, 8, 3, 0, Math.PI * 2);
      ctx.arc(83, 14, 3, 0, Math.PI * 2);
      ctx.arc(44, -12, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Cozy bench
      ctx.fillStyle = '#D97706';
      ctx.fillRect(16, 32, 56, 7);
      ctx.fillRect(20, 39, 5, 16);
      ctx.fillRect(63, 39, 5, 16);

      // Signboard
      ctx.fillStyle = COLORS.purpleDark;
      ctx.beginPath();
      ctx.roundRect(14, 6, 60, 16, 4);
      ctx.fill();
      ctx.fillStyle = COLORS.pink;
      ctx.font = 'bold 8.5px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Espaço Acolher', 44, 17);
    } else if (phaseNumber === 2) {
      // Phase 2: Ponto de Encontro Comunitário do Bairro
      // Street pavilion with purple awning and community board
      ctx.fillStyle = '#374151';
      ctx.fillRect(2, 0, 8, 55);
      ctx.fillRect(78, 0, 8, 55);

      // Curved purple awning with pink stripes
      ctx.fillStyle = COLORS.purple;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(44, -18);
      ctx.lineTo(98, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(-10, 0, 108, 4);

      // Community board
      ctx.fillStyle = '#D97706';
      ctx.fillRect(18, 16, 52, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(22, 20, 44, 20);

      // Lamppost next to pavilion
      ctx.fillStyle = '#4B5563';
      ctx.fillRect(92, -25, 4, 80);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(94, -25, 8, 0, Math.PI * 2);
      ctx.fill();

      // Signboard
      ctx.fillStyle = COLORS.purpleDark;
      ctx.beginPath();
      ctx.roundRect(10, 4, 68, 14, 4);
      ctx.fill();
      ctx.fillStyle = COLORS.pink;
      ctx.font = 'bold 8px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Ponto de Encontro', 44, 14);
    } else {
      // Phase 3: Portal das Conexões na Praça Central
      // Elegant bandstand gazebo with archway
      ctx.fillStyle = '#4C1D95';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(44, -28);
      ctx.lineTo(100, 0);
      ctx.closePath();
      ctx.fill();

      // Golden ornate trim
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-12, 0, 112, 5);

      // White ornate pillars
      ctx.fillStyle = '#F3F4F6';
      ctx.fillRect(0, 5, 8, 50);
      ctx.fillRect(80, 5, 8, 50);

      // Jacaranda floral garland arch
      ctx.fillStyle = '#C084FC';
      ctx.beginPath();
      ctx.arc(44, 15, 36, Math.PI, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#C084FC';
      ctx.stroke();

      // Signboard
      ctx.fillStyle = COLORS.purpleDark;
      ctx.beginPath();
      ctx.roundRect(8, -6, 72, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 8.5px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Portal das Conexões', 44, 5);
    }

    // 3. Clear Visual Status Indicator: Locked vs Unlocked
    if (!isUnlocked) {
      // Locked barrier lattice across the entrance
      ctx.fillStyle = 'rgba(107, 0, 117, 0.65)';
      ctx.fillRect(10, 14, 68, 40);

      // Floating padlock badge with missing rescues count
      const pulse = Math.sin(frame * 4) * 2;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-5, -28 + pulse, 98, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🔒 Faltam ${requiredRescues - rescuedCount} idosos (${rescuedCount}/${requiredRescues})`, 44, -14 + pulse);
    } else {
      // Unlocked celebration banner with floating stars
      const pulse = Math.sin(frame * 5) * 3;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-10, -32 + pulse, 108, 24, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9.5px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨ ABERTO! Entre para concluir! ✨', 44, -17 + pulse);
    }

    ctx.restore();
  }

  // Draw Parallax Background layers
  static drawParallaxBackground(
    ctx: CanvasRenderingContext2D,
    phaseNumber: number,
    camX: number,
    width: number,
    height: number
  ) {
    if (phaseNumber === 1) {
      // Phase 1: Home & Garden (Warm, domestic, structured)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#581c87');
      grad.addColorStop(0.6, '#3b0764');
      grad.addColorStop(1, '#2e1065');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Cozy room windows showing sunny garden
      const winOffset = -(camX * 0.15) % 300;
      for (let x = winOffset - 100; x < width + 100; x += 280) {
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.roundRect(x, 40, 70, 90, 8);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.roundRect(x + 4, 44, 62, 82, 6);
        ctx.fill();
        // Curtains
        ctx.fillStyle = COLORS.pink;
        ctx.fillRect(x + 4, 44, 12, 82);
        ctx.fillRect(x + 54, 44, 12, 82);
      }

      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(0, height - 70, width, 70);
    } else if (phaseNumber === 2) {
      // Phase 2: Neighborhood Street / Sidewalks
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.5, '#4c1d95');
      grad.addColorStop(1, '#6b21a8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Distant city buildings layer
      const buildOffset = -(camX * 0.2) % 240;
      for (let x = buildOffset - 100; x < width + 100; x += 120) {
        ctx.fillStyle = '#2e1065';
        ctx.fillRect(x, 70, 90, height - 70);
        ctx.fillStyle = '#FDE047';
        for (let wy = 90; wy < height - 100; wy += 26) {
          ctx.fillRect(x + 12, wy, 12, 16);
          ctx.fillRect(x + 36, wy, 12, 16);
          ctx.fillRect(x + 60, wy, 12, 16);
        }
      }

      // Streetlamp silhouettes
      const lampOffset = -(camX * 0.4) % 360;
      for (let x = lampOffset - 50; x < width + 50; x += 360) {
        ctx.fillStyle = '#374151';
        ctx.fillRect(x, 100, 6, height - 100);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(x + 3, 98, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Phase 3: Central Park & Community Plaza
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#701a75');
      grad.addColorStop(0.5, '#83078E');
      grad.addColorStop(1, '#a21caf');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Lush distant park trees
      const treeOffset = -(camX * 0.2) % 200;
      for (let x = treeOffset - 80; x < width + 80; x += 100) {
        ctx.fillStyle = '#065F46';
        ctx.beginPath();
        ctx.arc(x + 40, 110, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(x + 40, 120, 36, 0, Math.PI * 2);
        ctx.fill();
      }

      // Warm clouds
      const cloudOffset = -(camX * 0.1) % 300;
      for (let x = cloudOffset - 100; x < width + 100; x += 260) {
        ctx.fillStyle = 'rgba(254, 145, 254, 0.25)';
        ctx.beginPath();
        ctx.arc(x + 30, 40, 24, 0, Math.PI * 2);
        ctx.arc(x + 60, 32, 30, 0, Math.PI * 2);
        ctx.arc(x + 90, 40, 24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
