const WARNING_PRIORITY = 1;
const CAUTION_PRIORITY = 2;

export function evaluateAlertState(simState) {
  const warnings = new Set();
  const cautions = new Set();

  if (simState.egt.some((v) => v > 680)) {
    warnings.add('egt_critical');
  }

  if (simState.egt.some((v) => v > 650)) {
    cautions.add('egt_high');
  }

  if (simState.oilPressure.some((v) => v < 35)) {
    cautions.add('oil_pressure_low');
  }

  if (simState.faultEnabled) {
    cautions.add('engine_degraded');
  }

  if (simState.symmetryDelta > 2.2) {
    cautions.add('fuel_imbalance');
  }

  if (simState.busA < 25 || simState.busB < 25) {
    cautions.add('electrical_bus_low');
  }

  if (simState.iceAlarmActive) {
    cautions.add('ice_alarm');
  }

  if (simState.gearDown && simState.gearUnsafe && !simState.gearTransit) {
    cautions.add('gear_unsafe');
  }

  let priority = 0;
  if (warnings.size > 0) {
    priority = WARNING_PRIORITY;
  } else if (cautions.size > 0) {
    priority = CAUTION_PRIORITY;
  }

  return { warnings, cautions, priority };
}

export function getNewAlerts(prevState, nextState) {
  const newWarnings = [...nextState.warnings].filter((key) => !prevState.warnings.has(key));
  const newCautions = [...nextState.cautions].filter((key) => !prevState.cautions.has(key));

  return { newWarnings, newCautions };
}

export function getClearedAlerts(prevState, nextState) {
  const clearedWarnings = [...prevState.warnings].filter((key) => !nextState.warnings.has(key));
  const clearedCautions = [...prevState.cautions].filter((key) => !nextState.cautions.has(key));

  return { clearedWarnings, clearedCautions };
}
