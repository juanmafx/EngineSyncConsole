import { clamp, lagToward } from '../math/numeric.js';

const ENGINE_MAX_THRUST_LBF = 17000;
const TSFC_BASE = 0.76;
const N1_MAX_RPM = 8800;
const N2_MAX_RPM = 11200;
const N2_TAU_UP_SECONDS = 4.6;
const N2_TAU_DOWN_SECONDS = 7.4;
const N1_TAU_UP_SECONDS = 5.4;
const N1_TAU_DOWN_SECONDS = 8.2;
const N1_NOISE_TAU_SECONDS = 2.01;
const EGT_NOISE_TAU_SECONDS = 3.32;
const N1_NOISE_AMPLITUDE_PCT = 0.5;
const EGT_NOISE_AMPLITUDE_C = 5;

const n2TargetPct = (command, engineIndex, efficiency) =>
  clamp((60 + command * 40 + (engineIndex % 3 === 0 ? -0.6 : 0.6)) * efficiency, 60, 100);

const n1TargetPct = (n2Pct, engineIndex, efficiency) =>
  clamp((30 + (n2Pct - 60) * 1.72 + (engineIndex % 2 === 0 ? -0.8 : 0.8)) * efficiency, 30, 100);

export function deriveEngineOutputs({ throttle, N1, N2, health, antiIce, boost, targetEpr, engineIndex, avgThrottle }) {
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

  return { n1Rpm, n2Rpm, rpm: n2Rpm, thrustLbf, fuelFlow, EGT: egt, oilPressure, oilTemp, epr };
}

export function createEngine({ throttle, health = 1, antiIce, boost, targetEpr, engineIndex, avgThrottle }, random) {
  const command = clamp(throttle, 0, 1);
  const efficiency = 0.985 + random() * 0.03;
  const N2 = n2TargetPct(command, engineIndex, efficiency);
  const N1 = n1TargetPct(N2, engineIndex, efficiency);
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

  return { ...outputs, throttle: command, health, N1, N2, n1Core: N1, n1Noise: 0, egtNoise: 0, efficiency };
}

export function updateEngine(engine, dt, { throttle, health = 1, antiIce, boost, targetEpr, engineIndex, avgThrottle }, random) {
  const command = clamp(throttle, 0, 1);
  const nextHealth = clamp(health, 0.5, 1);
  const efficiency = clamp(engine.efficiency ?? 1, 0.97, 1.03);

  const n2Target = n2TargetPct(command, engineIndex, efficiency);
  const n2Tau = n2Target > engine.N2 ? N2_TAU_UP_SECONDS : N2_TAU_DOWN_SECONDS;
  const N2 = clamp(lagToward(engine.N2, n2Target, dt, n2Tau), 60, 100);

  const previousCore = engine.n1Core ?? engine.N1;
  const n1Target = n1TargetPct(N2, engineIndex, efficiency);
  const n1Tau = n1Target > previousCore ? N1_TAU_UP_SECONDS : N1_TAU_DOWN_SECONDS;
  const n1Core = clamp(lagToward(previousCore, n1Target, dt, n1Tau), 30, 100);
  const n1NoiseTarget = (random() - 0.5) * 2 * N1_NOISE_AMPLITUDE_PCT;
  const n1Noise = clamp(
    lagToward(engine.n1Noise ?? 0, n1NoiseTarget, dt, N1_NOISE_TAU_SECONDS),
    -N1_NOISE_AMPLITUDE_PCT,
    N1_NOISE_AMPLITUDE_PCT,
  );
  const N1 = clamp(n1Core + n1Noise, 30, 100);

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
  const egtNoiseTarget = (random() - 0.5) * 2 * EGT_NOISE_AMPLITUDE_C;
  const egtNoise = clamp(
    lagToward(engine.egtNoise ?? 0, egtNoiseTarget, dt, EGT_NOISE_TAU_SECONDS),
    -EGT_NOISE_AMPLITUDE_C,
    EGT_NOISE_AMPLITUDE_C,
  );

  return {
    ...outputs,
    EGT: clamp(outputs.EGT + egtNoise, 300, 805),
    throttle: command,
    health: nextHealth,
    N1,
    N2,
    n1Core,
    n1Noise,
    egtNoise,
    efficiency,
  };
}
