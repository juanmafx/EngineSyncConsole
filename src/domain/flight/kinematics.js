import { AIRCRAFT_LIMITS, AIRCRAFT_MASS } from '../aircraft/constants.js';
import { clamp, lagToward, shortestArcDegrees, normalizeDegrees } from '../math/numeric.js';

const KNOT_TO_FPS = 1.68781;
const FT_PER_MINUTE_TO_FT_PER_SEC = 1 / 60;
const MASS_PROXY_LB = 380000;
const MAX_MODEL_MASS_LB = 520000;
const MIN_AIRSPEED_KT = 180;
const MIN_ALTITUDE_FT = 1000;
const VS_TAU_ENGAGED_SECONDS = 2.1215;
const VS_TAU_DISENGAGED_SECONDS = 3.3155;
const HEADING_GAIN_PER_SECOND = 0.08;
const HEADING_MAX_RATE_DPS = 3;

function resolveDesiredVerticalSpeed({ afcsMode, altitudeErrorFt, targetVsFpm }) {
  const isAltitudeManaged = (afcsMode?.altitude ?? 'OFF') !== 'OFF';

  if (isAltitudeManaged) {
    const holdGain = Math.abs(altitudeErrorFt) < 350 ? 0.08 : 0.12;
    return clamp(altitudeErrorFt * holdGain, -2200, 2200);
  }

  const verticalMode = afcsMode?.vertical ?? 'NONE';
  if (verticalMode === 'FPA') {
    return clamp(targetVsFpm * 0.85, -2600, 2600);
  }
  return verticalMode === 'VS' ? clamp(targetVsFpm, -3000, 3000) : 0;
}

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

  const massLb = clamp(grossWeightLb || MASS_PROXY_LB, AIRCRAFT_MASS.emptyWeightLb, MAX_MODEL_MASS_LB);
  const massSlugs = massLb / 32.174;
  const speedRatio = clamp(airspeedKt / AIRCRAFT_LIMITS.maxSpeedKt, 0, 1.25);
  const altitudeRatio = clamp(altitudeFt / AIRCRAFT_LIMITS.ceilingFt, 0, 1);
  const configPenaltyLbf = antiIce ? 2000 : 0;
  const dragRequiredLbf =
    14000 + speedRatio * 12000 + speedRatio * speedRatio * 52000 + altitudeRatio * 12000 + configPenaltyLbf;
  const safeThrustAvailableLbf = clamp(thrustAvailableLbf || 0, 0, 180000);
  const netThrustLbf = clamp(safeThrustAvailableLbf - dragRequiredLbf, -120000, 120000);

  const accelerationKtPerSec = clamp(netThrustLbf / massSlugs / KNOT_TO_FPS, -4, 4);
  const integratedAirspeedKt = airspeedKt + accelerationKtPerSec * dt;

  let nextVerticalSpeedFpm;
  let afcsSaturated = false;

  if (autopilotOn) {
    const desiredVsFpm = resolveDesiredVerticalSpeed({
      afcsMode,
      altitudeErrorFt: targetAltitudeFt - altitudeFt,
      targetVsFpm,
    });
    const excessPowerFtLbPerSec = netThrustLbf * Math.max(MIN_AIRSPEED_KT, integratedAirspeedKt) * KNOT_TO_FPS;
    const climbCapabilityFpm = clamp((excessPowerFtLbPerSec / massLb) * 60, -4000, 4000);
    const maxUpFpm = clamp(climbCapabilityFpm - 50, -1500, 3200);
    const maxDownFpm = clamp(Math.min(-250, climbCapabilityFpm - 250), -3200, -250);
    const boundedDesiredVsFpm = clamp(desiredVsFpm, maxDownFpm, Math.max(maxDownFpm, maxUpFpm));
    afcsSaturated = Math.abs(boundedDesiredVsFpm - desiredVsFpm) > 75;
    nextVerticalSpeedFpm = lagToward(verticalSpeedFpm, boundedDesiredVsFpm, dt, VS_TAU_ENGAGED_SECONDS);
  } else {
    nextVerticalSpeedFpm = lagToward(verticalSpeedFpm, 0, dt, VS_TAU_DISENGAGED_SECONDS);
  }

  const integratedAltitudeFt = altitudeFt + nextVerticalSpeedFpm * FT_PER_MINUTE_TO_FT_PER_SEC * dt;
  const nextAltitudeFt = clamp(integratedAltitudeFt, MIN_ALTITUDE_FT, AIRCRAFT_LIMITS.ceilingFt);
  if (nextAltitudeFt !== integratedAltitudeFt) {
    nextVerticalSpeedFpm = 0;
  }

  return {
    airspeedKt: clamp(integratedAirspeedKt, MIN_AIRSPEED_KT, AIRCRAFT_LIMITS.maxSpeedKt),
    verticalSpeedFpm: nextVerticalSpeedFpm,
    altitudeFt: nextAltitudeFt,
    afcsSaturated,
    forceState: { thrustAvailableLbf: safeThrustAvailableLbf, dragRequiredLbf, netThrustLbf },
  };
}

export function stepHeading(headingDeg, targetHeadingDeg, dt) {
  const errorDeg = shortestArcDegrees(headingDeg, targetHeadingDeg);
  const rateDps = clamp(errorDeg * HEADING_GAIN_PER_SECOND, -HEADING_MAX_RATE_DPS, HEADING_MAX_RATE_DPS);
  const stepDeg = rateDps * dt;
  return normalizeDegrees(headingDeg + (Math.abs(stepDeg) > Math.abs(errorDeg) ? errorDeg : stepDeg));
}
