import { AIRCRAFT_LIMITS, AIRCRAFT_MASS, ENGINE_COUNT, FUEL_CAPACITY_LB } from '../../sim/constants';

const MAX_THRUST_PER_ENGINE_LBF = 17100;
const TOTAL_MAX_THRUST_LBF = MAX_THRUST_PER_ENGINE_LBF * ENGINE_COUNT;
const TOTAL_FUEL_CAPACITY_LB = Object.values(FUEL_CAPACITY_LB).reduce((a, b) => a + b, 0);
const KNOT_TO_FPS = 1.68781;

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
  availableThrustLbf,
}) {
  const throttleFrac = clamp(avgThrottlePct / 100, 0, 1);
  const densityRatio = densityRatioAtAltitude(altitudeFt);
  const thrustLapse = 0.55 + densityRatio * 0.45;
  const boostFactor = boost ? 1.04 : 0.98;
  const antiIceFactor = antiIce ? 0.97 : 1;
  const faultFactor = faultEnabled ? ((ENGINE_COUNT - 1) + 0.72) / ENGINE_COUNT : 1;
  const fuelRatio = clamp(fuelRemainingLb / TOTAL_FUEL_CAPACITY_LB, 0, 1);
  const clampedPayloadLb = clamp(payloadLb, 0, AIRCRAFT_MASS.maxPayloadLb);
  const grossWeightLb = AIRCRAFT_MASS.emptyWeightLb + clampedPayloadLb + fuelRemainingLb;
  const weightRatio = clamp(grossWeightLb / AIRCRAFT_MASS.maxTakeoffWeightLb, 0.45, 1.2);

  const speedKt = clamp(airspeedKt, 150, AIRCRAFT_LIMITS.maxSpeedKt);
  const speedRatio = speedKt / AIRCRAFT_LIMITS.maxSpeedKt;
  const speedFps = speedKt * KNOT_TO_FPS;

  const baseDrag = TOTAL_MAX_THRUST_LBF * (0.12 + (1 - densityRatio) * 0.015);
  const weightDrag = TOTAL_MAX_THRUST_LBF * clamp((weightRatio - 0.55) * 0.22, 0.02, 0.2);
  const inducedDrag = TOTAL_MAX_THRUST_LBF * (0.06 + Math.pow(weightRatio, 1.1) * 0.055) / Math.max(0.35, speedRatio * speedRatio);
  const parasiticDrag = TOTAL_MAX_THRUST_LBF * (0.05 + Math.pow(speedRatio, 2) * 0.5);
  const configPenalty = TOTAL_MAX_THRUST_LBF * (antiIce ? 0.012 : 0);
  const verticalEnergyDrag = TOTAL_MAX_THRUST_LBF * Math.max(0, verticalSpeedFpm) * 0.00004;
  const descentAssist = TOTAL_MAX_THRUST_LBF * Math.max(0, -verticalSpeedFpm) * 0.000015;

  const fullThrottleCapabilityKt = clamp(
    AIRCRAFT_LIMITS.maxSpeedKt *
      clamp(0.6 + thrustLapse * 0.5 - (weightRatio - 0.6) * 0.28 - (antiIce ? 0.02 : 0), 0.45, 1),
    240,
    AIRCRAFT_LIMITS.maxSpeedKt,
  );
  const throttleCapabilityKt = clamp(
    180 + (fullThrottleCapabilityKt - 180) * Math.pow(throttleFrac, 0.72),
    180,
    fullThrottleCapabilityKt,
  );

  const modeledThrustAvailableLbf =
    TOTAL_MAX_THRUST_LBF * throttleFrac * thrustLapse * boostFactor * antiIceFactor * faultFactor;
  const thrustAvailableLbf = availableThrustLbf ?? modeledThrustAvailableLbf;

  const thrustRequiredLbf = clamp(
    baseDrag + weightDrag + inducedDrag + parasiticDrag + configPenalty + verticalEnergyDrag - descentAssist,
    TOTAL_MAX_THRUST_LBF * 0.06,
    TOTAL_MAX_THRUST_LBF * 1.15,
  );
  const thrustMarginLbf = thrustAvailableLbf - thrustRequiredLbf;
  const excessPowerFtLbPerSec = thrustMarginLbf * speedFps;
  const climbCapabilityFpm = clamp(
    grossWeightLb > 0 ? (excessPowerFtLbPerSec / grossWeightLb) * 60 : 0,
    -4000,
    4000,
  );

  return {
    thrustAvailableLbf,
    thrustRequiredLbf,
    thrustMarginLbf,
    thrustPctOfMax: (thrustAvailableLbf / TOTAL_MAX_THRUST_LBF) * 100,
    throttleCapabilityKt,
    fullThrottleCapabilityKt,
    speedUtilizationPct: (speedKt / AIRCRAFT_LIMITS.maxSpeedKt) * 100,
    ceilingMarginFt: AIRCRAFT_LIMITS.ceilingFt - altitudeFt,
    grossWeightLb,
    weightRatio,
    payloadLb: clampedPayloadLb,
    fuelRatio,
    climbCapabilityFpm,
  };
}

export function estimateSpeedCapabilityKt(input) {
  return calculateTelemetryResult(input).throttleCapabilityKt;
}
