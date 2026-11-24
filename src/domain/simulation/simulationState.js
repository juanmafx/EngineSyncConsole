import { ENGINE_COUNT, FUEL_CAPACITY_LB } from '../aircraft/constants.js';
import { createEngine } from '../engine/engineModel.js';
import { createRandomStream } from '../math/random.js';
import { sum } from '../math/numeric.js';

export const DEFAULT_SEED = 42;
export const DEFAULT_THROTTLES = [63, 65, 62, 64, 63, 66, 61, 64];

export const DEFAULT_CONTROLS = {
  targetEpr: 1.88,
  antiIce: false,
  bleedAir: true,
  boost: true,
  payloadLb: 28000,
  faultEnabled: false,
  faultEngine: 3,
  crossfeed: false,
  transfer: true,
  autopilotOn: false,
  afcsMode: { altitude: 'HOLD', vertical: 'VS' },
  targetAltitudeFt: 34000,
  targetVsFpm: 0,
  headingHold: true,
  navCoupled: false,
  targetHeadingDeg: 90,
  speedHold: false,
  targetAirspeedKt: 442,
};

export const projectEngineSeries = (engines) => ({
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
});

export function initSimulation(throttles, targetEpr, antiIce, boost, seed = DEFAULT_SEED) {
  const stream = createRandomStream(seed);
  const avgThrottle = sum(throttles) / ENGINE_COUNT;
  const engines = throttles.map((throttle, engineIndex) =>
    createEngine(
      { throttle: throttle / 100, health: 1, antiIce, boost, targetEpr, engineIndex, avgThrottle },
      stream.next,
    ),
  );

  return {
    seed,
    rngState: stream.state,
    engines,
    ...projectEngineSeries(engines),
    trendRates: new Array(ENGINE_COUNT).fill(0),
    tankQty: { ...FUEL_CAPACITY_LB },
    elapsedSeconds: 0,
    distanceNm: 0,
    fuelUsedLb: 0,
    altitudeFt: 34000,
    headingDeg: 90,
    airspeedKt: 442,
    verticalSpeedFpm: 0,
    afcsSaturated: false,
  };
}
