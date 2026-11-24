import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FUEL_CAPACITY_LB, TICK_SECONDS } from '../../src/domain/aircraft/constants.js';
import { totalFuelLb } from '../../src/domain/fuel/fuelSystem.js';
import { computeMetrics } from '../../src/domain/simulation/metrics.js';
import { runScenario } from '../../src/domain/simulation/scenario.js';
import {
  DEFAULT_CONTROLS,
  DEFAULT_THROTTLES,
  initSimulation,
} from '../../src/domain/simulation/simulationState.js';
import { stepSimulation } from '../../src/domain/simulation/stepSimulation.js';
import { calculateTelemetryResult } from '../../src/domain/telemetry/performance.js';

const start = (seed = 42) =>
  initSimulation(DEFAULT_THROTTLES, DEFAULT_CONTROLS.targetEpr, DEFAULT_CONTROLS.antiIce, DEFAULT_CONTROLS.boost, seed);

describe('reproducibility', () => {
  it('produces identical runs for the same seed', () => {
    expect(runScenario({ seed: 123, durationSeconds: 120 })).toEqual(runScenario({ seed: 123, durationSeconds: 120 }));
  });

  it('produces different traces for different seeds', () => {
    const first = runScenario({ seed: 1, durationSeconds: 60 }).finalState.egt;
    const second = runScenario({ seed: 2, durationSeconds: 60 }).finalState.egt;
    expect(first).not.toEqual(second);
  });

  it('is a pure step that does not mutate its input', () => {
    const state = start();
    const snapshot = structuredClone(state);
    const first = stepSimulation(state, DEFAULT_THROTTLES, DEFAULT_CONTROLS, TICK_SECONDS);
    const second = stepSimulation(state, DEFAULT_THROTTLES, DEFAULT_CONTROLS, TICK_SECONDS);
    expect(state).toEqual(snapshot);
    expect(first).toEqual(second);
  });
});

describe('conservation', () => {
  it('balances fuel used against tank depletion for arbitrary configurations', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 0xffffffff }),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 8, maxLength: 8 }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (seed, throttles, transfer, crossfeed, boost) => {
          const controls = { ...DEFAULT_CONTROLS, transfer, crossfeed, boost };
          let state = initSimulation(throttles, controls.targetEpr, controls.antiIce, boost, seed);
          for (let tick = 0; tick < 40; tick += 1) {
            state = stepSimulation(state, throttles, controls, TICK_SECONDS);
          }
          expect(totalFuelLb(FUEL_CAPACITY_LB) - totalFuelLb(state.tankQty)).toBeCloseTo(state.fuelUsedLb, 5);
        },
      ),
      { numRuns: 40 },
    );
  });

  it('removes thrust and fuel flow once all tanks are empty', () => {
    const state = { ...start(), tankQty: { fwd: 0, aft: 0, leftWing: 0, rightWing: 0 } };
    const next = stepSimulation(state, DEFAULT_THROTTLES, DEFAULT_CONTROLS, TICK_SECONDS);
    expect(next.thrustLbf.every((value) => value === 0)).toBe(true);
    expect(next.fuelFlow.every((value) => value === 0)).toBe(true);
    expect(next.fuelUsedLb).toBe(0);
  });

  it('never burns more fuel than remains near exhaustion', () => {
    let state = { ...start(), tankQty: { fwd: 3, aft: 2, leftWing: 2, rightWing: 2 } };
    for (let tick = 0; tick < 20; tick += 1) {
      state = stepSimulation(state, DEFAULT_THROTTLES, DEFAULT_CONTROLS, TICK_SECONDS);
    }
    expect(state.fuelUsedLb).toBeCloseTo(9, 6);
  });
});

describe('closed-loop behavior', () => {
  it('holds the selected speed with the autothrottle', () => {
    const result = runScenario({
      seed: 42,
      durationSeconds: 900,
      controls: { autopilotOn: true, speedHold: true, targetAirspeedKt: 420 },
    });
    expect(Math.abs(result.finalState.airspeedKt - 420)).toBeLessThan(8);
  });

  it('distance equals the integral of airspeed', () => {
    const state = start();
    const next = stepSimulation(state, DEFAULT_THROTTLES, DEFAULT_CONTROLS, TICK_SECONDS);
    expect(next.distanceNm).toBeCloseTo(next.airspeedKt * (TICK_SECONDS / 3600), 10);
  });
});

describe('derived metrics', () => {
  const metricsFor = (overrides = {}) =>
    computeMetrics({ sim: start(), throttles: DEFAULT_THROTTLES, ...DEFAULT_CONTROLS, ...overrides });

  it('computes gross weight from its parts', () => {
    const metrics = metricsFor();
    expect(metrics.grossWeightLb).toBe(metrics.emptyWeightLb + metrics.totalFuelRemaining + metrics.payloadLb);
  });

  it('clamps payload to the structural limit', () => {
    expect(metricsFor({ payloadLb: 999999 }).payloadLb).toBe(70000);
    expect(metricsFor({ payloadLb: -5 }).payloadLb).toBe(0);
  });

  it('computes endurance as fuel over flow', () => {
    const metrics = metricsFor();
    expect(metrics.enduranceHours).toBeCloseTo(metrics.totalFuelRemaining / metrics.totalFuelFlow, 10);
  });

  it('counts the ice caution when anti-ice is off', () => {
    expect(metricsFor({ antiIce: false }).iceAlarmActive).toBe(true);
    expect(metricsFor({ antiIce: true }).iceAlarmActive).toBe(false);
  });
});

describe('telemetry performance', () => {
  const input = {
    avgThrottlePct: 70,
    altitudeFt: 30000,
    verticalSpeedFpm: 0,
    fuelRemainingLb: 200000,
    payloadLb: 20000,
    airspeedKt: 440,
    boost: true,
    antiIce: false,
    faultEnabled: false,
  };

  it('keeps speed capability ordered and bounded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50000 }),
        fc.integer({ min: 0, max: 312200 }),
        fc.integer({ min: 0, max: 70000 }),
        (avgThrottlePct, altitudeFt, fuelRemainingLb, payloadLb) => {
          const result = calculateTelemetryResult({ ...input, avgThrottlePct, altitudeFt, fuelRemainingLb, payloadLb });
          expect(result.throttleCapabilityKt).toBeLessThanOrEqual(result.fullThrottleCapabilityKt);
          expect(result.fullThrottleCapabilityKt).toBeLessThanOrEqual(565);
          expect(Math.abs(result.climbCapabilityFpm)).toBeLessThanOrEqual(4000);
        },
      ),
    );
  });

  it('loses modeled thrust with altitude', () => {
    const low = calculateTelemetryResult({ ...input, altitudeFt: 5000 }).thrustAvailableLbf;
    const high = calculateTelemetryResult({ ...input, altitudeFt: 45000 }).thrustAvailableLbf;
    expect(high).toBeLessThan(low);
  });

  it('reduces modeled thrust with an engine fault', () => {
    const healthy = calculateTelemetryResult(input).thrustAvailableLbf;
    const degraded = calculateTelemetryResult({ ...input, faultEnabled: true }).thrustAvailableLbf;
    expect(degraded).toBeLessThan(healthy);
  });
});
