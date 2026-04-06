import { AIRCRAFT_LIMITS, ENGINE_COUNT, FUEL_CAPACITY_LB } from './constants';
import { estimateSpeedCapabilityKt } from '../telemetry/results';

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const emptyEngines = () => Array.from({ length: ENGINE_COUNT }, () => 0);
const totalFuelCapacityLb = Object.values(FUEL_CAPACITY_LB).reduce((a, b) => a + b, 0);
const ENGINE_MAX_THRUST_LBF = 17000;
const TSFC_BASE = 0.76;

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
  const throttleFrac = throttles.map((t) => clamp(t / 100, 0, 1));
  const n1Pct = throttleFrac.map((f, i) => clamp(30 + f * 70 + (i % 2 === 0 ? -0.8 : 0.8), 30, 100));
  const n2Pct = throttleFrac.map((f, i) => clamp(60 + f * 40 + (i % 3 === 0 ? -0.6 : 0.6), 60, 100));
  const n1Rpm = n1Pct.map((pct) => (pct / 100) * 8800);
  const n2Rpm = n2Pct.map((pct) => (pct / 100) * 11200);
  const thrustLbf = n1Pct.map((pct) => {
    const frac = clamp((pct - 30) / 70, 0, 1);
    // Old low-bypass turbofan response: thrust rises strongly near the upper spool range.
    return ENGINE_MAX_THRUST_LBF * Math.pow(frac, 2.25);
  });
  const tsfc = throttleFrac.map((f) => TSFC_BASE + (f > 0.82 ? (f - 0.82) * 0.1 : 0));
  const fuelFlow = thrustLbf.map((thrust, i) => {
    const idleFlow = 1180 + i * 16;
    const baseFlow = idleFlow + thrust * tsfc[i];
    const boostAdj = boost ? 1.02 : 0.985;
    return baseFlow * boostAdj;
  });
  const egt = n2Pct.map((pct, i) => {
    const coreFrac = clamp((pct - 60) / 40, 0, 1);
    const base = 330 + Math.pow(coreFrac, 1.18) * 435;
    const engineSpread = (i % 3) * 4;
    const antiIceAdj = antiIce ? 9 : 0;
    return clamp(base + engineSpread + antiIceAdj, 300, 805);
  });
  const oilPressure = n2Pct.map((pct, i) => clamp(18 + pct * 0.42 + (boost ? 1.5 : -2.5) - (i % 4) * 0.6, 24, 70));
  const oilTemp = n2Pct.map((pct, i) => {
    const coreFrac = clamp((pct - 60) / 40, 0, 1);
    return clamp(68 + coreFrac * 56 + (i % 3) * 1.4, 62, 136);
  });
  const epr = thrustLbf.map((thrust, i) => {
    const thrustFrac = clamp(thrust / ENGINE_MAX_THRUST_LBF, 0, 1);
    const baseEpr = 1.1 + Math.pow(thrustFrac, 0.68) * 1.08;
    const targetBias = (targetEpr - 1.7) * 0.08;
    return clamp(baseEpr + targetBias + (throttles[i] - avgThrottle) * 0.0018, 1.1, 2.2);
  });

  return {
    epr,
    n1Pct,
    n2Pct,
    n1Rpm,
    n2Rpm,
    rpm: n2Rpm,
    egt,
    oilPressure,
    oilTemp,
    fuelFlow,
    thrustLbf,
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
