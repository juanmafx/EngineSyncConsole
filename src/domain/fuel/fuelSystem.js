import { firstOrderAlpha, sum } from '../math/numeric.js';

const TANK_KEYS = ['fwd', 'aft', 'leftWing', 'rightWing'];
const TRANSFER_SCHEDULE = { fwd: 0.45, aft: 0.35, leftWing: 0.1, rightWing: 0.1 };
const DIRECT_SCHEDULE = { fwd: 0.2, aft: 0.2, leftWing: 0.3, rightWing: 0.3 };
const CROSSFEED_TAU_SECONDS = 6;
const CROSSFEED_MAX_LB_PER_SECOND = 35;

export const totalFuelLb = (tanks) => sum(TANK_KEYS.map((key) => tanks[key]));

export function drawFuel(tanks, requestedLb, transferEnabled) {
  const schedule = transferEnabled ? TRANSFER_SCHEDULE : DIRECT_SCHEDULE;
  const nextTanks = { ...tanks };
  let remainingLb = Math.max(0, requestedLb);

  for (let pass = 0; pass <= TANK_KEYS.length && remainingLb > 1e-9; pass += 1) {
    const activeKeys = TANK_KEYS.filter((key) => nextTanks[key] > 0);
    if (activeKeys.length === 0) {
      break;
    }
    const totalWeight = sum(activeKeys.map((key) => schedule[key]));
    let drawnLb = 0;
    for (const key of activeKeys) {
      const takeLb = Math.min(nextTanks[key], (remainingLb * schedule[key]) / totalWeight);
      nextTanks[key] -= takeLb;
      drawnLb += takeLb;
    }
    remainingLb -= drawnLb;
  }

  const shortfallLb = remainingLb > 1e-9 ? remainingLb : 0;
  return { tanks: nextTanks, deliveredLb: Math.max(0, requestedLb) - shortfallLb };
}

export function equalizeWingTanks(tanks, dtSeconds) {
  const difference = tanks.leftWing - tanks.rightWing;
  const transferLb = Math.min(
    Math.abs(difference) * firstOrderAlpha(dtSeconds, CROSSFEED_TAU_SECONDS),
    Math.abs(difference) / 2,
    CROSSFEED_MAX_LB_PER_SECOND * dtSeconds,
  );
  const signedTransferLb = Math.sign(difference) * transferLb;
  return {
    ...tanks,
    leftWing: tanks.leftWing - signedTransferLb,
    rightWing: tanks.rightWing + signedTransferLb,
  };
}
