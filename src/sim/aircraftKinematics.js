import { AIRCRAFT_LIMITS } from './constants';
import { clamp } from './flightModel';

const KNOT_TO_FPS = 1.68781;
const FT_PER_MINUTE_TO_FT_PER_SEC = 1 / 60;
const MASS_PROXY_LB = 380000;

/**
 * Central aircraft motion integrator.
 *
 * Data flow:
 * 1) Engine model computes per-engine thrust/fuel/temps.
 * 2) Telemetry performance layer computes drag-equivalent demand and thrust margin.
 * 3) This function integrates kinematics (speed, VS, altitude) over time.
 *
 * UI controls (targets/selectors) only provide commands; they do not write final motion directly.
 */
export function updateAircraftKinematics(state, dt) {
  const {
    airspeedKt,
    verticalSpeedFpm,
    altitudeFt,
    autopilotOn,
    afcsMode,
    targetAltitudeFt,
    targetVsFpm,
    thrustAvailableLbf,
    antiIce,
    grossWeightLb,
  } = state;

  let nextAirspeedKt = airspeedKt;
  let nextVerticalSpeedFpm = verticalSpeedFpm;
  let nextAltitudeFt = altitudeFt;
  let afcsSaturated = false;

  // Simplified acceleration model (causal, readable):
  // throttle -> thrustAvailableLbf, then dragRequiredLbf from flight condition, then net thrust.
  const massLb = clamp(grossWeightLb || MASS_PROXY_LB, 220000, 520000);
  const massSlugs = massLb / 32.174;
  const speedRatio = clamp(nextAirspeedKt / AIRCRAFT_LIMITS.maxSpeedKt, 0, 1.25);
  const altitudeRatio = clamp(nextAltitudeFt / AIRCRAFT_LIMITS.ceilingFt, 0, 1);
  const configPenaltyLbf = antiIce ? 2000 : 0;
  const dragRequiredLbf =
    14000 + // baseline cruise drag
    speedRatio * 12000 + // linear speed component
    speedRatio * speedRatio * 52000 + // quadratic drag growth
    altitudeRatio * 12000 + // high altitude drag/energy penalty
    configPenaltyLbf;
  const safeThrustAvailableLbf = clamp(thrustAvailableLbf || 0, 0, 180000);
  const netThrustLbf = clamp(safeThrustAvailableLbf - dragRequiredLbf, -120000, 120000);

  // Integrate speed progressively with dt and clamp acceleration to avoid explosive values.
  const accelerationFps2 = massSlugs > 0 ? netThrustLbf / massSlugs : 0;
  const accelerationKtPerSec = clamp(accelerationFps2 / KNOT_TO_FPS, -4, 4);
  nextAirspeedKt += accelerationKtPerSec * dt;

  // Resolve AFCS mode hierarchy (altitude management overrides vertical mode).
  let desiredVsFpm = 0;
  const altitudeErrorFt = targetAltitudeFt - nextAltitudeFt;
  const isAltitudeManaged = autopilotOn && (afcsMode?.altitude ?? 'OFF') !== 'OFF';
  const resolvedAltitudeMode = isAltitudeManaged
    ? Math.abs(altitudeErrorFt) < 350
      ? 'CAPTURE'
      : afcsMode?.altitude ?? 'HOLD'
    : 'OFF';
  const resolvedVerticalMode = isAltitudeManaged ? 'NONE' : afcsMode?.vertical ?? 'NONE';

  if (autopilotOn) {
    if (resolvedAltitudeMode !== 'OFF') {
      const holdGain = resolvedAltitudeMode === 'CAPTURE' ? 0.08 : 0.12;
      desiredVsFpm = clamp(altitudeErrorFt * holdGain, -2200, 2200);
    } else if (resolvedVerticalMode === 'VS' || resolvedVerticalMode === 'FPA') {
      desiredVsFpm = resolvedVerticalMode === 'FPA' ? clamp(targetVsFpm * 0.85, -2600, 2600) : clamp(targetVsFpm, -3000, 3000);
    }

    // Drag/config state is represented by modeled drag and net thrust from this layer.
    // If the margin is poor, commanded climb is bounded by current energy capability.
    const excessPowerFtLbPerSec = netThrustLbf * Math.max(180, nextAirspeedKt) * KNOT_TO_FPS;
    const climbCapabilityFpm = clamp((excessPowerFtLbPerSec / massLb) * 60, -4000, 4000);
    // Energy-limited vertical envelope:
    // when climb capability drops below zero, level flight cannot be maintained and descent is enforced.
    const maxUpFpm = clamp(climbCapabilityFpm - 50, -1500, 3200);
    const maxDownFpm = clamp(Math.min(-250, climbCapabilityFpm - 250), -3200, -250);
    const boundedDesiredVsFpm = clamp(desiredVsFpm, maxDownFpm, maxUpFpm);
    afcsSaturated = Math.abs(boundedDesiredVsFpm - desiredVsFpm) > 75;
    nextVerticalSpeedFpm += (boundedDesiredVsFpm - nextVerticalSpeedFpm) * 0.21;
  } else {
    nextVerticalSpeedFpm += (0 - nextVerticalSpeedFpm) * 0.14;
  }

  // Integrate altitude from resulting vertical speed.
  nextAltitudeFt += nextVerticalSpeedFpm * FT_PER_MINUTE_TO_FT_PER_SEC * dt;

  // Keep outputs in envelope limits.
  nextAirspeedKt = clamp(nextAirspeedKt, 180, AIRCRAFT_LIMITS.maxSpeedKt);
  nextAltitudeFt = clamp(nextAltitudeFt, 1000, AIRCRAFT_LIMITS.ceilingFt);

  return {
    airspeedKt: nextAirspeedKt,
    verticalSpeedFpm: nextVerticalSpeedFpm,
    altitudeFt: nextAltitudeFt,
    afcsSaturated,
    // Expose force context for debugging/telemetry if needed by callers.
    forceState: {
      thrustAvailableLbf: safeThrustAvailableLbf,
      dragRequiredLbf,
      netThrustLbf,
    },
  };
}
