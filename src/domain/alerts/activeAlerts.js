import { ALERT_THRESHOLDS as LIMITS } from './thresholds.js';

const perEngineAlert = (key, level, labelPrefix, engineIndex) => ({
  id: `${key}_e${engineIndex + 1}`,
  key,
  level,
  label: `${labelPrefix} E${engineIndex + 1}`,
});

const systemAlert = (key, label) => ({ id: key, key, level: 'caution', label });

export function buildActiveAlertList({
  metrics,
  faultEnabled,
  faultEngine,
  antiIce,
  gearDown,
  gearUnsafe,
  gearTransit,
  boost,
  transfer,
}) {
  const rows = [];

  metrics.egt.forEach((value, i) => {
    if (value > LIMITS.egtWarningC) {
      rows.push(perEngineAlert('egt_critical', 'warning', 'EGT Critical', i));
    }
    if (value > LIMITS.egtCautionC) {
      rows.push(perEngineAlert('egt_high', 'caution', 'EGT High', i));
    }
  });

  metrics.oilPressure.forEach((value, i) => {
    if (value < LIMITS.oilPressureLowPsi) {
      rows.push(perEngineAlert('oil_pressure_low', 'caution', 'Low Oil Pressure', i));
    }
  });

  metrics.oilTemp.forEach((value, i) => {
    if (value > LIMITS.oilTemperatureHighC) {
      rows.push(perEngineAlert('oil_temp_high', 'caution', 'Oil Temp High', i));
    }
  });

  metrics.trend.forEach((value, i) => {
    if (Math.abs(value) > LIMITS.egtTrendAbnormalCPerSecond) {
      rows.push(perEngineAlert('egt_trend_abnormal', 'caution', 'EGT Trend Abnormal', i));
    }
  });

  if (faultEnabled) {
    rows.push({
      id: `engine_degraded_e${faultEngine + 1}`,
      key: 'engine_degraded',
      level: 'caution',
      label: `Engine ${faultEngine + 1} Degraded`,
    });
  }
  if (metrics.tankImbalancePct > LIMITS.fuelImbalancePct) {
    rows.push(systemAlert('fuel_imbalance', 'Fuel Imbalance'));
  }
  if (metrics.symmetryDelta > LIMITS.throttleAsymmetryPct) {
    rows.push(systemAlert('throttle_asymmetry', 'Throttle Asymmetry'));
  }
  if (metrics.busA < LIMITS.busLowVolts || metrics.busB < LIMITS.busLowVolts) {
    rows.push(systemAlert('electrical_bus_low', 'Electrical Bus Low'));
  }
  if (!antiIce) {
    rows.push(systemAlert('ice_alarm', 'Airframe Ice'));
  }
  if (gearDown && gearUnsafe && !gearTransit) {
    rows.push(systemAlert('gear_unsafe', 'Gear Unsafe'));
  }
  if (!boost) {
    rows.push(systemAlert('boost_pump_off', 'Boost Pump Off'));
  }
  if (!transfer) {
    rows.push(systemAlert('fuel_transfer_off', 'Fuel Transfer Off'));
  }

  return rows;
}
