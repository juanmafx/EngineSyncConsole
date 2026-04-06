import { AIRCRAFT_LIMITS, ENGINE_COUNT, FUEL_CAPACITY_LB } from './constants';
import { estimateSpeedCapabilityKt } from '../telemetry/results';

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const emptyEngines = () => Array.from({ length: ENGINE_COUNT }, () => 0);
const totalFuelCapacityLb = Object.values(FUEL_CAPACITY_LB).reduce((a, b) => a + b, 0);
const ENGINE_MAX_THRUST_LBF = 17000; // TF33/JT3D class baseline
const TSFC_BASE = 0.76;
const N1_MAX_RPM = 8800;
const N2_MAX_RPM = 11200;

function deriveEngineOutputs({ throttle, N1, N2, health, antiIce, boost, targetEpr, engineIndex, avgThrottle }) {
  const thrustFrac = clamp((N1 - 30) / 70, 0, 1);
  const n1Rpm = (N1 / 100) * N1_MAX_RPM;
  const n2Rpm = (N2 / 100) * N2_MAX_RPM;
  const thrustLbf = ENGINE_MAX_THRUST_LBF * Math.pow(thrustFrac, 2.25) * health;

  const tsfc = TSFC_BASE + (throttle > 0.82 ? (throttle - 0.82) * 0.1 : 0) + (1 - health) * 0.03;
  const idleFlow = 1180 + engineIndex * 16;
  const boostAdj = boost ? 1.02 : 0.985;
  const fuelFlow = (idleFlow + thrustLbf * tsfc) * boostAdj;

  const coreFrac = clamp((N2 - 60) / 40, 0, 1);
  const egtBase = 330 + Math.pow(coreFrac, 1.18) * 435;
  const egtSpread = (engineIndex % 3) * 4;
  const egt = clamp(egtBase + egtSpread + (antiIce ? 9 : 0) + (1 - health) * 130, 300, 805);

  const oilPressure = clamp(18 + N2 * 0.42 + (boost ? 1.5 : -2.5) - (engineIndex % 4) * 0.6 - (1 - health) * 10, 20, 70);
  const oilTemp = clamp(68 + coreFrac * 56 + (engineIndex % 3) * 1.4 + (1 - health) * 12, 62, 136);

  const thrustNormalized = clamp(thrustLbf / ENGINE_MAX_THRUST_LBF, 0, 1);
  const baseEpr = 1.1 + Math.pow(thrustNormalized, 0.68) * 1.08;
  const targetBias = (targetEpr - 1.7) * 0.08;
  const epr = clamp(baseEpr + targetBias + (throttle * 100 - avgThrottle) * 0.0018, 1.1, 2.2);

  return {
    n1Rpm,
    n2Rpm,
    rpm: n2Rpm,
    thrustLbf,
    fuelFlow,
    EGT: egt,
    oilPressure,
    oilTemp,
    epr,
  };
}

export function createEngine({ throttle, health = 1, antiIce, boost, targetEpr, engineIndex, avgThrottle }) {
  const command = clamp(throttle, 0, 1);
  const efficiency = 0.985 + Math.random() * 0.03;
  const N2 = clamp((60 + command * 40 + (engineIndex % 3 === 0 ? -0.6 : 0.6)) * efficiency, 60, 100);
  const N1 = clamp((30 + (N2 - 60) * 1.72 + (engineIndex % 2 === 0 ? -0.8 : 0.8)) * efficiency, 30, 100);
  const outputs = deriveEngineOutputs({
    throttle: command,
    N1,
    N2,
    health,
    antiIce,
    boost,
    targetEpr,
    engineIndex,
    avgThrottle,
  });

  return {
    throttle: command,
    health,
    N1,
    N2,
    EGT: outputs.EGT,
    fuelFlow: outputs.fuelFlow,
    oilTemp: outputs.oilTemp,
    oilPressure: outputs.oilPressure,
    thrustLbf: outputs.thrustLbf,
    n1Rpm: outputs.n1Rpm,
    n2Rpm: outputs.n2Rpm,
    rpm: outputs.rpm,
    epr: outputs.epr,
    n1Noise: 0,
    egtNoise: 0,
    efficiency,
  };
}

export function updateEngine(engine, dt, { throttle, health = 1, antiIce, boost, targetEpr, engineIndex, avgThrottle }) {
  const command = clamp(throttle, 0, 1);
  const nextHealth = clamp(health, 0.5, 1);
  const efficiency = clamp(engine.efficiency ?? 1, 0.97, 1.03);

  const n2Target = clamp((60 + command * 40 + (engineIndex % 3 === 0 ? -0.6 : 0.6)) * efficiency, 60, 100);
  const n2Tau = n2Target > engine.N2 ? 4.6 : 7.4; // slow legacy spool response
  const N2 = clamp(engine.N2 + ((n2Target - engine.N2) * dt) / n2Tau, 60, 100);

  const n1Target = clamp((30 + (N2 - 60) * 1.72 + (engineIndex % 2 === 0 ? -0.8 : 0.8)) * efficiency, 30, 100);
  const n1Tau = n1Target > engine.N1 ? 5.4 : 8.2;
  const n1Base = clamp(engine.N1 + ((n1Target - engine.N1) * dt) / n1Tau, 30, 100);
  const n1NoiseTarget = (Math.random() - 0.5) * 1.0; // +/-0.5 N1 random variation
  const n1Noise = clamp((engine.n1Noise ?? 0) + (n1NoiseTarget - (engine.n1Noise ?? 0)) * 0.22, -0.5, 0.5);
  const N1 = clamp(n1Base + n1Noise, 30, 100);

  const outputs = deriveEngineOutputs({
    throttle: command,
    N1,
    N2,
    health: nextHealth,
    antiIce,
    boost,
    targetEpr,
    engineIndex,
    avgThrottle,
  });
  const egtNoiseTarget = (Math.random() - 0.5) * 10; // +/-5 EGT random variation
  const egtNoise = clamp((engine.egtNoise ?? 0) + (egtNoiseTarget - (engine.egtNoise ?? 0)) * 0.14, -5, 5);
  const egt = clamp(outputs.EGT + egtNoise, 300, 805);

  return {
    throttle: command,
    health: nextHealth,
    N1,
    N2,
    EGT: egt,
    fuelFlow: outputs.fuelFlow,
    oilTemp: outputs.oilTemp,
    oilPressure: outputs.oilPressure,
    thrustLbf: outputs.thrustLbf,
    n1Rpm: outputs.n1Rpm,
    n2Rpm: outputs.n2Rpm,
    rpm: outputs.rpm,
    epr: outputs.epr,
    n1Noise,
    egtNoise,
    efficiency,
  };
}

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

export function initSimulation(throttles, targetEpr, antiIce, boost) {
  const avgThrottle = throttles.reduce((a, b) => a + b, 0) / ENGINE_COUNT;
  const engines = throttles.map((throttle, i) =>
    createEngine({
      throttle: throttle / 100,
      health: 1,
      antiIce,
      boost,
      targetEpr,
      engineIndex: i,
      avgThrottle,
    }),
  );

  return {
    engines,
    epr: engines.map((engine) => engine.epr),
    n1Pct: engines.map((engine) => engine.N1),
    n2Pct: engines.map((engine) => engine.N2),
    n1Rpm: engines.map((engine) => engine.n1Rpm),
    n2Rpm: engines.map((engine) => engine.n2Rpm),
    rpm: engines.map((engine) => engine.rpm),
    egt: engines.map((engine) => engine.EGT),
    oilPressure: engines.map((engine) => engine.oilPressure),
    oilTemp: engines.map((engine) => engine.oilTemp),
    fuelFlow: engines.map((engine) => engine.fuelFlow),
    thrustLbf: engines.map((engine) => engine.thrustLbf),
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
