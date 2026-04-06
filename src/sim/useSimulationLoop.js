import { useEffect, useState } from 'react';
import { AIRCRAFT_LIMITS, ENGINE_COUNT, TICK_SECONDS } from './constants';
import { clamp, getTargets, initSimulation } from './flightModel';
import { calculateTelemetryResult } from '../telemetry/results';

export function useSimulationLoop({
  throttles,
  targetEpr,
  antiIce,
  boost,
  faultEnabled,
  faultEngine,
  crossfeed,
  transfer,
  autopilotOn,
  altitudeHold,
  targetAltitudeFt,
  targetVsFpm,
  headingHold,
  navCoupled,
  targetHeadingDeg,
}) {
  const [sim, setSim] = useState(() => initSimulation(throttles, targetEpr, antiIce, boost));

  useEffect(() => {
    const interval = setInterval(() => {
      setSim((prev) => {
        const targets = getTargets({ throttles, targetEpr, antiIce, boost });
        const faultedTargets = {
          epr: [...targets.epr],
          n1Pct: [...targets.n1Pct],
          n2Pct: [...targets.n2Pct],
          n1Rpm: [...targets.n1Rpm],
          n2Rpm: [...targets.n2Rpm],
          rpm: [...targets.rpm],
          egt: [...targets.egt],
          oilPressure: [...targets.oilPressure],
          oilTemp: [...targets.oilTemp],
          fuelFlow: [...targets.fuelFlow],
          thrustLbf: [...targets.thrustLbf],
        };

        if (faultEnabled) {
          faultedTargets.epr[faultEngine] -= 0.2;
          faultedTargets.n1Pct[faultEngine] -= 7;
          faultedTargets.n2Pct[faultEngine] -= 6;
          faultedTargets.n1Rpm[faultEngine] -= 620;
          faultedTargets.n2Rpm[faultEngine] -= 720;
          faultedTargets.rpm[faultEngine] -= 720;
          faultedTargets.egt[faultEngine] += 54;
          faultedTargets.oilPressure[faultEngine] -= 9;
          faultedTargets.oilTemp[faultEngine] += 9;
          faultedTargets.fuelFlow[faultEngine] += 380;
          faultedTargets.thrustLbf[faultEngine] *= 0.86;
        }

        const blend = (current, target, gain) => current + (target - current) * gain;

        const gainFor = (baseGain, i) => {
          if (!(faultEnabled && i === faultEngine)) {
            return baseGain;
          }

          return Math.max(0.04, baseGain * 0.38);
        };

        const n1Pct = prev.n1Pct.map((v, i) => blend(v, faultedTargets.n1Pct[i], gainFor(0.08, i)));
        const n2Pct = prev.n2Pct.map((v, i) => blend(v, faultedTargets.n2Pct[i], gainFor(0.09, i)));
        const n1Rpm = prev.n1Rpm.map((v, i) => blend(v, faultedTargets.n1Rpm[i], gainFor(0.08, i)));
        const n2Rpm = prev.n2Rpm.map((v, i) => blend(v, faultedTargets.n2Rpm[i], gainFor(0.09, i)));
        const rpm = n2Rpm;
        const epr = prev.epr.map((v, i) => blend(v, faultedTargets.epr[i], gainFor(0.075, i)));
        const egt = prev.egt.map((v, i) => blend(v, faultedTargets.egt[i], gainFor(0.05, i)));
        const oilPressure = prev.oilPressure.map((v, i) => blend(v, faultedTargets.oilPressure[i], gainFor(0.11, i)));
        const oilTemp = prev.oilTemp.map((v, i) => blend(v, faultedTargets.oilTemp[i], gainFor(0.05, i)));
        const fuelFlow = prev.fuelFlow.map((v, i) => blend(v, faultedTargets.fuelFlow[i], gainFor(0.09, i)));
        const thrustLbf = prev.thrustLbf.map((v, i) => blend(v, faultedTargets.thrustLbf[i], gainFor(0.085, i)));

        const trendRates = egt.map((v, i) => (v - prev.egt[i]) / TICK_SECONDS);

        const nextTankQty = { ...prev.tankQty };
        const totalFuelFlow = fuelFlow.reduce((a, b) => a + b, 0);
        const consumedLb = (totalFuelFlow / 3600) * TICK_SECONDS;
        const avgThrottleNow = throttles.reduce((a, b) => a + b, 0) / ENGINE_COUNT;
        const totalFuelRemainingNow = Object.values(prev.tankQty).reduce((a, b) => a + b, 0);
        let distanceNm = prev.distanceNm;
        let altitudeFt = prev.altitudeFt;
        let headingDeg = prev.headingDeg;
        let airspeedKt = prev.airspeedKt;
        let verticalSpeedFpm = prev.verticalSpeedFpm;

        if (transfer) {
          nextTankQty.fwd -= consumedLb * 0.45;
          nextTankQty.aft -= consumedLb * 0.35;
          nextTankQty.leftWing -= consumedLb * 0.1;
          nextTankQty.rightWing -= consumedLb * 0.1;
        } else {
          nextTankQty.fwd -= consumedLb * 0.2;
          nextTankQty.aft -= consumedLb * 0.2;
          nextTankQty.leftWing -= consumedLb * 0.3;
          nextTankQty.rightWing -= consumedLb * 0.3;
        }

        if (crossfeed) {
          const wingDiff = nextTankQty.leftWing - nextTankQty.rightWing;
          const equalize = Math.sign(wingDiff) * Math.min(Math.abs(wingDiff) * 0.08, 35 * TICK_SECONDS);
          nextTankQty.leftWing -= equalize;
          nextTankQty.rightWing += equalize;
        }

        nextTankQty.fwd = Math.max(0, nextTankQty.fwd);
        nextTankQty.aft = Math.max(0, nextTankQty.aft);
        nextTankQty.leftWing = Math.max(0, nextTankQty.leftWing);
        nextTankQty.rightWing = Math.max(0, nextTankQty.rightWing);

        const perf = calculateTelemetryResult({
          avgThrottlePct: avgThrottleNow,
          altitudeFt,
          verticalSpeedFpm,
          fuelRemainingLb: totalFuelRemainingNow,
          airspeedKt,
          boost,
          antiIce,
          faultEnabled,
        });
        const attainableSpeedKt = perf.throttleCapabilityKt;

        if (autopilotOn) {
          const desiredVs = altitudeHold ? clamp((targetAltitudeFt - altitudeFt) * 0.12, -1800, 1800) : targetVsFpm;

          verticalSpeedFpm += (desiredVs - verticalSpeedFpm) * 0.25;
          altitudeFt += verticalSpeedFpm * (TICK_SECONDS / 60);
          altitudeFt = clamp(altitudeFt, 1000, AIRCRAFT_LIMITS.ceilingFt);

          if (headingHold || navCoupled) {
            const rawDelta = ((targetHeadingDeg - headingDeg + 540) % 360) - 180;
            const headingRateDps = clamp(rawDelta * 0.08, -3, 3);
            headingDeg = (headingDeg + headingRateDps * TICK_SECONDS + 360) % 360;
          }

          airspeedKt += (attainableSpeedKt - airspeedKt) * 0.055;
        } else {
          verticalSpeedFpm += (0 - verticalSpeedFpm) * 0.14;
          altitudeFt += verticalSpeedFpm * (TICK_SECONDS / 60);
          altitudeFt = clamp(altitudeFt, 1000, AIRCRAFT_LIMITS.ceilingFt);
          airspeedKt += (attainableSpeedKt - airspeedKt) * 0.08;
        }

        // Residual acceleration from thrust margin keeps speed linked to engine state.
        airspeedKt += (perf.thrustMarginLbf / 120000) * TICK_SECONDS;

        airspeedKt = clamp(airspeedKt, 180, AIRCRAFT_LIMITS.maxSpeedKt);
        distanceNm += airspeedKt * (TICK_SECONDS / 3600);

        return {
          epr,
          n1Pct,
          n2Pct,
          n1Rpm,
          n2Rpm,
          rpm,
          egt,
          oilPressure,
          oilTemp,
          trendRates,
          fuelFlow,
          thrustLbf,
          tankQty: nextTankQty,
          elapsedSeconds: prev.elapsedSeconds + TICK_SECONDS,
          distanceNm,
          fuelUsedLb: prev.fuelUsedLb + consumedLb,
          altitudeFt,
          headingDeg,
          airspeedKt,
          verticalSpeedFpm,
        };
      });
    }, TICK_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [
    antiIce,
    autopilotOn,
    altitudeHold,
    boost,
    crossfeed,
    faultEnabled,
    faultEngine,
    headingHold,
    navCoupled,
    targetAltitudeFt,
    targetEpr,
    targetHeadingDeg,
    targetVsFpm,
    throttles,
    transfer,
  ]);

  return sim;
}
