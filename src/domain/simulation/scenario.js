import { TICK_SECONDS } from '../aircraft/constants.js';
import {
  AUTOTHROTTLE_PERIOD_MS,
  INTEGRATOR_DECAY,
  computeAutothrottleTarget,
  slewThrottles,
} from '../flight/autothrottle.js';
import { summarize } from '../math/statistics.js';
import { sum } from '../math/numeric.js';
import { computeMetrics } from './metrics.js';
import { DEFAULT_CONTROLS, DEFAULT_SEED, DEFAULT_THROTTLES, initSimulation } from './simulationState.js';
import { stepSimulation } from './stepSimulation.js';

const AUTOTHROTTLE_UPDATES_PER_TICK = Math.round((TICK_SECONDS * 1000) / AUTOTHROTTLE_PERIOD_MS);

function runAutothrottle(throttles, integrator, metrics, controls) {
  if (!(controls.autopilotOn && controls.speedHold)) {
    return { throttles, integrator: integrator * INTEGRATOR_DECAY ** AUTOTHROTTLE_UPDATES_PER_TICK };
  }
  let nextThrottles = throttles;
  let nextIntegrator = integrator;
  for (let update = 0; update < AUTOTHROTTLE_UPDATES_PER_TICK; update += 1) {
    const command = computeAutothrottleTarget({
      targetAirspeedKt: controls.targetAirspeedKt,
      currentAirspeedKt: metrics.airspeedKt,
      verticalSpeedFpm: metrics.verticalSpeedFpm,
      fullThrottleCapabilityKt: metrics.telemetry.fullThrottleCapabilityKt,
      integrator: nextIntegrator,
    });
    nextIntegrator = command.nextIntegrator;
    nextThrottles = slewThrottles(nextThrottles, command.throttleTarget);
  }
  return { throttles: nextThrottles, integrator: nextIntegrator };
}

export function runScenario({
  seed = DEFAULT_SEED,
  durationSeconds = 600,
  throttles: initialThrottles = DEFAULT_THROTTLES,
  controls: controlOverrides = {},
} = {}) {
  const controls = { ...DEFAULT_CONTROLS, ...controlOverrides };
  const tickCount = Math.round(durationSeconds / TICK_SECONDS);
  let throttles = [...initialThrottles];
  let integrator = 0;
  let sim = initSimulation(throttles, controls.targetEpr, controls.antiIce, controls.boost, seed);
  const airspeedKt = [];
  const altitudeFt = [];
  const maxEgtC = [];
  const totalFuelFlowLbPerHour = [];

  for (let tick = 0; tick < tickCount; tick += 1) {
    sim = stepSimulation(sim, throttles, controls, TICK_SECONDS);
    const metrics = computeMetrics({ sim, throttles, ...controls });
    ({ throttles, integrator } = runAutothrottle(throttles, integrator, metrics, controls));
    airspeedKt.push(sim.airspeedKt);
    altitudeFt.push(sim.altitudeFt);
    maxEgtC.push(Math.max(...sim.egt));
    totalFuelFlowLbPerHour.push(sum(sim.fuelFlow));
  }

  return {
    seed,
    durationSeconds: tickCount * TICK_SECONDS,
    tickSeconds: TICK_SECONDS,
    tickCount,
    finalState: sim,
    finalThrottles: throttles,
    statistics: {
      airspeedKt: summarize(airspeedKt),
      altitudeFt: summarize(altitudeFt),
      maxEgtC: summarize(maxEgtC),
      totalFuelFlowLbPerHour: summarize(totalFuelFlowLbPerHour),
    },
  };
}
