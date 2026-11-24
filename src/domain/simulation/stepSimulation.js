import { ENGINE_COUNT } from '../aircraft/constants.js';
import { updateEngine } from '../engine/engineModel.js';
import { updateAircraftKinematics, stepHeading } from '../flight/kinematics.js';
import { drawFuel, equalizeWingTanks, totalFuelLb } from '../fuel/fuelSystem.js';
import { sum } from '../math/numeric.js';
import { createRandomStream } from '../math/random.js';
import { calculateTelemetryResult } from '../telemetry/performance.js';
import { projectEngineSeries } from './simulationState.js';

const FAULT_HEALTH = 0.86;
const SECONDS_PER_HOUR = 3600;

export function stepSimulation(previous, throttles, controls, dt) {
  const stream = createRandomStream(previous.rngState);
  const avgThrottle = sum(throttles) / ENGINE_COUNT;
  const commandedEngines = previous.engines.map((engine, engineIndex) =>
    updateEngine(
      engine,
      dt,
      {
        throttle: throttles[engineIndex] / 100,
        health: controls.faultEnabled && engineIndex === controls.faultEngine ? FAULT_HEALTH : 1,
        antiIce: controls.antiIce,
        boost: controls.boost,
        targetEpr: controls.targetEpr,
        engineIndex,
        avgThrottle,
      },
      stream.next,
    ),
  );

  const requestedLb = (sum(commandedEngines.map((engine) => engine.fuelFlow)) / SECONDS_PER_HOUR) * dt;
  const draw = drawFuel(previous.tankQty, requestedLb, controls.transfer);
  const deliveredRatio = requestedLb > 0 ? draw.deliveredLb / requestedLb : 1;
  const engines = commandedEngines.map((engine) => ({
    ...engine,
    fuelFlow: engine.fuelFlow * deliveredRatio,
    thrustLbf: engine.thrustLbf * deliveredRatio,
  }));
  const series = projectEngineSeries(engines);
  const tankQty = controls.crossfeed ? equalizeWingTanks(draw.tanks, dt) : draw.tanks;
  const totalThrustLbf = sum(series.thrustLbf);

  const performance = calculateTelemetryResult({
    avgThrottlePct: avgThrottle,
    altitudeFt: previous.altitudeFt,
    verticalSpeedFpm: previous.verticalSpeedFpm,
    fuelRemainingLb: totalFuelLb(previous.tankQty),
    payloadLb: controls.payloadLb,
    airspeedKt: previous.airspeedKt,
    boost: controls.boost,
    antiIce: controls.antiIce,
    faultEnabled: controls.faultEnabled,
    availableThrustLbf: totalThrustLbf,
  });

  const kinematics = updateAircraftKinematics(
    {
      airspeedKt: previous.airspeedKt,
      verticalSpeedFpm: previous.verticalSpeedFpm,
      altitudeFt: previous.altitudeFt,
      autopilotOn: controls.autopilotOn,
      afcsMode: controls.afcsMode,
      targetAltitudeFt: controls.targetAltitudeFt,
      targetVsFpm: controls.targetVsFpm,
      thrustAvailableLbf: totalThrustLbf,
      antiIce: controls.antiIce,
      grossWeightLb: performance.grossWeightLb,
    },
    dt,
  );

  const headingDeg =
    controls.autopilotOn && (controls.headingHold || controls.navCoupled)
      ? stepHeading(previous.headingDeg, controls.targetHeadingDeg, dt)
      : previous.headingDeg;

  return {
    seed: previous.seed,
    rngState: stream.state,
    engines,
    ...series,
    trendRates: series.egt.map((value, i) => (value - previous.egt[i]) / dt),
    tankQty,
    elapsedSeconds: previous.elapsedSeconds + dt,
    distanceNm: previous.distanceNm + kinematics.airspeedKt * (dt / SECONDS_PER_HOUR),
    fuelUsedLb: previous.fuelUsedLb + draw.deliveredLb,
    altitudeFt: kinematics.altitudeFt,
    headingDeg,
    airspeedKt: kinematics.airspeedKt,
    verticalSpeedFpm: kinematics.verticalSpeedFpm,
    afcsSaturated: kinematics.afcsSaturated,
  };
}
