import { useEffect, useMemo, useRef } from 'react';
import SoundManager from './SoundManager';
import { evaluateAlertState, getClearedAlerts, getNewAlerts } from './alertRules';

const manager = new SoundManager();
const NON_LOOPING_CAUTIONS = new Set(['ice_alarm', 'gear_unsafe', 'fuel_imbalance', 'throttle_asymmetry']);

function routeCautionByCase(key) {
  if (key === 'ice_alarm') {
    manager.triggerIceAlert();
    return;
  }

  if (key === 'gear_unsafe') {
    // Play dedicated low-gear voice only for this specific condition.
    manager.triggerGearUnsafeAlert();
    return;
  }

  // Explicit case routing for current caution catalog.
  // Each route can later get dedicated tones/voice files without changing alert logic.
  switch (key) {
    case 'egt_high':
    case 'oil_pressure_low':
    case 'engine_degraded':
    case 'fuel_imbalance':
    case 'throttle_asymmetry':
    case 'electrical_bus_low':
      manager.triggerCaution(key);
      return;
    default:
      manager.triggerCaution(key);
  }
}

export function useCockpitAudio({
  enabled,
  masterVolume,
  alertVolume,
  ambientProfile,
  simState,
  acknowledgeToken,
}) {
  const prevAlertsRef = useRef({ warnings: new Set(), cautions: new Set(), priority: 0 });
  const prevEnabledRef = useRef(enabled);

  const alertSnapshot = useMemo(() => evaluateAlertState(simState), [simState]);

  useEffect(() => {
    manager.init();

    return () => {
      manager.stopAll();
    };
  }, []);

  useEffect(() => {
    manager.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    const justEnabled = !prevEnabledRef.current && enabled;
    if (justEnabled && alertSnapshot.cautions.has('ice_alarm')) {
      manager.triggerIceAlert();
    }

    prevEnabledRef.current = enabled;
  }, [enabled, alertSnapshot]);

  useEffect(() => {
    manager.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    manager.setAlertVolume(alertVolume);
  }, [alertVolume]);

  useEffect(() => {
    manager.setAmbientProfile(ambientProfile);
  }, [ambientProfile]);

  useEffect(() => {
    const prev = prevAlertsRef.current;
    const transitions = getNewAlerts(prev, alertSnapshot);
    const cleared = getClearedAlerts(prev, alertSnapshot);

    transitions.newWarnings.forEach((key) => {
      manager.logEvent('alert_raised', { level: 'warning', key });
    });
    transitions.newCautions.forEach((key) => {
      manager.logEvent('alert_raised', { level: 'caution', key });
    });
    cleared.clearedWarnings.forEach((key) => {
      manager.logEvent('alert_cleared', { level: 'warning', key });
    });
    cleared.clearedCautions.forEach((key) => {
      manager.logEvent('alert_cleared', { level: 'caution', key });
    });

    transitions.newWarnings.forEach((key) => manager.triggerWarning(key));
    if (transitions.newWarnings.length === 0) {
      transitions.newCautions.forEach((key) => {
        routeCautionByCase(key);
      });
    }

    // Keep ICE alarm repeating (with SoundManager cooldown) until anti-ice/defrost is turned on.
    if (alertSnapshot.cautions.has('ice_alarm')) {
      manager.triggerIceAlert();
    }

    const loopingCautions = [...alertSnapshot.cautions].filter((key) => !NON_LOOPING_CAUTIONS.has(key));
    const effectivePriority = alertSnapshot.warnings.size > 0 ? 1 : loopingCautions.length > 0 ? 2 : 0;
    if (effectivePriority !== prev.priority) {
      manager.logEvent('priority_changed', {
        previous: prev.priority,
        next: effectivePriority,
        warnings: [...alertSnapshot.warnings],
        cautions: [...alertSnapshot.cautions],
      });
    }
    manager.updateAlertPriority(effectivePriority);
    prevAlertsRef.current = alertSnapshot;
  }, [alertSnapshot]);

  useEffect(() => {
    if (acknowledgeToken === 0) {
      return;
    }

    manager.acknowledgeAlerts();
  }, [acknowledgeToken]);

  return {
    playUiClick: () => manager.playUiClick(),
  };
}
