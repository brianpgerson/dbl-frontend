// ============================================================================
// Big Dongos — Batting Scene
// Classic batting game view: batter on the left in profile, strike zone
// center-right, pitcher in the distance. Ball approaches head-on.
// ============================================================================

import { COLORS, RENDER, POWER } from './constants';

export default class BattingScene {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.pitchActive = false;
    this.pitchProgress = 0;
    this.currentPitch = null;
    this.pitcherPhase = 'idle';
    this.pitcherTime = 0;
    this.isSwinging = false;
    this.swingTime = 0;
    this.windupProgress = 0;
    this.isWindingUp = false;

    // Swing feedback
    this.swingFeedback = null;
    this.ghostBall = null;

    // Pre-generate stars (stable across frames)
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.28,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 1 + Math.random() * 3,
      });
    }
    this.moonX = 0.78 + Math.random() * 0.1;
    this.moonY = 0.06 + Math.random() * 0.06;
  }

  startWindup() {
    this.isWindingUp = true;
    this.windupProgress = 0;
    this.pitcherPhase = 'windup';
    this.pitcherTime = 0;
  }

  updateWindup(elapsed, duration) {
    this.windupProgress = Math.min(1, elapsed / duration);
    this.pitcherTime = elapsed;
  }

  startPitch(pitch) {
    this.currentPitch = pitch;
    this.pitchActive = true;
    this.pitchProgress = 0;
    this.pitcherPhase = 'throwing';
    this.pitcherTime = 0;
    this.isWindingUp = false;
  }

  updatePitch(dt, pitch, elapsed) {
    if (!this.pitchActive || !pitch) return;
    this.pitchProgress = Math.min(1.2, elapsed / pitch.travelDuration);
    this.pitcherTime += dt;
    if (this.isSwinging) this.swingTime += dt;
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingTime = 0;
  }

  reset() {
    this.pitchActive = false;
    this.pitchProgress = 0;
    this.currentPitch = null;
    this.pitcherPhase = 'idle';
    this.pitcherTime = 0;
    this.isSwinging = false;
    this.swingTime = 0;
    this.isWindingUp = false;
    this.windupProgress = 0;
    this.swingFeedback = null;
    this.ghostBall = null;
  }

  setSwingFeedback(feedback) {
    this.swingFeedback = feedback;
  }

  setGhostBall(pitch) {
    const w = this.canvas.width, h = this.canvas.height;
    const zoneL = w * RENDER.zoneLeft, zoneR = w * RENDER.zoneRight;
    const zoneT = h * RENDER.zoneTop, zoneB = h * RENDER.zoneBottom;
    this.ghostBall = {
      x: zoneL + pitch.zoneX * (zoneR - zoneL),
      y: zoneT + pitch.zoneY * (zoneB - zoneT),
    };
  }

  // ---- FIELD ----
  renderField() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const horizonY = h * RENDER.horizonY;

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#030308');
    skyGrad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Stars
    const time = performance.now() / 1000;
    for (const star of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moon (small, semi-opaque crescent)
    const mx = this.moonX * w;
    const my = this.moonY * h;
    const moonR = Math.min(w, h) * 0.025;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.arc(mx, my, moonR, 0, Math.PI * 2);
    ctx.fill();
    // Shadow to create crescent
    ctx.fillStyle = '#030308';
    ctx.beginPath();
    ctx.arc(mx + moonR * 0.4, my - moonR * 0.15, moonR * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Field
    const fieldGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    fieldGrad.addColorStop(0, '#0a1f0a');
    fieldGrad.addColorStop(0.3, '#123312');
    fieldGrad.addColorStop(0.7, '#1a4d1a');
    fieldGrad.addColorStop(1, '#143314');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Perspective lines to vanishing point (center of horizon)
    const vpX = w * 0.51;
    const vpY = horizonY;
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (const xFrac of [0.0, 0.15, 0.85, 1.0]) {
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(w * xFrac, h);
      ctx.stroke();
    }

    // Pitcher's mound
    const moundY = h * RENDER.moundY;
    ctx.fillStyle = 'rgba(139, 105, 20, 0.12)';
    ctx.beginPath();
    ctx.ellipse(vpX, moundY, 44, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(vpX - 9, moundY - 2, 18, 4);

    // Home plate — same width as the strike zone
    const plateX = w * (RENDER.zoneLeft + RENDER.zoneRight) / 2;
    const plateY = h * (RENDER.zoneBottom + 0.06);
    const plateHalfW = w * (RENDER.zoneRight - RENDER.zoneLeft) / 2;
    const plateH = plateHalfW * 0.35;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(plateX, plateY + plateH);
    ctx.lineTo(plateX - plateHalfW, plateY);
    ctx.lineTo(plateX - plateHalfW * 0.7, plateY - plateH);
    ctx.lineTo(plateX + plateHalfW * 0.7, plateY - plateH);
    ctx.lineTo(plateX + plateHalfW, plateY);
    ctx.closePath();
    ctx.fill();

    // Dirt around home plate
    ctx.fillStyle = 'rgba(139, 105, 20, 0.08)';
    ctx.beginPath();
    ctx.ellipse(plateX, plateY + 10, plateHalfW * 1.5, plateH * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- STRIKE ZONE ----
  _renderStrikeZone() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    const left = w * RENDER.zoneLeft;
    const right = w * RENDER.zoneRight;
    const top = h * RENDER.zoneTop;
    const bottom = h * RENDER.zoneBottom;
    const zoneW = right - left;
    const zoneH = bottom - top;

    // Outer box
    ctx.strokeStyle = 'rgba(25, 184, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(left, top, zoneW, zoneH);
    ctx.setLineDash([]);

    // 3x3 grid
    ctx.strokeStyle = 'rgba(25, 184, 255, 0.06)';
    for (let i = 1; i < 3; i++) {
      const x = left + (zoneW / 3) * i;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      const y = top + (zoneH / 3) * i;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
  }

  // ---- PITCHER ----
  _renderPitcher() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.51;
    const moundY = h * RENDER.moundY;

    const s = Math.min(w, h) * 0.0024; // 2x original size
    const bodyH = 28 * s;

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(cx, moundY - bodyH, 3 * s, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx, moundY - bodyH + 3 * s);
    ctx.lineTo(cx, moundY - 5 * s);
    ctx.stroke();

    // Legs
    ctx.beginPath(); ctx.moveTo(cx, moundY - 5 * s); ctx.lineTo(cx - 4 * s, moundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, moundY - 5 * s); ctx.lineTo(cx + 4 * s, moundY); ctx.stroke();

    // Arms
    const shoulderY = moundY - bodyH + 8 * s;
    if (this.pitcherPhase === 'windup') {
      const amt = Math.min(1, this.windupProgress * 1.5);
      ctx.beginPath();
      ctx.moveTo(cx, shoulderY);
      ctx.lineTo(cx + Math.cos(-0.3 - amt * 1.2) * 9 * s, shoulderY + Math.sin(-0.3 - amt * 1.2) * 9 * s);
      ctx.stroke();
    } else if (this.pitcherPhase === 'throwing') {
      ctx.beginPath(); ctx.moveTo(cx, shoulderY);
      ctx.lineTo(cx - 5 * s, shoulderY + 7 * s);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx, shoulderY); ctx.lineTo(cx - 4 * s, shoulderY + 5 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, shoulderY); ctx.lineTo(cx + 4 * s, shoulderY + 5 * s); ctx.stroke();
    }
  }

  // ---- BALL (continues through zone and past it) ----
  _renderBall() {
    if (!this.pitchActive || this.pitchProgress <= 0) return;

    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const pitch = this.currentPitch;
    const progress = this.pitchProgress; // can go past 1.0

    // Three waypoints: pitcher → zone center → off-screen bottom
    const startX = w * 0.51;
    const startY = h * RENDER.moundY - 8;

    const zoneL = w * RENDER.zoneLeft, zoneR = w * RENDER.zoneRight;
    const zoneT = h * RENDER.zoneTop, zoneB = h * RENDER.zoneBottom;
    const zoneCenterX = zoneL + pitch.zoneX * (zoneR - zoneL);
    const zoneCenterY = zoneT + pitch.zoneY * (zoneB - zoneT);

    // Past the zone: ball continues straight down and slightly toward us
    const exitX = zoneCenterX + (zoneCenterX - startX) * 0.3;
    const exitY = h + 50;

    let ballX, ballY, radius;

    if (progress <= 1.0) {
      // Approaching and through the zone
      const eased = progress * progress * (3 - 2 * progress);
      ballX = startX + (zoneCenterX - startX) * eased;
      ballY = startY + (zoneCenterY - startY) * eased;
      radius = RENDER.ballStartRadius + (RENDER.ballEndRadius - RENDER.ballStartRadius) * (eased * eased);
    } else {
      // Past the zone — continue toward camera
      const pastProgress = Math.min(1, (progress - 1.0) / 0.3);
      ballX = zoneCenterX + (exitX - zoneCenterX) * pastProgress;
      ballY = zoneCenterY + (exitY - zoneCenterY) * pastProgress;
      radius = RENDER.ballEndRadius + pastProgress * 10; // keeps growing
    }

    // Don't draw if off screen
    if (ballY > h + 30) return;

    // Shadow on the ground — travels from mound to plate with the ball
    const moundGroundY = h * RENDER.moundY + 4;
    const plateGroundY = h * (RENDER.zoneBottom + 0.07);
    const shadowProgress = Math.min(1.3, progress);
    const easeP = Math.min(1, shadowProgress) * Math.min(1, shadowProgress) * (3 - 2 * Math.min(1, shadowProgress));
    const shadowY = moundGroundY + (plateGroundY - moundGroundY) * easeP;
    // Past the zone: shadow continues past plate
    const pastPlateY = shadowProgress > 1 ? plateGroundY + (shadowProgress - 1) * 150 : shadowY;
    const finalShadowY = shadowProgress <= 1 ? shadowY : pastPlateY;
    // Shadow grows as ball gets closer (perspective)
    const shadowRadiusX = 2 + easeP * 14;
    const shadowRadiusY = 1 + easeP * 5;
    const shadowAlpha = 0.05 + easeP * 0.2;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(ballX, finalShadowY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    const glow = Math.min(1, progress);
    ctx.shadowColor = COLORS.white;
    ctx.shadowBlur = 4 + glow * 16;
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(ballX, ballY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Seams
    if (radius > 5) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(200,0,0,${0.3 + glow * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(ballX - radius * 0.15, ballY, radius * 0.5, -0.5, 0.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(ballX + radius * 0.15, ballY, radius * 0.5, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // ---- GHOST BALL (where the ball crossed the zone) ----
  _renderGhostBall() {
    if (!this.ghostBall) return;
    const { ctx } = this;
    const { x, y } = this.ghostBall;

    // Pulsing ghost
    const pulse = 0.4 + 0.3 * Math.sin(this.swingTime * 8);

    ctx.globalAlpha = pulse;
    ctx.strokeStyle = COLORS.neonPink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair
    ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- BATTER (left side, profile view) ----
  _renderBatter(isSwinging) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    const bx = w * RENDER.batterX;          // center X of batter
    const footY = h * RENDER.batterBottom;   // feet position
    const s = w * 0.003 * RENDER.batterScale;

    // Full body proportions (profile/back view, facing right)
    const headY = footY - 85 * s;
    const shoulderY = footY - 70 * s;
    const waistY = footY - 35 * s;
    const kneeY = footY - 15 * s;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // -- Legs --
    ctx.strokeStyle = 'rgba(25, 184, 255, 0.3)';
    ctx.lineWidth = 4 * s;
    // Back leg (slightly bent)
    ctx.beginPath(); ctx.moveTo(bx - 2 * s, waistY); ctx.lineTo(bx - 6 * s, kneeY); ctx.lineTo(bx - 4 * s, footY); ctx.stroke();
    // Front leg
    ctx.beginPath(); ctx.moveTo(bx + 2 * s, waistY); ctx.lineTo(bx + 8 * s, kneeY); ctx.lineTo(bx + 6 * s, footY); ctx.stroke();

    // -- Torso --
    ctx.strokeStyle = 'rgba(25, 184, 255, 0.35)';
    ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(bx, waistY); ctx.lineTo(bx + 2 * s, shoulderY); ctx.stroke();

    // -- Head/helmet --
    ctx.fillStyle = 'rgba(25, 40, 70, 0.8)';
    ctx.beginPath();
    ctx.ellipse(bx + 3 * s, headY, 8 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(25, 184, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Helmet brim (facing right toward pitcher)
    ctx.strokeStyle = 'rgba(25, 184, 255, 0.25)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(bx + 10 * s, headY + 1 * s);
    ctx.lineTo(bx + 16 * s, headY + 3 * s);
    ctx.stroke();

    // -- Arms + Bat --
    if (isSwinging && this.swingTime < 0.2) {
      const swingProg = Math.min(1, this.swingTime / 0.1);

      // Arms swing through
      const handX = bx + 15 * s + swingProg * 30 * s;
      const handY = shoulderY + 10 * s;

      ctx.strokeStyle = 'rgba(25, 184, 255, 0.4)';
      ctx.lineWidth = 3.5 * s;
      ctx.beginPath();
      ctx.moveTo(bx + 5 * s, shoulderY + 3 * s);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Bat — sweeps through the zone horizontally
      ctx.strokeStyle = COLORS.neonYellow;
      ctx.lineWidth = 3 * s;
      ctx.shadowColor = COLORS.neonYellow;
      ctx.shadowBlur = 8;
      const batEndX = handX + 25 * s;
      const batEndY = handY - 3 * s + swingProg * 6 * s;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(batEndX, batEndY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Swing trail
      if (swingProg > 0.3) {
        ctx.strokeStyle = `rgba(255, 255, 0, ${0.25 * (1 - swingProg)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(handX - 10 * s, handY, 30 * s, -0.3, 0.3);
        ctx.stroke();
      }
    } else {
      // Ready stance — bat held up over shoulder
      const handX = bx + 10 * s;
      const handY = shoulderY + 2 * s;

      // Arms
      ctx.strokeStyle = 'rgba(25, 184, 255, 0.3)';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(bx + 5 * s, shoulderY + 3 * s);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Bat angled up
      ctx.strokeStyle = COLORS.neonYellow;
      ctx.lineWidth = 2.5 * s;
      ctx.shadowColor = 'rgba(255,255,0,0.15)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(bx - 2 * s, headY - 25 * s);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // ---- POWER METER ----
  _renderPowerMeter(powerLevel) {
    if (powerLevel == null) return;

    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Position on the far left edge
    const meterX = w * 0.03;
    const meterW = w * 0.022;
    const meterTop = h * 0.30;
    const meterBottom = h * 0.80;
    const meterH = meterBottom - meterTop;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(meterX, meterTop, meterW, meterH);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, meterTop, meterW, meterH);

    // Sweet spot
    const sweetTopY = meterBottom - POWER.sweetSpotMax * meterH;
    const sweetBottomY = meterBottom - POWER.sweetSpotMin * meterH;
    ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
    ctx.fillRect(meterX, sweetTopY, meterW, sweetBottomY - sweetTopY);
    ctx.strokeStyle = COLORS.neonGreen;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(meterX, sweetTopY); ctx.lineTo(meterX + meterW, sweetTopY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(meterX, sweetBottomY); ctx.lineTo(meterX + meterW, sweetBottomY); ctx.stroke();
    ctx.setLineDash([]);

    // Fill
    const fillH = meterH * powerLevel;
    const fillY = meterBottom - fillH;
    let fillColor = powerLevel <= POWER.sweetSpotMin ? COLORS.neonBlue :
                    powerLevel <= POWER.sweetSpotMax ? COLORS.neonGreen : COLORS.neonOrange;
    ctx.fillStyle = fillColor;
    ctx.fillRect(meterX + 1, fillY, meterW - 2, fillH);

    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(meterX + 1, fillY, meterW - 2, Math.min(3, fillH));
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.dimWhite;
    ctx.font = `${Math.min(w * 0.012, 7)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PWR', meterX + meterW / 2, meterBottom + 12);
  }

  // ---- HUD ----
  _renderSwingCounter(label) {
    const { ctx, canvas } = this;
    const isWarmup = label && label.startsWith('Warmup');
    ctx.fillStyle = isWarmup ? 'rgba(255, 102, 0, 0.5)' : COLORS.dimWhite;
    ctx.font = `${Math.min(canvas.width * 0.02, 11)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(label || '', canvas.width - 12, 10);
  }

  _renderSpeedLabel() {
    if (!this.currentPitch || !this.pitchActive) return;
    const { ctx, canvas } = this;
    ctx.fillStyle = COLORS.dimWhite;
    ctx.font = `${Math.min(canvas.width * 0.018, 10)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(this.currentPitch.speed)} MPH`, 12, 10);
  }

  // ---- SWING PATH FEEDBACK ----
  _renderSwingFeedback() {
    if (!this.swingFeedback || !this.isSwinging) return;

    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const { closestPoint, ballCanvasPos, planeDistance } = this.swingFeedback;

    const fadeTime = 2.0;
    const alpha = Math.max(0, 1 - this.swingTime / fadeTime);
    if (alpha <= 0) return;

    // Draw the swing line (normalized to zone width)
    const { swingLine } = this.swingFeedback;
    if (swingLine) {
      ctx.strokeStyle = `rgba(255, 255, 0, ${0.8 * alpha})`;
      ctx.lineWidth = 6;
      ctx.shadowColor = `rgba(255, 255, 0, ${0.5 * alpha})`;
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(swingLine.startX * w, swingLine.startY * h);
      ctx.lineTo(swingLine.endX * w, swingLine.endY * h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw the closest point on the path (intersection indicator)
    if (closestPoint && ballCanvasPos) {
      const cpx = closestPoint.x * w;
      const cpy = closestPoint.y * h;
      const bx = ballCanvasPos.x * w;
      const by = ballCanvasPos.y * h;

      // Line from closest point to ball position
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * alpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cpx, cpy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      // Closest point marker (on the swipe path)
      ctx.fillStyle = `rgba(255, 255, 0, ${0.8 * alpha})`;
      ctx.shadowColor = `rgba(255, 255, 0, ${0.5 * alpha})`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(cpx, cpy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ball target marker
      ctx.strokeStyle = `rgba(255, 41, 152, ${0.7 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.stroke();
      // Small crosshair
      ctx.beginPath(); ctx.moveTo(bx - 12, by); ctx.lineTo(bx + 12, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by - 12); ctx.lineTo(bx, by + 12); ctx.stroke();

      // Label to the right of the strike zone
      const { isWhiff, timingLabel } = this.swingFeedback;
      const labelX = w * RENDER.zoneRight + 25;
      const labelY = (cpy + by) / 2;

      let contactLabel, labelColor;
      if (isWhiff && (timingLabel === 'EARLY' || timingLabel === 'LATE')) {
        // Timing miss — show early/late instead of contact quality
        contactLabel = timingLabel;
        labelColor = timingLabel === 'EARLY' ? `rgba(25, 184, 255, ${0.8 * alpha})` :
                     `rgba(255, 102, 0, ${0.8 * alpha})`;
      } else {
        contactLabel = planeDistance > 0.18 ? 'MISS' :
                       planeDistance > 0.07 ? 'WEAK' : 'SWEET SPOT';
        labelColor = planeDistance > 0.18 ? `rgba(255, 102, 0, ${0.7 * alpha})` :
                     planeDistance > 0.07 ? `rgba(255, 255, 255, ${0.5 * alpha})` :
                     `rgba(57, 255, 20, ${0.8 * alpha})`;
      }

      ctx.fillStyle = labelColor;
      ctx.font = `${Math.min(w * 0.016, 9)}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(contactLabel, labelX, labelY);
    }
  }

  // ---- MAIN RENDER ----
  render(swingLabel, powerLevel, isSwinging) {
    this.renderField();
    this._renderStrikeZone();
    this._renderPitcher();
    this._renderGhostBall();
    this._renderBall();
    this._renderSwingFeedback();
    this._renderBatter(isSwinging);
    this._renderSwingCounter(swingLabel);
    this._renderSpeedLabel();
  }
}
