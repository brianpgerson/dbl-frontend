// ============================================================================
// Big Dongos — Game Engine
// Simplified: swipe to swing, timing determines hit quality.
// No power meter. Ball passes through the zone.
// ============================================================================

import InputHandler from './input';
import BattingScene from './BattingScene';
import FlightScene from './FlightScene';
import { generatePitch, calculateContact } from './physics';
import { GAME, CANVAS_BG, COLORS, RENDER, PITCH } from './constants';

const STATE = {
  TITLE: 'title',
  INTRO: 'intro',         // Intro text — tap to begin
  WINDUP: 'windup',
  PITCH: 'pitch',
  SWINGING: 'swinging',
  FLIGHT: 'flight',
  WHIFF: 'whiff',
  RESULT: 'result',
  TRANSITION: 'transition', // "Now for some REAL pitches" pause
  DONE: 'done',
};

export default class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputHandler(canvas);
    this.battingScene = new BattingScene(canvas, this.ctx);
    this.flightScene = new FlightScene(canvas, this.ctx);

    this.state = STATE.TITLE;
    this.stateTime = 0;
    this.lastTime = 0;
    this.animFrameId = null;

    this.currentSwing = 0;
    this.swingResults = [];
    this.currentPitch = null;
    this.currentContact = null;

    this.pitchStartTime = 0;
    this.pitchTimeAtSwipe = 0; // how far into the pitch the swipe happened

    this.shakeOffset = { x: 0, y: 0 };
    this.shakeTimeRemaining = 0;

    this.config = {
      windupDuration: PITCH.windupDuration,
      travelDurationMin: PITCH.travelDurationMin,
      travelDurationMax: PITCH.travelDurationMax,
      zoneEntryProgress: PITCH.zoneEntryProgress,
      zoneExitProgress: PITCH.zoneExitProgress,
      swingPauseDuration: 2.0,
    };

    // Practice mode: infinite swings, no DB saves
    this.practiceMode = false;

    // Callback for when all swings are done
    this.onAttemptComplete = null;
    // Callback per swing (for saving each swing to DB)
    this.onSwingComplete = null;
  }

  _isWarmup() {
    return this.currentSwing < GAME.warmupSwings;
  }

  _swingLabel() {
    if (this.practiceMode) {
      return 'Practice';
    }
    if (this._isWarmup()) {
      return `Warmup ${this.currentSwing + 1}/${GAME.warmupSwings}`;
    }
    const realSwing = this.currentSwing - GAME.warmupSwings;
    return `Swing ${realSwing + 1}/${GAME.realSwings}`;
  }

  start() {
    this.state = STATE.TITLE;
    this.stateTime = 0;
    this.currentSwing = 0;
    this.swingResults = [];
    this.lastTime = performance.now() / 1000;
    this._loop();
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.input.destroy();
  }

  _setState(s) { this.state = s; this.stateTime = 0; }

  _loop() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - this.lastTime, 0.05);
    this.lastTime = now;
    this._update(dt);
    this._render();
    this.input.resetFrame();
    this.animFrameId = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    this.stateTime += dt;

    if (this.shakeTimeRemaining > 0) {
      this.shakeTimeRemaining -= dt;
      const i = GAME.shakeIntensity * (this.shakeTimeRemaining / GAME.shakeDuration);
      this.shakeOffset = { x: (Math.random() * 2 - 1) * i, y: (Math.random() * 2 - 1) * i };
    } else {
      this.shakeOffset = { x: 0, y: 0 };
    }

    switch (this.state) {
      case STATE.TITLE:
        if (this.input.justReleased) {
          if (this.practiceMode) {
            this._startWindup(); // skip intro in practice mode
          } else {
            this._setState(STATE.INTRO);
          }
        }
        break;

      case STATE.INTRO:
        if (this.stateTime > 1.0 && this.input.justReleased) {
          this._startWindup();
        }
        break;

      case STATE.WINDUP:
        this.battingScene.updateWindup(this.stateTime, this.config.windupDuration);
        if (this.stateTime >= this.config.windupDuration) {
          this._throwPitch();
          this._setState(STATE.PITCH);
        }
        break;

      case STATE.PITCH:
        this.battingScene.updatePitch(dt, this.currentPitch, this.stateTime);

        // Player swiped — that's the swing
        if (this.input.justSwiped && this.input.swipe) {
          this.pitchTimeAtSwipe = this.stateTime;
          this._handleSwing();
        }

        // Ball has fully passed — auto-whiff
        if (this.stateTime >= this.currentPitch.travelDuration + 0.4) {
          this._handleWhiff();
        }
        break;

      case STATE.SWINGING:
        // Continue animating the pitch (ball keeps moving through/past zone)
        this.battingScene.updatePitch(dt, this.currentPitch,
          this.pitchTimeAtSwipe + this.stateTime);

        // Pause to show swing feedback before transitioning
        if (this.stateTime > this.config.swingPauseDuration) {
          if (this.currentContact && !this.currentContact.isWhiff) {
            this.shakeTimeRemaining = GAME.shakeDuration * this.currentContact.contactQuality;
            this.flightScene.startFlight(this.currentContact);
            this._setState(STATE.FLIGHT);
          } else {
            this._handleWhiff();
          }
        }
        break;

      case STATE.FLIGHT:
        this.flightScene.update(dt);
        if (this.flightScene.isComplete) this._setState(STATE.RESULT);
        break;

      case STATE.WHIFF:
        if (this.stateTime > GAME.whiffDisplayDuration &&
            (this.input.justReleased || this.stateTime > GAME.whiffDisplayDuration + 1.5)) {
          this._nextSwing();
        }
        break;

      case STATE.RESULT:
        if (this.stateTime > GAME.resultHoldDuration &&
            (this.input.justReleased || this.stateTime > GAME.resultHoldDuration + 2)) {
          this._nextSwing();
        }
        break;

      case STATE.TRANSITION:
        // "Now for some REAL pitches" — 5 second pause
        if (this.stateTime > 5.0) {
          this._startWindup();
        }
        break;

      case STATE.DONE:
        break;
      default:
        break;
    }
  }

  _startWindup() {
    this.battingScene.reset();
    this.battingScene.startWindup();
    this._setState(STATE.WINDUP);
  }

  _throwPitch() {
    this.currentPitch = generatePitch(this.config);
    this.pitchStartTime = this.lastTime;
    this.battingScene.startPitch(this.currentPitch);
  }

  _handleSwing() {
    const swipe = this.input.swipe;
    const pitch = this.currentPitch;
    const pitchProgress = this.stateTime / pitch.travelDuration;

    // Timing: how close is the swipe to the center of the zone traversal?
    const zoneMid = (this.config.zoneEntryProgress + this.config.zoneExitProgress) / 2;
    const timingOffset = pitchProgress - zoneMid;

    // Build the normalized swing line: always spans the zone width,
    // using the swipe's angle and average Y position.
    const { zoneLeft, zoneRight, zoneTop, zoneBottom } = RENDER;
    const ballCanvasX = zoneLeft + pitch.zoneX * (zoneRight - zoneLeft);
    const ballCanvasY = zoneTop + pitch.zoneY * (zoneBottom - zoneTop);
    const zoneH = zoneBottom - zoneTop;
    const zoneW = zoneRight - zoneLeft;

    const sp0 = swipe.path[0];
    const sp1 = swipe.path[swipe.path.length - 1];
    const swipeDx = sp1.x - sp0.x;
    const swipeDy = sp1.y - sp0.y;
    const swipeLen = Math.sqrt(swipeDx * swipeDx + swipeDy * swipeDy);

    // Slope of the swipe (dy/dx), capped to prevent extreme angles
    const slope = swipeLen > 0.01 ? (swipeDy / (Math.abs(swipeDx) || 0.01)) * Math.sign(swipeDx) : 0;
    const clampedSlope = Math.max(-0.6, Math.min(0.6, slope));

    // Swing line Y at zone center = average Y of the swipe
    const centerY = swipe.avgY;
    const margin = zoneW * 0.08; // extend slightly past zone edges

    // Line endpoints: start just inside left edge, end just outside right edge
    const lineStartX = zoneLeft - margin;
    const lineEndX = zoneRight + margin;
    const halfSpan = (lineEndX - lineStartX) / 2;
    const lineStartY = centerY - clampedSlope * halfSpan;
    const lineEndY = centerY + clampedSlope * halfSpan;

    // Find closest point on this line segment to the ball
    const lx = lineEndX - lineStartX;
    const ly = lineEndY - lineStartY;
    const lenSq = lx * lx + ly * ly;
    let t = 0;
    if (lenSq > 0) {
      t = ((ballCanvasX - lineStartX) * lx + (ballCanvasY - lineStartY) * ly) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const closestPoint = { x: lineStartX + t * lx, y: lineStartY + t * ly };

    const cdx = closestPoint.x - ballCanvasX;
    const cdy = closestPoint.y - ballCanvasY;
    const minDist = Math.sqrt(cdx * cdx + cdy * cdy);
    const planeDistance = minDist / (zoneH || 0.3);

    // Store the swing line for rendering
    const swingLine = { startX: lineStartX, startY: lineStartY, endX: lineEndX, endY: lineEndY };

    this.currentContact = calculateContact(
      1.0,
      timingOffset,
      planeDistance, // pass distance instead of Y position
      pitch
    );

    // Show swing feedback with intersection point
    this.battingScene.setSwingFeedback({
      swingLine,
      closestPoint: { x: closestPoint.x, y: closestPoint.y },
      ballCanvasPos: { x: ballCanvasX, y: ballCanvasY },
      planeDistance,
      isWhiff: this.currentContact.isWhiff,
      timingLabel: this.currentContact.timingLabel,
    });

    this.battingScene.setGhostBall(pitch);
    this.battingScene.triggerSwing();

    // Fire per-swing callback
    if (this.onSwingComplete) {
      this.onSwingComplete(this.currentContact, this.currentSwing, this._isWarmup());
    }

    this._setState(STATE.SWINGING);
  }

  _handleWhiff() {
    const pitch = this.currentPitch;
    this.currentContact = { isWhiff: true, contactQuality: 0, distance: { feet: 0, inches: 0, totalFeet: 0 }, timingLabel: 'MISS', timingOffset: 0 };
    this.swingResults.push(this.currentContact);

    if (this.onSwingComplete) {
      this.onSwingComplete(this.currentContact, this.currentSwing, this._isWarmup());
    }

    this.battingScene.reset();
    // Show ghost ball on strikes so the player can see where it was
    if (pitch) {
      this.battingScene.setGhostBall(pitch);
    }
    this._setState(STATE.WHIFF);
  }

  _nextSwing() {
    if (this.currentContact && !this.currentContact.isWhiff && this.state === STATE.RESULT) {
      this.swingResults.push(this.currentContact);
    }
    this.currentSwing++;

    // Practice mode: infinite loop, no end
    if (this.practiceMode) {
      this.battingScene.reset();
      this._startWindup();
      return;
    }

    // Transition from warmup to real swings
    if (this.currentSwing === GAME.warmupSwings) {
      this.battingScene.reset();
      this._setState(STATE.TRANSITION);
      return;
    }

    if (this.currentSwing >= GAME.swingsPerAttempt) {
      this._setState(STATE.DONE);
      if (this.onAttemptComplete) this.onAttemptComplete(this.swingResults);
    } else {
      this.battingScene.reset();
      this._startWindup();
    }
  }

  _render() {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

    switch (this.state) {
      case STATE.TITLE:   this._renderTitle(); break;
      case STATE.INTRO:   this._renderIntro(); break;
      case STATE.TRANSITION: this._renderTransition(); break;
      case STATE.WINDUP:  this.battingScene.render(this._swingLabel()); break;
      case STATE.PITCH:   this.battingScene.render(this._swingLabel()); break;
      case STATE.SWINGING:this.battingScene.render(this._swingLabel(), null, true); break;
      case STATE.FLIGHT:  this.flightScene.render(); break;
      case STATE.WHIFF:   this._renderWhiff(); break;
      case STATE.RESULT:  this._renderResult(); break;
      case STATE.DONE:    this._renderDone(); break;
      default: break;
    }

    // Debug state label
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.state, 5, canvas.height - 3);
    ctx.restore();
  }

  _renderTitle() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.neonPink; ctx.shadowBlur = 30;
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = `bold ${Math.min(canvas.width * 0.08, 48)}px 'Press Start 2P', monospace`;
    ctx.fillText('BIG DONGOS', cx, cy - 40);
    ctx.shadowColor = COLORS.neonBlue; ctx.shadowBlur = 15;
    ctx.fillStyle = COLORS.neonBlue;
    ctx.font = `${Math.min(canvas.width * 0.03, 16)}px 'Press Start 2P', monospace`;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.stateTime * 4);
    const tapText = this.practiceMode ? 'TAP TO PRACTICE' : 'TAP TO PLAY';
    ctx.fillText(tapText, cx, cy + 40);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    if (this.practiceMode) {
      ctx.fillStyle = COLORS.dimWhite;
      ctx.font = `${Math.min(canvas.width * 0.018, 10)}px 'Press Start 2P', monospace`;
      ctx.fillText('Practice mode - scores won\'t count', cx, cy + 75);
    }
  }

  _renderIntro() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const fs = Math.min(canvas.width * 0.02, 12);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    ctx.fillStyle = COLORS.neonBlue;
    ctx.font = `${fs}px 'Press Start 2P', monospace`;

    const lines = [
      "It's the Home Run Derby,",
      "and you have 5 swings to",
      "determine your draft order.",
      "",
      "Warm up for 5 swings,",
      "then the next 5 count!",
    ];
    const lineH = fs * 2.2;
    const startY = cy - (lines.length * lineH) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, startY + i * lineH);
    });

    if (this.stateTime > 1.0) {
      const alpha = 0.5 + 0.5 * Math.sin(this.stateTime * 4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.neonGreen;
      ctx.font = `${Math.min(canvas.width * 0.025, 14)}px 'Press Start 2P', monospace`;
      ctx.fillText('TAP TO BEGIN', cx, cy + 120);
      ctx.globalAlpha = 1;
    }
  }

  _renderTransition() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2, cy = canvas.height / 2;

    this.battingScene.renderField();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // "Now for some REAL pitches"
    ctx.shadowColor = COLORS.neonPink; ctx.shadowBlur = 25;
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = `bold ${Math.min(canvas.width * 0.035, 22)}px 'Press Start 2P', monospace`;
    ctx.fillText('Warmup over!', cx, cy - 30);

    ctx.shadowColor = COLORS.neonGreen; ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = `bold ${Math.min(canvas.width * 0.04, 26)}px 'Press Start 2P', monospace`;
    ctx.fillText('Now for some', cx, cy + 20);
    ctx.fillText('REAL pitches!', cx, cy + 55);
    ctx.shadowBlur = 0;

    // Countdown
    const remaining = Math.ceil(5.0 - this.stateTime);
    if (remaining > 0) {
      ctx.fillStyle = COLORS.dimWhite;
      ctx.font = `${Math.min(canvas.width * 0.02, 12)}px 'Press Start 2P', monospace`;
      ctx.fillText(`${remaining}...`, cx, cy + 100);
    }
  }

  _renderWhiff() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    this.battingScene.renderField();
    this.battingScene._renderStrikeZone();
    this.battingScene._renderGhostBall();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.neonOrange; ctx.shadowBlur = 25;
    ctx.fillStyle = COLORS.neonOrange;
    ctx.font = `bold ${Math.min(canvas.width * 0.07, 42)}px 'Press Start 2P', monospace`;
    ctx.fillText('STRIKE!', cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.dimWhite;
    ctx.font = `${Math.min(canvas.width * 0.022, 13)}px 'Press Start 2P', monospace`;
    ctx.fillText(this._swingLabel(), cx, cy + 50);
    if (this.stateTime > GAME.whiffDisplayDuration)
      ctx.fillText('TAP TO CONTINUE', cx, canvas.height - 40);
  }

  _renderResult() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2;
    const c = this.currentContact, d = c.distance;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.neonGreen; ctx.shadowBlur = 30;
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = `bold ${Math.min(canvas.width * 0.06, 36)}px 'Press Start 2P', monospace`;
    ctx.fillText(`${d.feet}' ${d.inches}"`, cx, canvas.height * 0.35);
    ctx.shadowBlur = 0; ctx.fillStyle = COLORS.neonBlue;
    ctx.font = `${Math.min(canvas.width * 0.022, 13)}px 'Press Start 2P', monospace`;
    ctx.fillText(`Exit Velo: ${c.exitVelocity} mph`, cx, canvas.height * 0.46);
    ctx.fillText(`Launch Angle: ${c.launchAngle}°`, cx, canvas.height * 0.52);
    ctx.fillText(`Contact: ${Math.round(c.contactQuality * 100)}%`, cx, canvas.height * 0.58);

    // Timing label
    const timingColor = c.timingLabel === 'PERFECT' ? COLORS.neonGreen :
                        c.timingLabel === 'EARLY' ? COLORS.neonBlue : COLORS.neonOrange;
    ctx.fillStyle = timingColor;
    ctx.font = `${Math.min(canvas.width * 0.02, 12)}px 'Press Start 2P', monospace`;
    ctx.fillText(`Timing: ${c.timingLabel}`, cx, canvas.height * 0.64);

    // Quality label
    const ql = c.contactQuality > 0.85 ? 'PERFECT!' : c.contactQuality > 0.65 ? 'GREAT!' :
               c.contactQuality > 0.45 ? 'GOOD' : c.contactQuality > 0.25 ? 'OKAY' : 'WEAK';
    const qc = c.contactQuality > 0.85 ? COLORS.neonPink : c.contactQuality > 0.65 ? COLORS.neonGreen :
               c.contactQuality > 0.45 ? COLORS.neonBlue : COLORS.neonOrange;
    ctx.fillStyle = qc; ctx.shadowColor = qc; ctx.shadowBlur = 15;
    ctx.font = `bold ${Math.min(canvas.width * 0.035, 20)}px 'Press Start 2P', monospace`;
    ctx.fillText(ql, cx, canvas.height * 0.70); ctx.shadowBlur = 0;
    if (this.stateTime > GAME.resultHoldDuration) {
      ctx.fillStyle = COLORS.neonBlue;
      ctx.font = `${Math.min(canvas.width * 0.022, 13)}px 'Press Start 2P', monospace`;
      ctx.fillText('TAP TO CONTINUE', cx, canvas.height - 40);
    }
  }

  _renderDone() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.neonPink; ctx.shadowBlur = 20; ctx.fillStyle = COLORS.neonPink;
    ctx.font = `bold ${Math.min(canvas.width * 0.045, 28)}px 'Press Start 2P', monospace`;
    ctx.fillText('RESULTS', cx, canvas.height * 0.12); ctx.shadowBlur = 0;
    // Only show real swings (skip warmup)
    const warmupCount = Math.min(GAME.warmupSwings, this.swingResults.length);
    const realSwings = this.swingResults.slice(warmupCount);

    let bestIdx = -1, bestDist = 0;
    realSwings.forEach((r, i) => {
      const d = r.isWhiff ? 0 : r.distance.totalFeet;
      if (d > bestDist) { bestDist = d; bestIdx = i; }
    });
    const startY = canvas.height * 0.22;
    const lh = Math.min(canvas.height * 0.10, 50);
    realSwings.forEach((r, i) => {
      const y = startY + i * lh;
      ctx.font = `${Math.min(canvas.width * 0.023, 13)}px 'Press Start 2P', monospace`;
      if (r.isWhiff) { ctx.fillStyle = COLORS.dimWhite; ctx.fillText(`Swing ${i+1}: WHIFF`, cx, y); }
      else {
        ctx.fillStyle = i === bestIdx ? COLORS.neonGreen : COLORS.neonBlue;
        if (i === bestIdx) { ctx.shadowColor = COLORS.neonGreen; ctx.shadowBlur = 15; }
        ctx.fillText(`Swing ${i+1}: ${r.distance.feet}' ${r.distance.inches}"`, cx, y);
        ctx.shadowBlur = 0;
      }
    });
    if (bestIdx >= 0) {
      const b = realSwings[bestIdx];
      ctx.shadowColor = COLORS.neonGreen; ctx.shadowBlur = 30; ctx.fillStyle = COLORS.neonGreen;
      ctx.font = `bold ${Math.min(canvas.width * 0.05, 30)}px 'Press Start 2P', monospace`;
      ctx.fillText(`${b.distance.feet}' ${b.distance.inches}"`, cx, canvas.height * 0.78);
      ctx.shadowBlur = 0;
    }
  }

  // Start or resume from a specific swing number (0-indexed)
  startFromSwing(swingNum) {
    this.currentSwing = swingNum || 0;
    this.swingResults = [];
    this.currentPitch = null;
    this.currentContact = null;
    this.battingScene.reset();
    this._startWindup();
  }

  resetAttempt() {
    this.startFromSwing(0);
  }
}
