import { clamp } from '../math/numeric.js';

export const AUTOTHROTTLE_OVERRIDE_MS = 5000;
export const AUTOTHROTTLE_PERIOD_MS = 100;
const SLEW_PER_UPDATE_PCT = 1.6;
const MAX_THROTTLE_PCT = 92;
const MIN_THROTTLE_PCT = 15;
const INTEGRATOR_LIMIT_PCT = 10;
export const INTEGRATOR_DECAY = 0.92;

export function computeAutothrottleTarget({
  targetAirspeedKt,
  currentAirspeedKt,
  verticalSpeedFpm,
  fullThrottleCapabilityKt,
  integrator,
}) {
  const achievableTargetKt = Math.min(targetAirspeedKt, Math.max(190, fullThrottleCapabilityKt - 4));
  const speedError = achievableTargetKt - currentAirspeedKt;
  const climbCompensation = Math.max(0, verticalSpeedFpm) * 0.0015;
  const baseDemand = 32 + (achievableTargetKt - 180) * 0.14;
  const nextIntegrator = clamp(integrator + speedError * 0.007, -INTEGRATOR_LIMIT_PCT, INTEGRATOR_LIMIT_PCT);
  const throttleTarget = clamp(
    baseDemand + speedError * 0.13 + nextIntegrator + climbCompensation,
    MIN_THROTTLE_PCT,
    MAX_THROTTLE_PCT,
  );

  return { throttleTarget, nextIntegrator };
}

export const slewThrottles = (throttles, throttleTarget) =>
  throttles.map((throttle) => {
    const step = clamp(throttleTarget - throttle, -SLEW_PER_UPDATE_PCT, SLEW_PER_UPDATE_PCT);
    return Math.round(clamp(throttle + step, 0, 100) * 10) / 10;
  });
