// ============================================================================
// Big Dongos — Physics Engine
// Pitch generation, contact calculation, ball flight distance
// ============================================================================

import { PITCH, POWER, SWING, CONTACT, FLIGHT } from './constants';

// Generate a random pitch (always a fastball in the strike zone)
export function generatePitch(configOverrides) {
  const speed = PITCH.speedMin + Math.random() * (PITCH.speedMax - PITCH.speedMin);
  const zoneY = PITCH.zoneYMin + Math.random() * (PITCH.zoneYMax - PITCH.zoneYMin);
  const zoneX = 0.3 + Math.random() * 0.4;

  // Use config overrides if provided (for live tuning)
  const travelMin = configOverrides?.travelDurationMin ?? PITCH.travelDurationMin;
  const travelMax = configOverrides?.travelDurationMax ?? PITCH.travelDurationMax;

  const speedFraction = (speed - PITCH.speedMin) / (PITCH.speedMax - PITCH.speedMin);
  const travelDuration = travelMax - speedFraction * (travelMax - travelMin);

  return { speed, zoneY, zoneX, travelDuration };
}

// Calculate power factor from the power meter level (0-1)
export function calculatePowerFactor(powerLevel) {
  if (powerLevel <= POWER.sweetSpotMin) {
    // Under-powered: scale from underPowerScale to 1.0
    const t = powerLevel / POWER.sweetSpotMin;
    return POWER.underPowerScale + t * (1 - POWER.underPowerScale);
  } else if (powerLevel <= POWER.sweetSpotMax) {
    // Sweet spot: full power, no penalty
    return 1.0;
  } else {
    // Overpowered: still full power (slightly more even), but accuracy penalty applied elsewhere
    return 1.0;
  }
}

// Calculate plane accuracy variance from overpower
export function calculateOverpowerVariance(powerLevel) {
  if (powerLevel <= POWER.sweetSpotMax) return 0;
  // Scale variance from 0 to max based on how much over the sweet spot
  const overAmount = (powerLevel - POWER.sweetSpotMax) / (1 - POWER.sweetSpotMax);
  return overAmount * POWER.overPowerVariance;
}

// Calculate timing factor (0-1) based on how close the swing was to the pitch arrival
// timingOffset is in seconds (positive = late, negative = early)
export function calculateTimingFactor(timingOffset) {
  const absOffset = Math.abs(timingOffset);

  if (absOffset <= SWING.perfectWindow) {
    return 1.0;
  } else if (absOffset <= SWING.goodWindow) {
    // Linear falloff from 1.0 to 0.7
    const t = (absOffset - SWING.perfectWindow) / (SWING.goodWindow - SWING.perfectWindow);
    return 1.0 - t * 0.3;
  } else if (absOffset <= SWING.contactWindow) {
    // Linear falloff from 0.7 to 0.2
    const t = (absOffset - SWING.goodWindow) / (SWING.contactWindow - SWING.goodWindow);
    return 0.7 - t * 0.5;
  }
  // Beyond contact window = whiff
  return 0;
}

// Calculate plane accuracy based on how close the swipe path came to the ball.
// planeDistance: distance from closest swipe point to ball, normalized to zone height
//   0 = swipe went right through the ball, higher = farther away
export function calculatePlaneAccuracy(planeDistance) {
  if (planeDistance > SWING.planeWhiffThreshold) {
    return 0; // Complete whiff — didn't come close
  } else if (planeDistance > SWING.planeWeakThreshold) {
    // Weak contact: scale from 0.6 down to 0.1
    const t = (planeDistance - SWING.planeWeakThreshold) / (SWING.planeWhiffThreshold - SWING.planeWeakThreshold);
    return 0.6 - t * 0.5;
  } else {
    // Sweet spot: scale from 1.0 to 0.85 (close = still great)
    const t = planeDistance / SWING.planeWeakThreshold;
    return 1.0 - t * 0.15;
  }
}

// Calculate the full contact result
// swingPlaneY is now planeDistance (distance from swipe to ball, normalized to zone height)
export function calculateContact(powerLevel, timingOffset, planeDistance, pitch) {
  const powerFactor = calculatePowerFactor(powerLevel);
  const timingFactor = calculateTimingFactor(timingOffset);
  const planeAccuracy = calculatePlaneAccuracy(planeDistance);

  // Timing label
  const absOffset = Math.abs(timingOffset);
  const timingLabel = absOffset <= SWING.perfectWindow ? 'PERFECT' :
                      timingOffset < 0 ? 'EARLY' : 'LATE';

  // If any factor is 0, it's a whiff
  if (timingFactor === 0 || planeAccuracy === 0) {
    return { isWhiff: true, contactQuality: 0, exitVelocity: 0, launchAngle: 0, distance: 0, timingLabel, timingOffset };
  }

  const contactQuality = powerFactor * timingFactor * planeAccuracy;

  // Exit velocity: use a curve that spreads out the low end more
  // cubic mapping: small quality differences at the top stay close,
  // but weak hits drop off hard
  const veloT = contactQuality * contactQuality * (3 - 2 * contactQuality); // smoothstep
  const exitVelocity = CONTACT.exitVeloMin + veloT * (CONTACT.exitVeloMax - CONTACT.exitVeloMin);

  // Launch angle: good contact → ideal angle, weak → more variance
  const angleBase = CONTACT.launchAngleIdeal;
  const angleVariance = (1 - contactQuality) * 20; // up to ±20° variance
  const launchAngle = angleBase + (Math.random() * 2 - 1) * angleVariance;
  const clampedAngle = Math.max(CONTACT.launchAngleMin, Math.min(CONTACT.launchAngleMax, launchAngle));

  const distance = calculateBallFlightDistance(exitVelocity, clampedAngle);

  return {
    isWhiff: false,
    contactQuality,
    exitVelocity: Math.round(exitVelocity * 10) / 10,
    launchAngle: Math.round(clampedAngle * 10) / 10,
    distance,
    powerFactor,
    timingFactor,
    planeAccuracy,
    timingLabel,
    timingOffset,
  };
}

// Simplified projectile motion with air drag
// Returns distance in feet (with inches precision)
export function calculateBallFlightDistance(exitVeloMph, launchAngleDeg) {
  // Convert to ft/s and radians
  const v0 = exitVeloMph * 5280 / 3600;  // mph to ft/s
  const theta = launchAngleDeg * Math.PI / 180;

  const vx = v0 * Math.cos(theta);
  const vy = v0 * Math.sin(theta);

  // Simulate with small time steps
  const dt = 0.01; // 10ms steps
  let x = 0, y = 3; // start 3 feet up (bat height)
  let curVx = vx, curVy = vy;

  for (let t = 0; t < 10; t += dt) {
    // Air drag (simplified quadratic drag)
    const speed = Math.sqrt(curVx * curVx + curVy * curVy);
    const dragX = -FLIGHT.dragCoefficient * curVx * speed;
    const dragY = -FLIGHT.dragCoefficient * curVy * speed;

    curVx += dragX * dt;
    curVy += (-FLIGHT.gravity + dragY) * dt;

    x += curVx * dt;
    y += curVy * dt;

    if (y <= 0 && t > 0.1) break; // Ball hit the ground
  }

  // Clamp to max distance
  const totalFeet = Math.min(FLIGHT.maxDistance, Math.max(0, x));
  const feet = Math.floor(totalFeet);
  const inches = Math.floor((totalFeet - feet) * 12);

  return { feet, inches, totalFeet };
}
