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
          rpm: [...targets.rpm],
          egt: [...targets.egt],
          oilPressure: [...targets.oilPressure],
          oilTemp: [...targets.oilTemp],
          fuelFlow: [...targets.fuelFlow],
        };

        if (faultEnabled) {
          faultedTargets.epr[faultEngine] -= 0.18;
          faultedTargets.rpm[faultEngine] -= 700;
          faultedTargets.egt[faultEngine] += 48;
          faultedTargets.oilPressure[faultEngine] -= 8;
          faultedTargets.oilTemp[faultEngine] += 10;
          faultedTargets.fuelFlow[faultEngine] += 240;
        }

        const blend = (current, target, gain) => current + (target - current) * gain;

        const gainFor = (baseGain, i) => {
          if (!(faultEnabled && i === faultEngine)) {
            return baseGain;
          }

          return Math.max(0.04, baseGain * 0.38);
        };

        const rpm = prev.rpm.map((v, i) => blend(v, faultedTargets.rpm[i], gainFor(0.28, i)));
        const epr = prev.epr.map((v, i) => blend(v, faultedTargets.epr[i], gainFor(0.2, i)));
        const egt = prev.egt.map((v, i) => blend(v, faultedTargets.egt[i], gainFor(0.11, i)));
        const oilPressure = prev.oilPressure.map((v, i) => blend(v, faultedTargets.oilPressure[i], gainFor(0.22, i)));
        const oilTemp = prev.oilTemp.map((v, i) => blend(v, faultedTargets.oilTemp[i], gainFor(0.06, i)));
        const fuelFlow = prev.fuelFlow.map((v, i) => blend(v, faultedTargets.fuelFlow[i], gainFor(0.24, i)));

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
          rpm,
          egt,
          oilPressure,
          oilTemp,
          trendRates,
          fuelFlow,
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
