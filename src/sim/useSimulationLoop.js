import { useEffect, useState } from 'react';
import { AIRCRAFT_LIMITS, ENGINE_COUNT, TICK_SECONDS } from './constants';
import { clamp, initSimulation, updateEngine } from './flightModel';
import { calculateTelemetryResult } from '../telemetry/results';

export function useSimulationLoop({
  throttles,
  targetEpr,
  antiIce,
  boost,
  payloadLb,
  faultEnabled,
  faultEngine,
  crossfeed,
  transfer,
  autopilotOn,
  afcsMode,
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
        const avgThrottleNow = throttles.reduce((a, b) => a + b, 0) / ENGINE_COUNT;
        const nextEngines = prev.engines.map((engine, i) =>
          updateEngine(engine, TICK_SECONDS, {
            throttle: throttles[i] / 100,
            health: faultEnabled && i === faultEngine ? 0.86 : 1,
            antiIce,
            boost,
            targetEpr,
            engineIndex: i,
            avgThrottle: avgThrottleNow,
          }),
        );

        const n1Pct = nextEngines.map((engine) => engine.N1);
        const n2Pct = nextEngines.map((engine) => engine.N2);
        const n1Rpm = nextEngines.map((engine) => engine.n1Rpm);
        const n2Rpm = nextEngines.map((engine) => engine.n2Rpm);
        const rpm = nextEngines.map((engine) => engine.rpm);
        const epr = nextEngines.map((engine) => engine.epr);
        const egt = nextEngines.map((engine) => engine.EGT);
        const oilPressure = nextEngines.map((engine) => engine.oilPressure);
        const oilTemp = nextEngines.map((engine) => engine.oilTemp);
        const fuelFlow = nextEngines.map((engine) => engine.fuelFlow);
        const thrustLbf = nextEngines.map((engine) => engine.thrustLbf);
        const totalThrustAvailableLbf = thrustLbf.reduce((a, b) => a + b, 0);
        const trendRates = egt.map((v, i) => (v - prev.egt[i]) / TICK_SECONDS);

        const nextTankQty = { ...prev.tankQty };
        const totalFuelFlow = fuelFlow.reduce((a, b) => a + b, 0);
        const consumedLb = (totalFuelFlow / 3600) * TICK_SECONDS;
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
          payloadLb,
          airspeedKt,
          boost,
          antiIce,
          faultEnabled,
          availableThrustLbf: totalThrustAvailableLbf,
        });
        const grossWeightLb = perf.grossWeightLb;
        const massSlugs = grossWeightLb / 32.174;
        const accelFps2 = massSlugs > 0 ? perf.thrustMarginLbf / massSlugs : 0;
        airspeedKt += (accelFps2 / 1.68781) * TICK_SECONDS;

        let desiredVsFpm = 0;
        const altitudeErrorFt = targetAltitudeFt - altitudeFt;
        const isAltitudeHold = autopilotOn && afcsMode?.altitude !== 'OFF';
        const resolvedAltitudeMode = isAltitudeHold
          ? Math.abs(altitudeErrorFt) < 350
            ? 'CAPTURE'
            : afcsMode?.altitude ?? 'HOLD'
          : 'OFF';
        const resolvedVerticalMode = isAltitudeHold ? 'NONE' : afcsMode?.vertical ?? 'NONE';

        if (autopilotOn) {
          if (resolvedAltitudeMode !== 'OFF') {
            const holdGain = resolvedAltitudeMode === 'CAPTURE' ? 0.08 : 0.12;
            desiredVsFpm = clamp(altitudeErrorFt * holdGain, -2200, 2200);
          } else if (resolvedVerticalMode === 'VS' || resolvedVerticalMode === 'FPA') {
            desiredVsFpm = resolvedVerticalMode === 'FPA' ? clamp(targetVsFpm * 0.85, -2600, 2600) : clamp(targetVsFpm, -3000, 3000);
          }

          const climbCapability = perf.climbCapabilityFpm;
          const maxUpFpm = clamp(Math.max(250, climbCapability), 250, 3200);
          const maxDownFpm = clamp(Math.min(-250, climbCapability - 200), -3200, -250);
          const boundedDesiredVs = clamp(desiredVsFpm, maxDownFpm, maxUpFpm);
          verticalSpeedFpm += (boundedDesiredVs - verticalSpeedFpm) * 0.21;
          altitudeFt += verticalSpeedFpm * (TICK_SECONDS / 60);
          altitudeFt = clamp(altitudeFt, 1000, AIRCRAFT_LIMITS.ceilingFt);

          if (headingHold || navCoupled) {
            const rawDelta = ((targetHeadingDeg - headingDeg + 540) % 360) - 180;
            const headingRateDps = clamp(rawDelta * 0.08, -3, 3);
            headingDeg = (headingDeg + headingRateDps * TICK_SECONDS + 360) % 360;
          }
        } else {
          verticalSpeedFpm += (0 - verticalSpeedFpm) * 0.14;
          altitudeFt += verticalSpeedFpm * (TICK_SECONDS / 60);
          altitudeFt = clamp(altitudeFt, 1000, AIRCRAFT_LIMITS.ceilingFt);
        }

        airspeedKt = clamp(airspeedKt, 180, AIRCRAFT_LIMITS.maxSpeedKt);
        distanceNm += airspeedKt * (TICK_SECONDS / 3600);

        return {
          engines: nextEngines,
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
    afcsMode,
    boost,
    crossfeed,
    faultEnabled,
    faultEngine,
    headingHold,
    navCoupled,
    payloadLb,
    targetAltitudeFt,
    targetEpr,
    targetHeadingDeg,
    targetVsFpm,
    throttles,
    transfer,
  ]);

  return sim;
}
