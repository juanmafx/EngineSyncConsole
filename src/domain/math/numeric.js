export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const sum = (values) => values.reduce((total, value) => total + value, 0);

export const firstOrderAlpha = (dtSeconds, tauSeconds) => 1 - Math.exp(-dtSeconds / tauSeconds);

export const lagToward = (current, target, dtSeconds, tauSeconds) =>
  current + (target - current) * firstOrderAlpha(dtSeconds, tauSeconds);

export const normalizeDegrees = (degrees) => ((degrees % 360) + 360) % 360;

export const shortestArcDegrees = (fromDegrees, toDegrees) => {
  const delta = normalizeDegrees(toDegrees - fromDegrees);
  return delta > 180 ? delta - 360 : delta;
};
