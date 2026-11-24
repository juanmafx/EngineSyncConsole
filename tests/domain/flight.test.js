import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AIRCRAFT_LIMITS } from '../../src/domain/aircraft/constants.js';
import { computeAutothrottleTarget, slewThrottles } from '../../src/domain/flight/autothrottle.js';
import { stepHeading, updateAircraftKinematics } from '../../src/domain/flight/kinematics.js';
import { shortestArcDegrees } from '../../src/domain/math/numeric.js';

const baseState = {
  airspeedKt: 442,
  verticalSpeedFpm: 0,
  altitudeFt: 34000,
  autopilotOn: false,
  afcsMode: { altitude: 'HOLD', vertical: 'VS' },
  targetAltitudeFt: 34000,
  targetVsFpm: 0,
  thrustAvailableLbf: 60000,
  antiIce: false,
  grossWeightLb: 400000,
};

describe('aircraft kinematics', () => {
  it('stays inside the flight envelope for arbitrary inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 180, max: 565, noNaN: true }),
        fc.double({ min: -3000, max: 3000, noNaN: true }),
        fc.double({ min: 1000, max: 50000, noNaN: true }),
        fc.boolean(),
        fc.double({ min: 0, max: 200000, noNaN: true }),
        fc.double({ min: 0, max: 60000, noNaN: true }),
        (airspeedKt, verticalSpeedFpm, altitudeFt, autopilotOn, thrustAvailableLbf, targetAltitudeFt) => {
          const next = updateAircraftKinematics(
            { ...baseState, airspeedKt, verticalSpeedFpm, altitudeFt, autopilotOn, thrustAvailableLbf, targetAltitudeFt },
            0.5,
          );
          expect(next.airspeedKt).toBeGreaterThanOrEqual(180);
          expect(next.airspeedKt).toBeLessThanOrEqual(AIRCRAFT_LIMITS.maxSpeedKt);
          expect(next.altitudeFt).toBeGreaterThanOrEqual(1000);
          expect(next.altitudeFt).toBeLessThanOrEqual(AIRCRAFT_LIMITS.ceilingFt);
          expect(Number.isFinite(next.verticalSpeedFpm)).toBe(true);
        },
      ),
    );
  });

  it('accelerates with excess thrust and decelerates with a deficit', () => {
    expect(updateAircraftKinematics({ ...baseState, thrustAvailableLbf: 120000 }, 0.5).airspeedKt).toBeGreaterThan(442);
    expect(updateAircraftKinematics({ ...baseState, thrustAvailableLbf: 0 }, 0.5).airspeedKt).toBeLessThan(442);
  });

  it('adds drag when anti-ice is on', () => {
    const off = updateAircraftKinematics(baseState, 0.5).forceState.dragRequiredLbf;
    const on = updateAircraftKinematics({ ...baseState, antiIce: true }, 0.5).forceState.dragRequiredLbf;
    expect(on - off).toBe(2000);
  });

  it('captures a target altitude with sufficient thrust', () => {
    let state = { ...baseState, autopilotOn: true, targetAltitudeFt: 35000, thrustAvailableLbf: 90000 };
    for (let tick = 0; tick < 7200; tick += 1) {
      const next = updateAircraftKinematics(state, 0.5);
      state = { ...state, ...next };
    }
    expect(Math.abs(state.altitudeFt - 35000)).toBeLessThan(10);
  });

  it('zeroes vertical speed when pinned at an envelope limit', () => {
    const next = updateAircraftKinematics({ ...baseState, altitudeFt: 1000, verticalSpeedFpm: -3000 }, 0.5);
    expect(next.altitudeFt).toBe(1000);
    expect(next.verticalSpeedFpm).toBe(0);
  });
});

describe('heading control', () => {
  it('always reduces heading error and stays normalized', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 359 }), fc.integer({ min: 0, max: 359 }), (heading, target) => {
        const next = stepHeading(heading, target, 0.5);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(360);
        expect(Math.abs(shortestArcDegrees(next, target))).toBeLessThanOrEqual(
          Math.abs(shortestArcDegrees(heading, target)) + 1e-9,
        );
      }),
    );
  });

  it('turns across north by the short way', () => {
    expect(stepHeading(350, 10, 0.5)).toBeCloseTo(350.8, 6);
  });

  it('converges to the target', () => {
    let heading = 10;
    for (let tick = 0; tick < 2000; tick += 1) {
      heading = stepHeading(heading, 200, 0.5);
    }
    expect(heading).toBeCloseTo(200, 3);
  });
});

describe('autothrottle', () => {
  it('bounds throttle command and integrator', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 180, max: 565, noNaN: true }),
        fc.double({ min: 180, max: 565, noNaN: true }),
        fc.double({ min: -3000, max: 3000, noNaN: true }),
        fc.double({ min: 240, max: 565, noNaN: true }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        (targetAirspeedKt, currentAirspeedKt, verticalSpeedFpm, fullThrottleCapabilityKt, integrator) => {
          const command = computeAutothrottleTarget({
            targetAirspeedKt,
            currentAirspeedKt,
            verticalSpeedFpm,
            fullThrottleCapabilityKt,
            integrator,
          });
          expect(command.throttleTarget).toBeGreaterThanOrEqual(15);
          expect(command.throttleTarget).toBeLessThanOrEqual(92);
          expect(Math.abs(command.nextIntegrator)).toBeLessThanOrEqual(10);
        },
      ),
    );
  });

  it('limits slew per update', () => {
    expect(slewThrottles([10, 90, 50], 50)).toEqual([11.6, 88.4, 50]);
  });
});
