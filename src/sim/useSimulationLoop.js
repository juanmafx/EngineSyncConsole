import { useEffect, useState } from 'react';
import { ENGINE_COUNT, TICK_SECONDS } from './constants';
import { clamp, initSimulation, updateEngine } from './flightModel';
import { updateAircraftKinematics } from './aircraftKinematics';
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
        const altitudeFt = prev.altitudeFt;
        let headingDeg = prev.headingDeg;
        const airspeedKt = prev.airspeedKt;
        const verticalSpeedFpm = prev.verticalSpeedFpm;

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
        // Centralized kinematics update: the only writer of speed/VS/altitude.
        const kinematics = updateAircraftKinematics(
          {
            airspeedKt,
            verticalSpeedFpm,
            altitudeFt,
            autopilotOn,
            afcsMode,
            targetAltitudeFt,
            targetVsFpm,
            thrustAvailableLbf: totalThrustAvailableLbf,
            antiIce,
            grossWeightLb: perf.grossWeightLb,
          },
          TICK_SECONDS,
        );

        if (autopilotOn && (headingHold || navCoupled)) {
          const rawDelta = ((targetHeadingDeg - headingDeg + 540) % 360) - 180;
          const headingRateDps = clamp(rawDelta * 0.08, -3, 3);
          headingDeg = (headingDeg + headingRateDps * TICK_SECONDS + 360) % 360;
        }

        const nextAirspeedKt = kinematics.airspeedKt;
        const nextVerticalSpeedFpm = kinematics.verticalSpeedFpm;
        const nextAltitudeFt = kinematics.altitudeFt;
        const afcsSaturated = kinematics.afcsSaturated;
        distanceNm += nextAirspeedKt * (TICK_SECONDS / 3600);

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
          altitudeFt: nextAltitudeFt,
          headingDeg,
          airspeedKt: nextAirspeedKt,
          verticalSpeedFpm: nextVerticalSpeedFpm,
          afcsSaturated,
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
