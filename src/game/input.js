// ============================================================================
// Big Dongos — Input Handler (Mouse + Touch)
// Simplified: just tracks swipe gestures with their full path.
// No hold/power — just swipe to swing.
// ============================================================================

import { SWING } from './constants';

export default class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.isPressed = false;
    this.pressStartTime = 0;

    // Swipe path: array of {x, y, t} points captured during the gesture
    this.swipePath = [];
    this.swipe = null;     // finalized swipe data
    this.justSwiped = false;
    this.justPressed = false;
    this.justReleased = false;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _getCanvasPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      t: performance.now() / 1000
    };
  }

  _handlePress(x, y, t) {
    this.isPressed = true;
    this.pressStartTime = t;
    this.swipePath = [{ x, y, t }];
    this.swipe = null;
    this.justPressed = true;
  }

  _handleMove(x, y, t) {
    if (!this.isPressed) return;
    this.swipePath.push({ x, y, t });
  }

  _handleRelease(x, y, t) {
    if (!this.isPressed) return;
    this.swipePath.push({ x, y, t });

    const first = this.swipePath[0];
    const last = this.swipePath[this.swipePath.length - 1];
    const dx = last.x - first.x;
    const absDx = Math.abs(dx);

    if (absDx >= SWING.swipeMinDistance) {
      // Valid swipe — build normalized path relative to canvas
      const canvasW = this.canvas.width;
      const canvasH = this.canvas.height;

      const normalizedPath = this.swipePath.map(p => ({
        x: p.x / canvasW,
        y: p.y / canvasH,
        t: p.t
      }));

      // Average Y across the swipe (for plane matching)
      const avgY = normalizedPath.reduce((sum, p) => sum + p.y, 0) / normalizedPath.length;

      this.swipe = {
        path: normalizedPath,
        rawPath: this.swipePath,
        avgY,
        startY: normalizedPath[0].y,
        endY: normalizedPath[normalizedPath.length - 1].y,
        time: t,
        duration: t - first.t,
      };
      this.justSwiped = true;
    }

    this.isPressed = false;
    this.justReleased = true;
  }

  // Mouse
  _onMouseDown(e) {
    e.preventDefault();
    const p = this._getCanvasPos(e.clientX, e.clientY);
    this._handlePress(p.x, p.y, p.t);
  }
  _onMouseMove(e) {
    const p = this._getCanvasPos(e.clientX, e.clientY);
    this._handleMove(p.x, p.y, p.t);
  }
  _onMouseUp(e) {
    const p = this._getCanvasPos(e.clientX, e.clientY);
    this._handleRelease(p.x, p.y, p.t);
  }

  // Touch
  _onTouchStart(e) {
    e.preventDefault();
    const p = this._getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
    this._handlePress(p.x, p.y, p.t);
  }
  _onTouchMove(e) {
    e.preventDefault();
    const p = this._getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
    this._handleMove(p.x, p.y, p.t);
  }
  _onTouchEnd(e) {
    e.preventDefault();
    const p = this._getCanvasPos(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    this._handleRelease(p.x, p.y, p.t);
  }

  resetFrame() {
    this.justPressed = false;
    this.justReleased = false;
    this.justSwiped = false;
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
  }
}
