// ============================================================================
// Big Dongos — Flight Scene
// Top-down/outfield view: ball trajectory, distance markers, landing
// ============================================================================

import { COLORS, FLIGHT, RENDER } from './constants';

export default class FlightScene {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.contact = null;
    this.elapsed = 0;
    this.isComplete = false;

    // Ball position (normalized 0-1 along the trajectory)
    this.progress = 0;

    // Trail points for the arc
    this.trail = [];
  }

  startFlight(contact) {
    this.contact = contact;
    this.elapsed = 0;
    this.isComplete = false;
    this.progress = 0;
    this.trail = [];
  }

  update(dt) {
    if (!this.contact || this.isComplete) return;

    this.elapsed += dt;
    const duration = FLIGHT.animationDuration;

    // Ease-out: fast start, slow at the end
    const rawProgress = Math.min(1, this.elapsed / duration);
    this.progress = 1 - Math.pow(1 - rawProgress, 2);

    // Add trail point
    if (this.trail.length === 0 || rawProgress - (this.trail[this.trail.length - 1]?.raw || 0) > 0.02) {
      this.trail.push({ progress: this.progress, raw: rawProgress });
    }

    // Complete when animation is done and a little hang time
    if (this.elapsed > duration + 1.0) {
      this.isComplete = true;
    }
  }

  render() {
    if (!this.contact) return;

    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const padding = RENDER.flightFieldPadding;

    // Field dimensions (usable area)
    const fieldLeft = w * padding;
    const fieldRight = w * (1 - padding);
    const fieldTop = h * 0.08;
    const fieldBottom = h * 0.78;
    const fieldW = fieldRight - fieldLeft;
    const fieldH = fieldBottom - fieldTop;

    // Home plate at bottom center
    const homeX = fieldLeft + fieldW * 0.5;
    const homeY = fieldBottom;

    // Max renderable distance maps to top of field area
    const maxRenderDist = Math.max(FLIGHT.maxDistance, this.contact.distance.totalFeet + 50);

    // --- Draw field ---

    // Outfield grass (fan shape)
    ctx.fillStyle = '#0d2e0d';
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, fieldH, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.closePath();
    ctx.fill();

    // Infield dirt
    const infieldRadius = fieldH * (100 / maxRenderDist);
    ctx.fillStyle = 'rgba(139, 105, 20, 0.2)';
    ctx.beginPath();
    ctx.arc(homeX, homeY, infieldRadius, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.lineTo(homeX, homeY);
    ctx.closePath();
    ctx.fill();

    // Distance arcs
    for (const marker of FLIGHT.markers) {
      if (marker > maxRenderDist) continue;
      const radius = fieldH * (marker / maxRenderDist);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(homeX, homeY, radius, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = `${Math.min(w * 0.018, 10)}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${marker}'`, homeX, homeY - radius - 8);
    }

    // Foul lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(homeX - fieldH * Math.sin(Math.PI * 0.35), homeY - fieldH * Math.cos(Math.PI * 0.35));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(homeX + fieldH * Math.sin(Math.PI * 0.35), homeY - fieldH * Math.cos(Math.PI * 0.35));
    ctx.stroke();

    // Home plate marker
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(homeX, homeY, 4, 0, Math.PI * 2);
    ctx.fill();

    // --- Ball trajectory ---
    const totalDist = this.contact.distance.totalFeet;
    const currentDist = totalDist * this.progress;
    const distRadius = fieldH * (currentDist / maxRenderDist);

    // Spray direction based on timing: early → pull (left), late → oppo (right)
    // timingOffset: negative = early, positive = late
    const timingSpray = (this.contact.timingOffset || 0) * 2.5; // ±~30° spread
    const dirAngle = -Math.PI / 2 + timingSpray;

    // Draw trail
    if (this.trail.length > 1) {
      ctx.strokeStyle = COLORS.neonGreen;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.neonGreen;
      ctx.shadowBlur = 8;
      ctx.beginPath();

      for (let i = 0; i < this.trail.length; i++) {
        const trailDist = totalDist * this.trail[i].progress;
        const trailRadius = fieldH * (trailDist / maxRenderDist);
        const tx = homeX + Math.cos(dirAngle) * trailRadius;
        const ty = homeY + Math.sin(dirAngle) * trailRadius;

        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Ball position
    const ballX = homeX + Math.cos(dirAngle) * distRadius;
    const ballY = homeY + Math.sin(dirAngle) * distRadius;

    // Ball height (arc) — rises then falls
    const heightProgress = this.progress;
    const arcHeight = Math.sin(heightProgress * Math.PI) * 15 * (this.contact.launchAngle / 30);

    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ballX, ballY, 5 + arcHeight * 0.3, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball (elevated by arc)
    ctx.shadowColor = COLORS.white;
    ctx.shadowBlur = 10 + arcHeight;
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(ballX, ballY - arcHeight, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Landing indicator (when ball has landed)
    if (this.progress >= 0.98) {
      const landX = homeX + Math.cos(dirAngle) * (fieldH * (totalDist / maxRenderDist));
      const landY = homeY + Math.sin(dirAngle) * (fieldH * (totalDist / maxRenderDist));

      // Landing circle
      const landingPulse = 0.5 + 0.5 * Math.sin((this.elapsed - FLIGHT.animationDuration) * 5);
      ctx.strokeStyle = COLORS.neonGreen;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + landingPulse * 0.5;
      ctx.beginPath();
      ctx.arc(landX, landY, 8 + landingPulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // "X" mark
      ctx.strokeStyle = COLORS.neonPink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(landX - 4, landY - 4);
      ctx.lineTo(landX + 4, landY + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(landX + 4, landY - 4);
      ctx.lineTo(landX - 4, landY + 4);
      ctx.stroke();
    }

    // --- Distance readout ---
    const displayDist = Math.floor(currentDist);

    const textY = h * 0.88;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Big distance number
    ctx.shadowColor = COLORS.neonGreen;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = `bold ${Math.min(w * 0.07, 40)}px 'Press Start 2P', monospace`;

    if (this.progress >= 0.98) {
      ctx.fillText(`${this.contact.distance.feet}' ${this.contact.distance.inches}"`, w / 2, textY);
    } else {
      ctx.fillText(`${displayDist}'`, w / 2, textY);
    }
    ctx.shadowBlur = 0;

    // Exit velo label
    ctx.fillStyle = COLORS.dimWhite;
    ctx.font = `${Math.min(w * 0.018, 10)}px 'Press Start 2P', monospace`;
    ctx.fillText(`${this.contact.exitVelocity} mph  |  ${this.contact.launchAngle}°`, w / 2, textY + 28);
  }
}
