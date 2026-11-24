import { describe, expect, it } from 'vitest';
import { buildActiveAlertList } from '../../src/domain/alerts/activeAlerts.js';
import { evaluateAlertState, getClearedAlerts, getNewAlerts } from '../../src/domain/alerts/alertRules.js';

const nominal = {
  egt: new Array(8).fill(600),
  oilPressure: new Array(8).fill(50),
  symmetryDelta: 0,
  tankImbalancePct: 0,
  busA: 27,
  busB: 27,
  faultEnabled: false,
  antiIce: true,
  iceAlarmActive: false,
  gearDown: false,
  gearUnsafe: false,
  gearTransit: false,
};

const nominalMetrics = {
  egt: nominal.egt,
  oilPressure: nominal.oilPressure,
  oilTemp: new Array(8).fill(100),
  trend: new Array(8).fill(0),
  tankImbalancePct: 0,
  symmetryDelta: 0,
  busA: 27,
  busB: 27,
};

const withEngine = (value, index = 2) => nominal.egt.map((current, i) => (i === index ? value : current));

describe('evaluateAlertState', () => {
  it('is quiet in nominal conditions', () => {
    const state = evaluateAlertState(nominal);
    expect(state.priority).toBe(0);
    expect(state.warnings.size + state.cautions.size).toBe(0);
  });

  it.each([
    [700, false],
    [700.1, true],
  ])('applies the EGT caution boundary at %f', (egt, expected) => {
    expect(evaluateAlertState({ ...nominal, egt: withEngine(egt) }).cautions.has('egt_high')).toBe(expected);
  });

  it.each([
    [760, false],
    [760.1, true],
  ])('applies the EGT warning boundary at %f', (egt, expected) => {
    expect(evaluateAlertState({ ...nominal, egt: withEngine(egt) }).warnings.has('egt_critical')).toBe(expected);
  });

  it('gives warnings priority over cautions', () => {
    expect(evaluateAlertState({ ...nominal, egt: withEngine(780) }).priority).toBe(1);
    expect(evaluateAlertState({ ...nominal, faultEnabled: true }).priority).toBe(2);
  });

  it.each([
    ['oil_pressure_low', { oilPressure: new Array(8).fill(34.9) }],
    ['engine_degraded', { faultEnabled: true }],
    ['fuel_imbalance', { tankImbalancePct: 2.3 }],
    ['throttle_asymmetry', { symmetryDelta: 2.3 }],
    ['electrical_bus_low', { busB: 24.9 }],
    ['ice_alarm', { antiIce: false }],
    ['gear_unsafe', { gearDown: true, gearUnsafe: true }],
  ])('raises %s', (key, overrides) => {
    expect(evaluateAlertState({ ...nominal, ...overrides }).cautions.has(key)).toBe(true);
  });

  it('suppresses gear unsafe during transit', () => {
    const state = evaluateAlertState({ ...nominal, gearDown: true, gearUnsafe: true, gearTransit: true });
    expect(state.cautions.has('gear_unsafe')).toBe(false);
  });
});

describe('alert transitions', () => {
  it('reports raised and cleared keys', () => {
    const quiet = evaluateAlertState(nominal);
    const active = evaluateAlertState({ ...nominal, egt: withEngine(780) });
    expect(getNewAlerts(quiet, active).newWarnings).toEqual(['egt_critical']);
    expect(getClearedAlerts(active, quiet).clearedCautions).toEqual(['egt_high']);
  });
});

describe('buildActiveAlertList', () => {
  const build = (overrides = {}, metrics = {}) =>
    buildActiveAlertList({
      metrics: { ...nominalMetrics, ...metrics },
      faultEnabled: false,
      faultEngine: 3,
      antiIce: true,
      gearDown: false,
      gearUnsafe: false,
      gearTransit: false,
      boost: true,
      transfer: true,
      ...overrides,
    });

  it('is empty in nominal conditions', () => {
    expect(build()).toEqual([]);
  });

  it('names the affected engine', () => {
    const ids = build({}, { egt: withEngine(780, 5) }).map((row) => row.id);
    expect(ids).toEqual(['egt_critical_e6', 'egt_high_e6']);
  });

  it('produces unique identifiers when everything is active', () => {
    const rows = build(
      { faultEnabled: true, antiIce: false, gearDown: true, gearUnsafe: true, boost: false, transfer: false },
      {
        egt: new Array(8).fill(790),
        oilPressure: new Array(8).fill(20),
        oilTemp: new Array(8).fill(130),
        trend: new Array(8).fill(9),
        tankImbalancePct: 5,
        symmetryDelta: 5,
        busA: 22,
      },
    );
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });
});
