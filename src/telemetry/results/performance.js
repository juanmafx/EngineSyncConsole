import { AIRCRAFT_LIMITS, AIRCRAFT_MASS, ENGINE_COUNT, FUEL_CAPACITY_LB } from '../../sim/constants';

const MAX_THRUST_PER_ENGINE_LBF = 17100;
const TOTAL_MAX_THRUST_LBF = MAX_THRUST_PER_ENGINE_LBF * ENGINE_COUNT;
const TOTAL_FUEL_CAPACITY_LB = Object.values(FUEL_CAPACITY_LB).reduce((a, b) => a + b, 0);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function densityRatioAtAltitude(altitudeFt) {
  return Math.exp(-Math.max(0, altitudeFt) / 30000);
}

export function calculateTelemetryResult({
  avgThrottlePct,
  altitudeFt,
  verticalSpeedFpm,
  fuelRemainingLb,
  payloadLb = 0,
  airspeedKt,
  boost,
  antiIce,
  faultEnabled,
}) {
  const throttleFrac = clamp(avgThrottlePct / 100, 0, 1);
  const densityRatio = densityRatioAtAltitude(altitudeFt);
  const thrustLapse = 0.55 + densityRatio * 0.45;
  const boostFactor = boost ? 1.04 : 0.98;
  const antiIceFactor = antiIce ? 0.97 : 1;
  const faultFactor = faultEnabled ? ((ENGINE_COUNT - 1) + 0.72) / ENGINE_COUNT : 1;
  const fuelRatio = clamp(fuelRemainingLb / TOTAL_FUEL_CAPACITY_LB, 0, 1);
  const grossWeightLb = AIRCRAFT_MASS.emptyWeightLb + clamp(payloadLb, 0, AIRCRAFT_MASS.maxPayloadLb) + fuelRemainingLb;
  const weightRatio = clamp(grossWeightLb / AIRCRAFT_MASS.maxTakeoffWeightLb, 0.45, 1.2);
  const weightSpeedFactor = clamp(1.12 - (weightRatio - 0.55) * 0.33, 0.78, 1.16);
  const dragWeightFactor = clamp(0.8 + weightRatio * 0.5, 0.85, 1.35);
  const climbPenalty = Math.max(0, verticalSpeedFpm) * 0.00004;
  const descentGain = Math.max(0, -verticalSpeedFpm) * 0.00002;

  const fullThrottleCapabilityKt = clamp(
    AIRCRAFT_LIMITS.maxSpeedKt * thrustLapse * weightSpeedFactor - climbPenalty * 500 + descentGain * 320,
    240,
    AIRCRAFT_LIMITS.maxSpeedKt,
  );
  const throttleCapabilityKt = clamp(
    180 + (fullThrottleCapabilityKt - 180) * Math.pow(throttleFrac, 0.72),
    180,
    fullThrottleCapabilityKt,
  );

  const thrustAvailableLbf =
    TOTAL_MAX_THRUST_LBF * throttleFrac * thrustLapse * boostFactor * antiIceFactor * faultFactor;

  const thrustRequiredLbf =
    TOTAL_MAX_THRUST_LBF *
    (0.16 + Math.pow(clamp(airspeedKt, 180, AIRCRAFT_LIMITS.maxSpeedKt) / AIRCRAFT_LIMITS.maxSpeedKt, 1.85) * 0.56) *
    dragWeightFactor;

  return {
    thrustAvailableLbf,
    thrustRequiredLbf,
    thrustMarginLbf: thrustAvailableLbf - thrustRequiredLbf,
    thrustPctOfMax: (thrustAvailableLbf / TOTAL_MAX_THRUST_LBF) * 100,
    throttleCapabilityKt,
    fullThrottleCapabilityKt,
    speedUtilizationPct: (airspeedKt / AIRCRAFT_LIMITS.maxSpeedKt) * 100,
    ceilingMarginFt: AIRCRAFT_LIMITS.ceilingFt - altitudeFt,
    grossWeightLb,
    weightRatio,
    payloadLb: clamp(payloadLb, 0, AIRCRAFT_MASS.maxPayloadLb),
    fuelRatio,
  };
}

export function estimateSpeedCapabilityKt(input) {
  return calculateTelemetryResult(input).throttleCapabilityKt;
}
