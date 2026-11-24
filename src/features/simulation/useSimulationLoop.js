import { useEffect, useRef, useState } from 'react';
import { TICK_SECONDS } from '../../domain/aircraft/constants.js';
import { initSimulation } from '../../domain/simulation/simulationState.js';
import { stepSimulation } from '../../domain/simulation/stepSimulation.js';

export function useSimulationLoop({ throttles, seed, ...controls }) {
  const [sim, setSim] = useState(() =>
    initSimulation(throttles, controls.targetEpr, controls.antiIce, controls.boost, seed),
  );
  const latestInputRef = useRef({ throttles, controls });

  useEffect(() => {
    latestInputRef.current = { throttles, controls };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const input = latestInputRef.current;
      setSim((previous) => stepSimulation(previous, input.throttles, input.controls, TICK_SECONDS));
    }, TICK_SECONDS * 1000);

    return () => clearInterval(interval);
  }, []);

  return sim;
}
