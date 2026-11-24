import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { densityRatioAtAltitude, isaRatios } from '../../src/domain/atmosphere/isa.js';
import { clamp, lagToward, normalizeDegrees, shortestArcDegrees } from '../../src/domain/math/numeric.js';
import { createRandomStream, parseSeed } from '../../src/domain/math/random.js';
import { chiSquareUniform, lagOneAutocorrelation, summarize } from '../../src/domain/math/statistics.js';

const CHI_SQUARE_CRITICAL_99_DF_P001 = 148.23;

const sampleStream = (seed, count) => {
  const stream = createRandomStream(seed);
  return Array.from({ length: count }, () => stream.next());
};

describe('random stream', () => {
  it('reproduces the same sequence for the same seed', () => {
    fc.assert(
      fc.property(fc.nat({ max: 0xffffffff }), (seed) => {
        expect(sampleStream(seed, 16)).toEqual(sampleStream(seed, 16));
      }),
    );
  });

  it('resumes exactly from a captured state', () => {
    const stream = createRandomStream(7);
    sampleStream(7, 0);
    stream.next();
    const resumed = createRandomStream(stream.state);
    expect(resumed.next()).toBe(stream.next());
  });

  it('stays inside the unit interval', () => {
    expect(sampleStream(11, 20000).every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it.each([1, 42, 2026])('passes a chi-square uniformity test for seed %i', (seed) => {
    expect(chiSquareUniform(sampleStream(seed, 100000), 100)).toBeLessThan(CHI_SQUARE_CRITICAL_99_DF_P001);
  });

  it('has mean, variance and serial correlation of a uniform source', () => {
    const samples = sampleStream(99, 200000);
    const { mean, standardDeviation } = summarize(samples);
    expect(mean).toBeCloseTo(0.5, 2);
    expect(standardDeviation ** 2).toBeCloseTo(1 / 12, 3);
    expect(Math.abs(lagOneAutocorrelation(samples))).toBeLessThan(0.01);
  });
});

describe('parseSeed', () => {
  it('accepts every unsigned 32-bit integer', () => {
    fc.assert(fc.property(fc.nat({ max: 0xffffffff }), (seed) => parseSeed(String(seed)) === seed));
  });

  it.each(['', '-1', '1.5', 'abc', '4294967296', '1e5', '<script>', null, undefined])('rejects %s', (value) => {
    expect(parseSeed(value)).toBeNull();
  });
});

describe('first-order lag', () => {
  it('is invariant to step subdivision', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: 0.01, max: 5, noNaN: true }),
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        (start, target, dt, tau) => {
          const whole = lagToward(start, target, dt, tau);
          const halves = lagToward(lagToward(start, target, dt / 2, tau), target, dt / 2, tau);
          expect(halves).toBeCloseTo(whole, 6);
        },
      ),
    );
  });

  it('never overshoots the target', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        (start, target, dt, tau) => {
          const next = lagToward(start, target, dt, tau);
          const tolerance = 1e-9;
          expect(next).toBeGreaterThanOrEqual(Math.min(start, target) - tolerance);
          expect(next).toBeLessThanOrEqual(Math.max(start, target) + tolerance);
        },
      ),
    );
  });
});

describe('angles', () => {
  it('normalizes into [0, 360)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (degrees) => {
        const normalized = normalizeDegrees(degrees);
        return normalized >= 0 && normalized < 360;
      }),
    );
  });

  it('takes the shortest arc', () => {
    expect(shortestArcDegrees(350, 10)).toBe(20);
    expect(shortestArcDegrees(10, 350)).toBe(-20);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 359 }), fc.integer({ min: 0, max: 359 }), (from, to) => {
        const arc = shortestArcDegrees(from, to);
        return Math.abs(arc) <= 180 && normalizeDegrees(from + arc) === to;
      }),
    );
  });
});

describe('statistics', () => {
  it('matches a hand-computed sample', () => {
    const result = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result.mean).toBe(5);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(result.min).toBe(2);
    expect(result.max).toBe(9);
  });

  it('handles an empty sample', () => {
    expect(summarize([]).count).toBe(0);
  });

  it('clamps inside bounds', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (value, a, b) => {
        const [min, max] = a <= b ? [a, b] : [b, a];
        const result = clamp(value, min, max);
        return result >= min && result <= max;
      }),
    );
  });
});

describe('International Standard Atmosphere', () => {
  it.each([
    [0, 1, 1, 1],
    [5000 / 0.3048, 0.53313, 0.88721, 0.60093],
    [11000 / 0.3048, 0.22336, 0.75186, 0.29708],
    [15000 / 0.3048, 0.11887, 0.75186, 0.1581],
  ])('matches published ratios at %f ft', (altitudeFt, delta, theta, sigma) => {
    const ratios = isaRatios(altitudeFt);
    expect(ratios.pressureRatio).toBeCloseTo(delta, 4);
    expect(ratios.temperatureRatio).toBeCloseTo(theta, 4);
    expect(ratios.densityRatio).toBeCloseTo(sigma, 4);
  });

  it('is strictly decreasing in density up to the modeled ceiling', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 64000 }), fc.integer({ min: 1, max: 1000 }), (altitude, step) => {
        return densityRatioAtAltitude(altitude + step) < densityRatioAtAltitude(altitude);
      }),
    );
  });

  it('is continuous across the tropopause', () => {
    const tropopauseFt = 11000 / 0.3048;
    expect(densityRatioAtAltitude(tropopauseFt + 0.01)).toBeCloseTo(densityRatioAtAltitude(tropopauseFt - 0.01), 5);
  });
});
