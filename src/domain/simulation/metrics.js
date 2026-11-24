import { AIRCRAFT_MASS, ENGINE_COUNT, FUEL_CAPACITY_LB } from '../aircraft/constants.js';
import { ALERT_THRESHOLDS as LIMITS } from '../alerts/thresholds.js';
import { totalFuelLb } from '../fuel/fuelSystem.js';
import { clamp, sum } from '../math/numeric.js';
import { calculateTelemetryResult } from '../telemetry/performance.js';

const TOTAL_FUEL_CAPACITY_LB = totalFuelLb(FUEL_CAPACITY_LB);
const GENERATOR_ONLINE_N2_RPM = 7000;

export function computeMetrics({ sim, throttles, antiIce, bleedAir, boost, transfer, faultEnabled, payloadLb }) {
  const avgThrottle = sum(throttles) / ENGINE_COUNT;
  const totalFuelFlow = sum(sim.fuelFlow);
  const totalFuelRemaining = totalFuelLb(sim.tankQty);
  const fuelRemainingPct = (totalFuelRemaining / TOTAL_FUEL_CAPACITY_LB) * 100;
  const telemetry = calculateTelemetryResult({
    avgThrottlePct: avgThrottle,
    altitudeFt: sim.altitudeFt,
    verticalSpeedFpm: sim.verticalSpeedFpm,
    fuelRemainingLb: totalFuelRemaining,
    payloadLb,
    airspeedKt: sim.airspeedKt,
    boost,
    antiIce,
    faultEnabled,
    availableThrustLbf: sum(sim.thrustLbf),
  });
  const cruiseEstimateKt = telemetry.throttleCapabilityKt;
  const enduranceHours = totalFuelFlow > 0 ? totalFuelRemaining / totalFuelFlow : 0;
  const rangeNm = enduranceHours * cruiseEstimateKt;
  const payloadClamped = clamp(payloadLb, 0, AIRCRAFT_MASS.maxPayloadLb);
  const grossWeightLb = AIRCRAFT_MASS.emptyWeightLb + totalFuelRemaining + payloadClamped;
  const mtowPct = (grossWeightLb / AIRCRAFT_MASS.maxTakeoffWeightLb) * 100;
  const payloadRatio = payloadClamped / AIRCRAFT_MASS.maxPayloadLb;
  const projectedFerryRangeNm = rangeNm * (1.05 + (1 - payloadRatio) * 0.08);
  const projectedCombatRangeNm = rangeNm * (0.74 + (1 - payloadRatio) * 0.08);

  const symmetryDelta = Math.abs(sum(throttles.slice(0, 4)) - sum(throttles.slice(4))) / 4;
  const tankImbalanceLb = Math.abs(sim.tankQty.leftWing - sim.tankQty.rightWing);
  const tankImbalancePct = (tankImbalanceLb / TOTAL_FUEL_CAPACITY_LB) * 100;

  const hydraulicPressure = clamp(2300 + avgThrottle * 7 - (bleedAir ? 70 : 0), 1400, 3200);
  const busA = clamp(26.5 + (boost ? 0.8 : -0.7), 22, 29);
  const busB = clamp(26.1 + (boost ? 0.7 : -0.9), 22, 29);
  const generatorOnline = sim.n2Rpm.map((value) => value > GENERATOR_ONLINE_N2_RPM);
  const iceAlarmActive = !antiIce;
  const hasMasterWarning = sim.egt.some((value) => value > LIMITS.egtWarningC);
  const cautionCount = [
    ...sim.egt.map((value) => value > LIMITS.egtCautionC),
    ...sim.oilPressure.map((value) => value < LIMITS.oilPressureLowPsi),
    ...sim.oilTemp.map((value) => value > LIMITS.oilTemperatureHighC),
    ...sim.trendRates.map((value) => Math.abs(value) > LIMITS.egtTrendAbnormalCPerSecond),
    faultEnabled,
    tankImbalancePct > LIMITS.fuelImbalancePct,
    symmetryDelta > LIMITS.throttleAsymmetryPct,
    !boost,
    !transfer,
    iceAlarmActive,
  ].filter(Boolean).length;

  return {
    epr: sim.epr,
    n1Pct: sim.n1Pct,
    n2Pct: sim.n2Pct,
    n1Rpm: sim.n1Rpm,
    n2Rpm: sim.n2Rpm,
    rpm: sim.rpm,
    egt: sim.egt,
    oilPressure: sim.oilPressure,
    oilTemp: sim.oilTemp,
    trend: sim.trendRates,
    fuelFlowPerEngine: sim.fuelFlow,
    totalFuelFlow,
    totalFuelCapacity: TOTAL_FUEL_CAPACITY_LB,
    totalFuelRemaining,
    fuelRemainingPct,
    enduranceHours,
    rangeNm,
    projectedFerryRangeNm,
    projectedCombatRangeNm,
    payloadLb: payloadClamped,
    emptyWeightLb: AIRCRAFT_MASS.emptyWeightLb,
    grossWeightLb,
    mtowPct,
    tankImbalanceLb,
    tankImbalancePct,
    symmetryDelta,
    tankQty: sim.tankQty,
    tankPct: {
      fwd: (sim.tankQty.fwd / FUEL_CAPACITY_LB.fwd) * 100,
      aft: (sim.tankQty.aft / FUEL_CAPACITY_LB.aft) * 100,
      leftWing: (sim.tankQty.leftWing / FUEL_CAPACITY_LB.leftWing) * 100,
      rightWing: (sim.tankQty.rightWing / FUEL_CAPACITY_LB.rightWing) * 100,
    },
    tripHours: sim.elapsedSeconds / 3600,
    tripDistanceNm: sim.distanceNm,
    fuelUsedLb: sim.fuelUsedLb,
    cruiseKts: cruiseEstimateKt,
    altitudeFt: sim.altitudeFt,
    headingDeg: sim.headingDeg,
    airspeedKt: sim.airspeedKt,
    verticalSpeedFpm: sim.verticalSpeedFpm,
    afcsSaturated: Boolean(sim.afcsSaturated),
    hydraulicPressure,
    busA,
    busB,
    generatorOnline,
    telemetry,
    cautionCount,
    hasMasterCaution: cautionCount > 0,
    hasMasterWarning,
    iceAlarmActive,
  };
}
