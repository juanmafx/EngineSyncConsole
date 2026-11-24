import { parseArgs } from 'node:util';
import { TICK_SECONDS } from '../src/domain/aircraft/constants.js';
import { parseSeed } from '../src/domain/math/random.js';
import { runScenario } from '../src/domain/simulation/scenario.js';

const MAX_DURATION_SECONDS = 86400;

let values;
try {
  ({ values } = parseArgs({
    options: {
      seed: { type: 'string', default: '42' },
      duration: { type: 'string', default: '600' },
      autopilot: { type: 'boolean', default: false },
      'target-speed': { type: 'string', default: '442' },
    },
  }));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const seed = parseSeed(values.seed);
const durationSeconds = Number(values.duration);
const targetAirspeedKt = Number(values['target-speed']);

if (seed === null) {
  console.error('--seed must be an integer between 0 and 4294967295');
  process.exit(2);
}
if (!Number.isFinite(durationSeconds) || durationSeconds < TICK_SECONDS || durationSeconds > MAX_DURATION_SECONDS) {
  console.error(`--duration must be between ${TICK_SECONDS} and ${MAX_DURATION_SECONDS} seconds`);
  process.exit(2);
}
if (!Number.isFinite(targetAirspeedKt) || targetAirspeedKt < 180 || targetAirspeedKt > 565) {
  console.error('--target-speed must be between 180 and 565 knots');
  process.exit(2);
}

const result = runScenario({
  seed,
  durationSeconds,
  controls: { autopilotOn: values.autopilot, speedHold: values.autopilot, targetAirspeedKt },
});

const { finalState, statistics } = result;
console.log(
  JSON.stringify(
    {
      seed: result.seed,
      durationSeconds: result.durationSeconds,
      tickSeconds: result.tickSeconds,
      tickCount: result.tickCount,
      final: {
        airspeedKt: finalState.airspeedKt,
        altitudeFt: finalState.altitudeFt,
        headingDeg: finalState.headingDeg,
        distanceNm: finalState.distanceNm,
        fuelUsedLb: finalState.fuelUsedLb,
        tanksLb: finalState.tankQty,
      },
      statistics,
    },
    null,
    2,
  ),
);
