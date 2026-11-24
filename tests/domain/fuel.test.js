import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { drawFuel, equalizeWingTanks, totalFuelLb } from '../../src/domain/fuel/fuelSystem.js';

const tanksArbitrary = fc.record({
  fwd: fc.double({ min: 0, max: 80000, noNaN: true }),
  aft: fc.double({ min: 0, max: 80000, noNaN: true }),
  leftWing: fc.double({ min: 0, max: 80000, noNaN: true }),
  rightWing: fc.double({ min: 0, max: 80000, noNaN: true }),
});

describe('drawFuel', () => {
  it('conserves mass and never drives a tank negative', () => {
    fc.assert(
      fc.property(tanksArbitrary, fc.double({ min: 0, max: 400000, noNaN: true }), fc.boolean(), (tanks, burn, transfer) => {
        const result = drawFuel(tanks, burn, transfer);
        expect(Object.values(result.tanks).every((value) => value >= 0)).toBe(true);
        expect(totalFuelLb(tanks) - totalFuelLb(result.tanks)).toBeCloseTo(result.deliveredLb, 5);
        expect(result.deliveredLb).toBeLessThanOrEqual(burn + 1e-6);
      }),
    );
  });

  it('delivers the full request while fuel is available', () => {
    fc.assert(
      fc.property(tanksArbitrary, fc.double({ min: 0, max: 1, noNaN: true }), fc.boolean(), (tanks, fraction, transfer) => {
        const request = totalFuelLb(tanks) * fraction;
        expect(drawFuel(tanks, request, transfer).deliveredLb).toBeCloseTo(request, 5);
      }),
    );
  });

  it('applies the transfer schedule', () => {
    const tanks = { fwd: 1000, aft: 1000, leftWing: 1000, rightWing: 1000 };
    const { tanks: next } = drawFuel(tanks, 100, true);
    expect(next.fwd).toBeCloseTo(955, 8);
    expect(next.aft).toBeCloseTo(965, 8);
    expect(next.leftWing).toBeCloseTo(990, 8);
  });

  it('reroutes demand when a scheduled tank is empty', () => {
    const { tanks, deliveredLb } = drawFuel({ fwd: 0, aft: 0, leftWing: 50, rightWing: 50 }, 80, true);
    expect(deliveredLb).toBeCloseTo(80, 8);
    expect(tanks.leftWing + tanks.rightWing).toBeCloseTo(20, 8);
  });

  it('reports a shortfall when fuel runs out', () => {
    const { tanks, deliveredLb } = drawFuel({ fwd: 5, aft: 5, leftWing: 5, rightWing: 5 }, 100, false);
    expect(deliveredLb).toBeCloseTo(20, 8);
    expect(totalFuelLb(tanks)).toBeCloseTo(0, 8);
  });
});

describe('equalizeWingTanks', () => {
  it('conserves mass and shrinks imbalance without crossing over', () => {
    fc.assert(
      fc.property(tanksArbitrary, fc.double({ min: 0.01, max: 60, noNaN: true }), (tanks, dt) => {
        const next = equalizeWingTanks(tanks, dt);
        const before = tanks.leftWing - tanks.rightWing;
        const after = next.leftWing - next.rightWing;
        expect(totalFuelLb(next)).toBeCloseTo(totalFuelLb(tanks), 6);
        expect(Math.abs(after)).toBeLessThanOrEqual(Math.abs(before) + 1e-9);
        expect(after * before).toBeGreaterThanOrEqual(-1e-6);
      }),
    );
  });

  it('respects the crossfeed rate limit', () => {
    const next = equalizeWingTanks({ fwd: 0, aft: 0, leftWing: 50000, rightWing: 0 }, 0.5);
    expect(50000 - next.leftWing).toBeCloseTo(17.5, 8);
  });
});
