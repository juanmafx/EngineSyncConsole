import { AIRCRAFT_LIMITS, ENGINE_COUNT, FUEL_CAPACITY_LB } from './constants';
import { estimateSpeedCapabilityKt } from '../telemetry/results';

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const emptyEngines = () => Array.from({ length: ENGINE_COUNT }, () => 0);
const totalFuelCapacityLb = Object.values(FUEL_CAPACITY_LB).reduce((a, b) => a + b, 0);

export function estimateAttainableSpeedKt({ avgThrottlePct, altitudeFt, verticalSpeedFpm, fuelRemainingLb }) {
  return clamp(
    estimateSpeedCapabilityKt({
      avgThrottlePct,
      altitudeFt,
      verticalSpeedFpm,
      fuelRemainingLb: fuelRemainingLb ?? totalFuelCapacityLb,
      airspeedKt: AIRCRAFT_LIMITS.maxSpeedKt * 0.72,
      boost: true,
      antiIce: false,
      faultEnabled: false,
    }),
    180,
    AIRCRAFT_LIMITS.maxSpeedKt,
  );
}

export function getTargets({ throttles, targetEpr, antiIce, boost }) {
  const avgThrottle = throttles.reduce((a, b) => a + b, 0) / ENGINE_COUNT;

  return {
    epr: throttles.map((t, i) => targetEpr + (t - avgThrottle) * 0.004 + (i % 2 === 0 ? -0.008 : 0.008)),
    rpm: throttles.map((t, i) => 3900 + t * 21 + i * 10),
    egt: throttles.map((t, i) => 340 + t * 4.5 + (i % 3) * 5 + (antiIce ? -12 : 0)),
    oilPressure: throttles.map((t, i) => 30 + t * 0.4 + (boost ? 2 : -2) - (i % 4) * 0.7),
    oilTemp: throttles.map((t, i) => 62 + t * 0.82 + (i % 3) * 1.5),
    fuelFlow: throttles.map((t, i) => 1200 + t * 38 + i * 16 + (boost ? 120 : 0)),
  };
}

export function initSimulation(throttles, targetEpr, antiIce, boost) {
  const targets = getTargets({ throttles, targetEpr, antiIce, boost });

  return {
    ...targets,
    trendRates: emptyEngines(),
    tankQty: { ...FUEL_CAPACITY_LB },
    elapsedSeconds: 0,
    distanceNm: 0,
    fuelUsedLb: 0,
    altitudeFt: 34000,
    headingDeg: 90,
    airspeedKt: 442,
    verticalSpeedFpm: 0,
  };
}
