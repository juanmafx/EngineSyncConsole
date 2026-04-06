import { useMemo } from 'react';
import { ENGINE_COUNT, FUEL_CAPACITY_LB } from './constants';
import { clamp } from './flightModel';
import { calculateTelemetryResult } from '../telemetry/results';

const totalFuelCapacityLb = Object.values(FUEL_CAPACITY_LB).reduce((a, b) => a + b, 0);

export function useMetrics({ sim, throttles, antiIce, bleedAir, boost, transfer, faultEnabled }) {
  return useMemo(() => {
    const avgThrottle = throttles.reduce((a, b) => a + b, 0) / ENGINE_COUNT;

    const totalFuelFlow = sim.fuelFlow.reduce((a, b) => a + b, 0);
    const totalFuelCapacity = totalFuelCapacityLb;
    const totalFuelRemaining = Object.values(sim.tankQty).reduce((a, b) => a + b, 0);
    const fuelRemainingPct = totalFuelCapacity > 0 ? (totalFuelRemaining / totalFuelCapacity) * 100 : 0;
    const telemetry = calculateTelemetryResult({
      avgThrottlePct: avgThrottle,
      altitudeFt: sim.altitudeFt,
      verticalSpeedFpm: 0,
      fuelRemainingLb: totalFuelRemaining,
      airspeedKt: sim.airspeedKt,
      boost,
      antiIce,
      faultEnabled,
    });
    const cruiseEstimateKt = telemetry.throttleCapabilityKt;
    const enduranceHours = totalFuelFlow > 0 ? totalFuelRemaining / totalFuelFlow : 0;
    const rangeNm = enduranceHours * cruiseEstimateKt;

    const leftBank = throttles.slice(0, 4).reduce((a, b) => a + b, 0);
    const rightBank = throttles.slice(4).reduce((a, b) => a + b, 0);
    const symmetryDelta = Math.abs(leftBank - rightBank) / 4;

    const hydraulicPressure = clamp(2300 + avgThrottle * 7 - (bleedAir ? 70 : 0), 1400, 3200);
    const busA = clamp(26.5 + (boost ? 0.8 : -0.7), 22, 29);
    const busB = clamp(26.1 + (boost ? 0.7 : -0.9), 22, 29);

    const generatorOnline = sim.rpm.map((v) => v > 5000);
    const iceAlarmActive = !antiIce;
    const hasMasterWarning = sim.egt.some((v) => v > 680);
    const cautionCount = [
      ...sim.egt.map((v) => v > 650),
      ...sim.oilPressure.map((v) => v < 34),
      ...sim.oilTemp.map((v) => v > 123),
      ...sim.trendRates.map((v) => Math.abs(v) > 7),
      faultEnabled,
      symmetryDelta > 2.2,
      !boost,
      !transfer,
      iceAlarmActive,
    ].filter(Boolean).length;
    const hasMasterCaution = cautionCount > 0;

    return {
      epr: sim.epr,
      rpm: sim.rpm,
      egt: sim.egt,
      oilPressure: sim.oilPressure,
      oilTemp: sim.oilTemp,
      trend: sim.trendRates,
      fuelFlowPerEngine: sim.fuelFlow,
      totalFuelFlow,
      totalFuelCapacity,
      totalFuelRemaining,
      fuelRemainingPct,
      enduranceHours,
      rangeNm,
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
      hydraulicPressure,
      busA,
      busB,
      generatorOnline,
      telemetry,
      cautionCount,
      hasMasterCaution,
      hasMasterWarning,
      iceAlarmActive,
    };
  }, [antiIce, bleedAir, boost, faultEnabled, sim, throttles, transfer]);
}
