// ============================================================================
// Big Dongos — Game Constants
// All tunable values in one place for easy balancing
// ============================================================================

// --- Canvas ---
export const CANVAS_BG = '#0a0a14';

// --- Colors (retro neon palette) ---
export const COLORS = {
  neonBlue: '#19b8ff',
  neonPink: '#ff2998',
  neonGreen: '#39ff14',
  neonYellow: '#ffff00',
  neonOrange: '#ff6600',
  white: '#ffffff',
  dimWhite: 'rgba(255,255,255,0.3)',
  grass: '#1a4d1a',
  dirt: '#8B6914',
  dirtLight: '#a67c00',
  sky: '#0a0a14',
  mound: '#a67c00',
};

// --- Power Meter ---
export const POWER = {
  fillDuration: 1.2,        // seconds to reach 100%
  sweetSpotMin: 0.65,       // 65% — sweet spot lower bound
  sweetSpotMax: 0.85,       // 85% — sweet spot upper bound
  overPowerVariance: 0.10,  // max random variance added to swing plane when overpowered
  underPowerScale: 0.6,     // minimum exit velo multiplier at 0% power
};

// --- Pitch ---
export const PITCH = {
  speedMin: 85,              // MPH minimum
  speedMax: 95,              // MPH maximum
  windupDuration: 2.0,       // seconds of windup before pitch is released
  travelDurationMin: 1.3,    // fastest pitch travel time
  travelDurationMax: 1.7,    // slowest pitch travel time
  // The ball spends this fraction of its travel inside the zone box
  // e.g., enters at 65% progress, exits at 85% progress
  zoneEntryProgress: 0.80,
  zoneExitProgress: 0.90,
  // Strike zone position (normalized 0-1, where 0=top of zone, 1=bottom)
  zoneYMin: 0.15,
  zoneYMax: 0.85,
};

// --- Swing / Timing ---
export const SWING = {
  perfectWindow: 0.045,     // ±45ms for perfect timing (was 35)
  goodWindow: 0.100,        // ±100ms for good timing (was 85)
  contactWindow: 0.180,     // ±180ms — beyond this is a whiff (was 150)
  planeWhiffThreshold: 0.18, // distance to ball > this = complete whiff (normalized to zone height)
  planeWeakThreshold: 0.07,  // distance > this = weak contact
  swipeMinDistance: 20,      // minimum horizontal swipe distance in pixels
};

// --- Contact / Exit Velocity ---
export const CONTACT = {
  exitVeloMin: 65,           // mph — weakest possible contact
  exitVeloMax: 135,          // mph — absolute max (perfect everything)
  exitVeloSweetSpot: 110,    // mph — sweet spot power gives this base
  launchAngleMin: 12,        // degrees — lowest possible launch
  launchAngleMax: 45,        // degrees — highest possible launch
  launchAngleIdeal: 28,      // degrees — optimal for distance
};

// --- Ball Flight Physics ---
export const FLIGHT = {
  gravity: 32.174,           // ft/s²
  dragCoefficient: 0.0032,   // simplified air drag factor (lower = balls carry further)
  animationDuration: 2.0,    // seconds for flight animation
  maxDistance: 520,           // feet — theoretical max
  markers: [100, 200, 300, 400, 500],
};

// --- Game Flow ---
export const GAME = {
  warmupSwings: 5,
  realSwings: 5,
  swingsPerAttempt: 10,  // warmup + real
  maxAttempts: 1,
  titleHoldDuration: 0.5,
  resultHoldDuration: 2.0,
  whiffDisplayDuration: 1.2,
  shakeIntensity: 8,
  shakeDuration: 0.3,
};

// --- Rendering ---
export const RENDER = {
  // Classic batting view — batter on left, strike zone center-right
  horizonY: 0.30,            // horizon line (higher = more sky)
  moundY: 0.42,              // pitcher's mound Y position
  // Strike zone box — center of screen, knees-to-shoulders height
  zoneLeft: 0.40,
  zoneRight: 0.62,
  zoneTop: 0.38,
  zoneBottom: 0.72,
  // Batter — full body on the left side
  batterX: 0.22,             // batter center X position
  batterBottom: 0.82,        // feet position (Y)
  batterScale: 1.5,          // size multiplier
  // Power meter bar (left side)
  meterX: 0.04,
  meterWidth: 0.025,
  meterTop: 0.25,
  meterBottom: 0.75,
  // Ball sizes (perspective — small at pitcher, large at plate)
  ballStartRadius: 2,
  ballEndRadius: 16,
  // Flight scene
  flightFieldPadding: 0.08,
};
