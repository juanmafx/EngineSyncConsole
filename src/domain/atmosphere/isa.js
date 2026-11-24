const FEET_TO_METERS = 0.3048;
const SEA_LEVEL_TEMPERATURE_K = 288.15;
const LAPSE_RATE_K_PER_M = 0.0065;
const GRAVITY_M_PER_S2 = 9.80665;
const GAS_CONSTANT_J_PER_KG_K = 287.05287;
const TROPOPAUSE_M = 11000;
const MODEL_CEILING_M = 20000;
const TROPOPAUSE_TEMPERATURE_K = SEA_LEVEL_TEMPERATURE_K - LAPSE_RATE_K_PER_M * TROPOPAUSE_M;
const PRESSURE_EXPONENT = GRAVITY_M_PER_S2 / (LAPSE_RATE_K_PER_M * GAS_CONSTANT_J_PER_KG_K);
const TROPOPAUSE_PRESSURE_RATIO = (TROPOPAUSE_TEMPERATURE_K / SEA_LEVEL_TEMPERATURE_K) ** PRESSURE_EXPONENT;

export function isaRatios(altitudeFt) {
  const altitudeM = Math.min(MODEL_CEILING_M, Math.max(0, altitudeFt) * FEET_TO_METERS);

  if (altitudeM <= TROPOPAUSE_M) {
    const temperatureRatio = (SEA_LEVEL_TEMPERATURE_K - LAPSE_RATE_K_PER_M * altitudeM) / SEA_LEVEL_TEMPERATURE_K;
    const pressureRatio = temperatureRatio ** PRESSURE_EXPONENT;
    return { temperatureRatio, pressureRatio, densityRatio: pressureRatio / temperatureRatio };
  }

  const temperatureRatio = TROPOPAUSE_TEMPERATURE_K / SEA_LEVEL_TEMPERATURE_K;
  const pressureRatio =
    TROPOPAUSE_PRESSURE_RATIO *
    Math.exp((-GRAVITY_M_PER_S2 * (altitudeM - TROPOPAUSE_M)) / (GAS_CONSTANT_J_PER_KG_K * TROPOPAUSE_TEMPERATURE_K));
  return { temperatureRatio, pressureRatio, densityRatio: pressureRatio / temperatureRatio };
}

export const densityRatioAtAltitude = (altitudeFt) => isaRatios(altitudeFt).densityRatio;
