import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, deriveEngineOutputs, updateEngine } from '../../src/domain/engine/engineModel.js';
import { createRandomStream } from '../../src/domain/math/random.js';
import { summarize } from '../../src/domain/math/statistics.js';

const baseInput = { antiIce: false, boost: true, targetEpr: 1.88, engineIndex: 1, avgThrottle: 60 };

const runEngine = (seed, throttle, steps, health = 1) => {
  const stream = createRandomStream(seed);
  let engine = createEngine({ ...baseInput, throttle: 0.5 }, stream.next);
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    engine = updateEngine(engine, 0.5, { ...baseInput, throttle, health }, stream.next);
    trace.push(engine);
  }
  return trace;
};

describe('engine outputs', () => {
  it('produces more thrust and fuel flow as N1 rises', () => {
    fc.assert(
      fc.property(fc.integer({ min: 31, max: 99 }), (n1) => {
        const input = { ...baseInput, throttle: 0.5, N2: 85, health: 1 };
        const low = deriveEngineOutputs({ ...input, N1: n1 });
        const high = deriveEngineOutputs({ ...input, N1: n1 + 1 });
        return high.thrustLbf > low.thrustLbf && high.fuelFlow > low.fuelFlow;
      }),
    );
  });

  it('reduces thrust when health degrades', () => {
    const input = { ...baseInput, throttle: 0.8, N1: 85, N2: 92 };
    expect(deriveEngineOutputs({ ...input, health: 0.86 }).thrustLbf).toBeLessThan(
      deriveEngineOutputs({ ...input, health: 1 }).thrustLbf,
    );
  });

  it('caps thrust at the rated value', () => {
    const output = deriveEngineOutputs({ ...baseInput, throttle: 1, N1: 100, N2: 100, health: 1 });
    expect(output.thrustLbf).toBe(17000);
  });
});

describe('engine dynamics', () => {
  it('keeps every output inside its physical envelope', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 0xffffffff }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 1.5, noNaN: true }),
        (seed, throttle, health) => {
          for (const engine of runEngine(seed, throttle, 40, health)) {
            expect(engine.N1).toBeGreaterThanOrEqual(30);
            expect(engine.N1).toBeLessThanOrEqual(100);
            expect(engine.N2).toBeGreaterThanOrEqual(60);
            expect(engine.N2).toBeLessThanOrEqual(100);
            expect(engine.EGT).toBeGreaterThanOrEqual(300);
            expect(engine.EGT).toBeLessThanOrEqual(805);
            expect(engine.thrustLbf).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(engine.fuelFlow)).toBe(true);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it('spools up slower than the command and settles near the target', () => {
    const trace = runEngine(5, 0.9, 200);
    expect(trace[0].N2).toBeLessThan(trace[199].N2);
    const settled = summarize(trace.slice(150).map((engine) => engine.N2));
    expect(settled.standardDeviation).toBeLessThan(0.05);
  });

  it('keeps sensor noise from accumulating into the spool state', () => {
    const trace = runEngine(17, 0.7, 2000);
    const coreOffsets = trace.slice(400).map((engine) => engine.N1 - engine.n1Core);
    const stats = summarize(coreOffsets);
    expect(Math.abs(stats.mean)).toBeLessThan(0.05);
    expect(stats.max).toBeLessThanOrEqual(0.5);
    expect(stats.min).toBeGreaterThanOrEqual(-0.5);
    const coreAfterSettling = summarize(trace.slice(400).map((engine) => engine.n1Core));
    expect(coreAfterSettling.standardDeviation).toBeLessThan(1e-6);
  });
});
