import { useMemo } from 'react';
import { computeMetrics } from '../../domain/simulation/metrics.js';

export function useMetrics({ sim, throttles, antiIce, bleedAir, boost, transfer, faultEnabled, payloadLb }) {
  return useMemo(
    () => computeMetrics({ sim, throttles, antiIce, bleedAir, boost, transfer, faultEnabled, payloadLb }),
    [antiIce, bleedAir, boost, faultEnabled, payloadLb, sim, throttles, transfer],
  );
}
